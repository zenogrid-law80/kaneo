import { and, count, desc, eq, inArray } from "drizzle-orm";
import type { z } from "../../openapi";
import db from "../../database";
import {
  bugHistoryTable,
  bugTable,
  milestoneTable,
  userTable,
} from "../../database/schema";
import { HTTPException } from "hono/http-exception";
import { bugHistoryFields, type BugChange } from "../history-types";
import type { updateBugBody } from "../schema";

export async function recordBugChanges(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  before: typeof bugTable.$inferSelect,
  input: z.infer<typeof updateBugBody>,
  userId: string,
) {
  const changes: BugChange[] = bugHistoryFields.flatMap((field) =>
    input[field] !== undefined && input[field] !== before[field]
      ? [{ field, before: before[field], after: input[field]! }]
      : [],
  );
  if (!changes.length) return;
  const peopleIds = changes
    .filter((change) =>
      ["reporterId", "fixerId", "verifierId"].includes(change.field),
    )
    .flatMap((change) => [change.before, change.after])
    .filter((id): id is string => Boolean(id));
  const people = peopleIds.length
    ? await tx
        .select({ id: userTable.id, name: userTable.name })
        .from(userTable)
        .where(inArray(userTable.id, peopleIds))
    : [];
  for (const change of changes) {
    if (["reporterId", "fixerId", "verifierId"].includes(change.field)) {
      change.beforeLabel =
        people.find((person) => person.id === change.before)?.name ?? null;
      change.afterLabel =
        people.find((person) => person.id === change.after)?.name ?? null;
    } else if (change.field === "milestoneId") {
      const ids = [change.before, change.after].filter((id): id is string =>
        Boolean(id),
      );
      const milestones = ids.length
        ? await tx
            .select({ id: milestoneTable.id, name: milestoneTable.name })
            .from(milestoneTable)
            .where(
              and(
                eq(milestoneTable.projectId, before.projectId),
                inArray(milestoneTable.id, ids),
              ),
            )
        : [];
      change.beforeLabel =
        milestones.find((milestone) => milestone.id === change.before)?.name ??
        null;
      change.afterLabel =
        milestones.find((milestone) => milestone.id === change.after)?.name ??
        null;
    }
  }
  await tx
    .insert(bugHistoryTable)
    .values({ bugId: before.id, userId, type: "updated", changes });
}

export async function getBugHistory(
  projectId: string,
  id: string,
  page: number,
) {
  const bug = await db.query.bugTable.findFirst({
    columns: { id: true },
    where: and(eq(bugTable.id, id), eq(bugTable.projectId, projectId)),
  });
  if (!bug) throw new HTTPException(404, { message: "Bug not found" });
  const where = eq(bugHistoryTable.bugId, id);
  const [data, [total]] = await Promise.all([
    db.query.bugHistoryTable.findMany({
      where,
      with: { user: { columns: { id: true, name: true, image: true } } },
      orderBy: [desc(bugHistoryTable.createdAt), desc(bugHistoryTable.id)],
      limit: 20,
      offset: (page - 1) * 20,
    }),
    db.select({ count: count() }).from(bugHistoryTable).where(where),
  ]);
  return {
    data,
    pagination: {
      page,
      total: total?.count ?? 0,
      totalPages: Math.ceil((total?.count ?? 0) / 20),
    },
  };
}
