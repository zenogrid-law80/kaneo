import { createId } from "@paralleldrive/cuid2";
import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { bugEnvironmentTable } from "../../database/schema";
import { publishEvent } from "../../events";
import {
  lockMilestoneProjects,
  type MilestoneTransaction,
} from "../../milestone/controllers/milestones";
import { bugEnvironments } from "../metadata";

type Database = typeof db | MilestoneTransaction;

export async function getBugEnvironments(
  projectId: string,
  client: Database = db,
) {
  const rows = await client
    .select()
    .from(bugEnvironmentTable)
    .where(eq(bugEnvironmentTable.projectId, projectId))
    .orderBy(asc(bugEnvironmentTable.createdAt), asc(bugEnvironmentTable.id));
  const defaults = bugEnvironments.map((id) => {
    const row = rows.find((item) => item.id === id);
    return { id, name: row?.name ?? null, archived: row?.archived ?? false };
  });
  return [
    ...defaults,
    ...rows
      .filter((row) => !bugEnvironments.some((id) => id === row.id))
      .map(({ id, name, archived }) => ({ id, name, archived })),
  ];
}

export async function assertBugEnvironment(
  projectId: string,
  id: string | null | undefined,
  client: Database = db,
  allowArchived = false,
) {
  if (id == null) return;
  const item = (await getBugEnvironments(projectId, client)).find(
    (entry) => entry.id === id,
  );
  if (!item || (item.archived && !allowArchived))
    throw new HTTPException(400, {
      message: "Environment is not available in this project",
    });
}

export async function createBugEnvironment(projectId: string, name: string) {
  const result = await db.transaction(async (tx) => {
    await lockMilestoneProjects(tx, [projectId]);
    const id = createId();
    const [row] = await tx
      .insert(bugEnvironmentTable)
      .values({ projectId, id, name })
      .returning();
    if (!row)
      throw new HTTPException(500, { message: "Failed to create environment" });
    return { id: row.id, name: row.name, archived: row.archived };
  });
  await publishEvent("bug.environments.updated", { projectId });
  return result;
}

export async function updateBugEnvironment(
  projectId: string,
  id: string,
  update: { name?: string; archived?: boolean },
) {
  const result = await db.transaction(async (tx) => {
    await lockMilestoneProjects(tx, [projectId]);
    const current = (await getBugEnvironments(projectId, tx)).find(
      (entry) => entry.id === id,
    );
    if (!current)
      throw new HTTPException(404, { message: "Environment not found" });
    const next = {
      id,
      name: update.name ?? current.name,
      archived: update.archived ?? current.archived,
    };
    await tx
      .insert(bugEnvironmentTable)
      .values({ projectId, ...next })
      .onConflictDoUpdate({
        target: [bugEnvironmentTable.projectId, bugEnvironmentTable.id],
        set: { name: next.name, archived: next.archived },
      });
    return next;
  });
  await publishEvent("bug.environments.updated", { projectId });
  return result;
}
