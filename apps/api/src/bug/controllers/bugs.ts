import { and, count, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { bugTable, bugHistoryTable, assetTable } from "../../database/schema";
import { publishEvent } from "../../events";
import type { z } from "../../openapi";
import type { createBugBody, listBugsQuery, updateBugBody } from "../schema";
import { getBugTemplate } from "./template";
import {
  lockMilestoneProjects,
  assertOpenMilestone,
} from "../../milestone/controllers/milestones";
import { validateBugPeople } from "../validate-bug-people";

import { claimBugAssets } from "./claim-assets";
import { recordBugChanges } from "./history";
import { queueStorageCleanup } from "../../storage/cleanup-queue";

const personColumns = { id: true, name: true, image: true } as const;
const people = {
  milestone: { columns: { id: true, name: true, status: true } },
  reporter: { columns: personColumns },
  fixer: { columns: personColumns },
  verifier: { columns: personColumns },
} as const;

export async function listBugs(
  projectId: string,
  query: z.infer<typeof listBugsQuery>,
) {
  const where = and(
    eq(bugTable.projectId, projectId),
    query.status ? eq(bugTable.status, query.status) : undefined,
    ...(["reporterId", "fixerId", "verifierId"] as const).map((key) => {
      const selectedIds = query[key]?.split(",") ?? [];
      if (selectedIds.length === 0) return undefined;
      const userIds = selectedIds.filter((id) => id !== "none");
      return or(
        selectedIds.includes("none") ? isNull(bugTable[key]) : undefined,
        userIds.length > 0 ? inArray(bugTable[key], userIds) : undefined,
      );
    }),
    query.milestoneId === "none"
      ? isNull(bugTable.milestoneId)
      : query.milestoneId
        ? eq(bugTable.milestoneId, query.milestoneId)
        : undefined,
  );
  const [data, [totalRow]] = await Promise.all([
    db.query.bugTable.findMany({
      columns: { description: false },
      with: people,
      where,
      orderBy: [desc(bugTable.createdAt), desc(bugTable.id)],
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    }),
    db.select({ total: count() }).from(bugTable).where(where),
  ]);
  const total = totalRow?.total ?? 0;
  return {
    data,
    pagination: {
      total,
      page: query.page,
      pageSize: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
export async function getBug(projectId: string, id: string) {
  const bug = await db.query.bugTable.findFirst({
    where: and(eq(bugTable.projectId, projectId), eq(bugTable.id, id)),
    with: people,
  });
  if (!bug) throw new HTTPException(404, { message: "Bug not found" });
  return bug;
}
export async function createBug(
  projectId: string,
  input: z.infer<typeof createBugBody>,
  reporterId: string,
) {
  await validateBugPeople(projectId, input);
  const description =
    input.description ?? (await getBugTemplate(projectId)).template;
  const bug = await db.transaction(async (tx) => {
    await lockMilestoneProjects(tx, [projectId]);
    if (input.milestoneId) {
      await assertOpenMilestone(tx, input.milestoneId, projectId);
    }
    const [created] = await tx
      .insert(bugTable)
      .values({
        ...input,
        projectId,
        reporterId:
          input.reporterId === undefined ? reporterId : input.reporterId,
        description,
        status: "new",
      })
      .returning();
    if (created) {
      await claimBugAssets(tx, projectId, created.id, reporterId, description);
      await tx.insert(bugHistoryTable).values({
        bugId: created.id,
        userId: reporterId,
        type: "created",
        changes: [],
      });
    }
    return created;
  });
  if (!bug) throw new HTTPException(500, { message: "Failed to create bug" });
  await publishEvent("bug.changed", { projectId });
  return getBug(projectId, bug.id);
}
export async function updateBug(
  projectId: string,
  id: string,
  input: z.infer<typeof updateBugBody>,
  userId: string,
) {
  await validateBugPeople(projectId, input);
  const bug = await db.transaction(async (tx) => {
    await lockMilestoneProjects(tx, [projectId]);
    const [current] = await tx
      .select()
      .from(bugTable)
      .where(and(eq(bugTable.projectId, projectId), eq(bugTable.id, id)))
      .for("update");
    if (!current) throw new HTTPException(404, { message: "Bug not found" });
    if (input.milestoneId && input.milestoneId !== current.milestoneId)
      await assertOpenMilestone(tx, input.milestoneId, projectId);
    if (input.description !== undefined)
      await claimBugAssets(tx, projectId, id, userId, input.description);
    await recordBugChanges(tx, current, input, userId);
    const [updated] = await tx
      .update(bugTable)
      .set(input)
      .where(and(eq(bugTable.projectId, projectId), eq(bugTable.id, id)))
      .returning();
    return updated;
  });
  if (!bug) throw new HTTPException(404, { message: "Bug not found" });
  await publishEvent("bug.changed", { projectId });
  return getBug(projectId, bug.id);
}
export async function deleteBug(projectId: string, id: string) {
  await db.transaction(async (tx) => {
    await lockMilestoneProjects(tx, [projectId]);
    const [bug] = await tx
      .select({ id: bugTable.id })
      .from(bugTable)
      .where(and(eq(bugTable.projectId, projectId), eq(bugTable.id, id)))
      .for("update");
    if (!bug) throw new HTTPException(404, { message: "Bug not found" });
    const assets = await tx
      .select({ key: assetTable.objectKey })
      .from(assetTable)
      .where(eq(assetTable.bugId, id));
    await queueStorageCleanup(
      tx,
      assets.map((asset) => asset.key),
    );
    await tx.delete(bugTable).where(eq(bugTable.id, id));
  });
  await publishEvent("bug.changed", { projectId });
  return { success: true };
}
