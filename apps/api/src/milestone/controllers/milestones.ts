import { and, asc, eq, getTableColumns, inArray, ne, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  columnTable,
  milestoneTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import type { z } from "../../openapi";
import type { createMilestoneBody, updateMilestoneBody } from "../schema";

export type MilestoneTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

// All milestone membership changes lock projects before tasks. Sorted project
// locks also keep opposite-direction task moves from deadlocking.
export async function lockMilestoneProjects(
  tx: MilestoneTransaction,
  projectIds: string[],
) {
  for (const id of [...new Set(projectIds)].sort()) {
    const [project] = await tx
      .select({ id: projectTable.id })
      .from(projectTable)
      .where(eq(projectTable.id, id))
      .for("update");
    if (!project)
      throw new HTTPException(404, { message: "Project not found" });
  }
}

export async function assertOpenMilestone(
  tx: MilestoneTransaction,
  milestoneId: string,
  projectId: string,
) {
  const [milestone] = await tx
    .select()
    .from(milestoneTable)
    .where(
      and(
        eq(milestoneTable.id, milestoneId),
        eq(milestoneTable.projectId, projectId),
      ),
    );
  if (!milestone)
    throw new HTTPException(400, {
      message: "Milestone does not belong to this project",
    });
  if (milestone.status !== "open")
    throw new HTTPException(409, {
      message: "Reopen the milestone before adding tasks",
    });
  return milestone;
}

export async function publishMilestoneAssignment(
  task: { id: string; projectId: string },
  userId: string,
  oldMilestone: { id: string; name: string } | null,
  newMilestone: { id: string; name: string } | null,
) {
  await publishEvent("task.milestone_changed", {
    taskId: task.id,
    projectId: task.projectId,
    userId,
    type: "milestone_changed",
    oldMilestoneId: oldMilestone?.id ?? null,
    oldMilestoneName: oldMilestone?.name ?? null,
    newMilestoneId: newMilestone?.id ?? null,
    newMilestoneName: newMilestone?.name ?? null,
  });
}

function statisticsQuery() {
  return db
    .select({
      ...getTableColumns(milestoneTable),
      totalTasks:
        sql<number>`count(${taskTable.id}) FILTER (WHERE ${taskTable.status} <> 'archived')`.mapWith(
          Number,
        ),
      completedTasks:
        sql<number>`count(${taskTable.id}) FILTER (WHERE ${taskTable.status} NOT IN ('archived', 'planned') AND EXISTS (SELECT 1 FROM ${columnTable} WHERE ${columnTable.projectId} = ${taskTable.projectId} AND ${columnTable.slug} = ${taskTable.status} AND ${columnTable.isFinal} = true))`.mapWith(
          Number,
        ),
      archivedTasks:
        sql<number>`count(${taskTable.id}) FILTER (WHERE ${taskTable.status} = 'archived')`.mapWith(
          Number,
        ),
    })
    .from(milestoneTable)
    .leftJoin(
      taskTable,
      and(
        eq(taskTable.projectId, milestoneTable.projectId),
        eq(taskTable.milestoneId, milestoneTable.id),
      ),
    )
    .$dynamic();
}
function withProgress<T extends { totalTasks: number; completedTasks: number }>(
  row: T,
) {
  return {
    ...row,
    progressPercent:
      row.totalTasks === 0
        ? 0
        : Math.round((row.completedTasks / row.totalTasks) * 100),
  };
}
function pagination(total: number, page: number, limit: number) {
  return { total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
}
export async function listMilestones(
  projectId: string,
  options: { status?: "open" | "closed"; page: number; limit: number },
) {
  const where = and(
    eq(milestoneTable.projectId, projectId),
    options.status ? eq(milestoneTable.status, options.status) : undefined,
  );
  const [count] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(milestoneTable)
    .where(where);
  const data = await statisticsQuery()
    .where(where)
    .groupBy(milestoneTable.id)
    .orderBy(
      sql`${milestoneTable.dueDate} ASC NULLS LAST`,
      asc(milestoneTable.createdAt),
      asc(milestoneTable.id),
    )
    .limit(options.limit)
    .offset((options.page - 1) * options.limit);
  return {
    data: data.map(withProgress),
    pagination: pagination(count?.total ?? 0, options.page, options.limit),
  };
}
async function getMilestoneRecord(id: string) {
  const [milestone] = await db
    .select()
    .from(milestoneTable)
    .where(eq(milestoneTable.id, id));
  if (!milestone)
    throw new HTTPException(404, { message: "Milestone not found" });
  return milestone;
}
export async function getMilestone(id: string) {
  const [row] = await statisticsQuery()
    .where(eq(milestoneTable.id, id))
    .groupBy(milestoneTable.id);
  if (!row) throw new HTTPException(404, { message: "Milestone not found" });
  return withProgress(row);
}
export async function listMilestoneTasks(
  id: string,
  options: { page: number; limit: number; archived: "true" | "false" },
) {
  const milestone = await getMilestoneRecord(id);
  const where = and(
    eq(taskTable.projectId, milestone.projectId),
    eq(taskTable.milestoneId, id),
    options.archived === "true"
      ? eq(taskTable.status, "archived")
      : ne(taskTable.status, "archived"),
  );
  const [count] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(taskTable)
    .where(where);
  const data = await db
    .select()
    .from(taskTable)
    .where(where)
    .orderBy(asc(taskTable.number), asc(taskTable.id))
    .limit(options.limit)
    .offset((options.page - 1) * options.limit);
  return {
    data,
    pagination: pagination(count?.total ?? 0, options.page, options.limit),
  };
}
export async function createMilestone(
  projectId: string,
  body: z.infer<typeof createMilestoneBody>,
) {
  const [milestone] = await db
    .insert(milestoneTable)
    .values({ projectId, ...body })
    .returning();
  if (!milestone)
    throw new HTTPException(500, { message: "Failed to create milestone" });
  await publishEvent("milestone.created", { projectId });
  return milestone;
}
export async function updateMilestone(
  id: string,
  body: z.infer<typeof updateMilestoneBody>,
) {
  const existing = await getMilestoneRecord(id);
  const milestone = await db.transaction(async (tx) => {
    await lockMilestoneProjects(tx, [existing.projectId]);
    const [current] = await tx
      .select()
      .from(milestoneTable)
      .where(eq(milestoneTable.id, id));
    if (!current)
      throw new HTTPException(404, { message: "Milestone not found" });
    const [updated] = await tx
      .update(milestoneTable)
      .set({
        ...body,
        ...(body.status
          ? {
              closedAt:
                body.status === "closed"
                  ? (current.closedAt ?? new Date())
                  : null,
            }
          : {}),
      })
      .where(eq(milestoneTable.id, id))
      .returning();
    if (!updated)
      throw new HTTPException(404, { message: "Milestone not found" });
    return updated;
  });
  await publishEvent("milestone.updated", { projectId: milestone.projectId });
  return milestone;
}
export async function deleteMilestone(id: string, userId: string) {
  const existing = await getMilestoneRecord(id);
  const detached = await db.transaction(async (tx) => {
    await lockMilestoneProjects(tx, [existing.projectId]);
    const [current] = await tx
      .select()
      .from(milestoneTable)
      .where(eq(milestoneTable.id, id));
    if (!current)
      throw new HTTPException(404, { message: "Milestone not found" });
    const tasks = await tx
      .update(taskTable)
      .set({ milestoneId: null })
      .where(
        and(
          eq(taskTable.projectId, existing.projectId),
          eq(taskTable.milestoneId, id),
        ),
      )
      .returning({ id: taskTable.id, projectId: taskTable.projectId });
    await tx.delete(milestoneTable).where(eq(milestoneTable.id, id));
    return { tasks, current };
  });
  for (const task of detached.tasks)
    await publishMilestoneAssignment(task, userId, detached.current, null);
  await publishEvent("milestone.deleted", { projectId: existing.projectId });
  return { success: true, detachedTasks: detached.tasks.length };
}

export async function setTaskMilestones(
  taskIds: string[],
  milestoneId: string | null,
  userId: string,
) {
  const ids = [...new Set(taskIds)];
  const initial = await db
    .select({ id: taskTable.id, projectId: taskTable.projectId })
    .from(taskTable)
    .where(inArray(taskTable.id, ids));
  if (initial.length !== ids.length)
    throw new HTTPException(404, { message: "Task not found" });
  const projectIds = [...new Set(initial.map((t) => t.projectId))];
  if (milestoneId && projectIds.length !== 1)
    throw new HTTPException(400, {
      message: "All tasks must belong to the milestone's project",
    });
  const result = await db.transaction(async (tx) => {
    await lockMilestoneProjects(tx, projectIds);
    const tasks = await tx
      .select()
      .from(taskTable)
      .where(inArray(taskTable.id, ids))
      .orderBy(asc(taskTable.id))
      .for("update");
    if (
      tasks.length !== ids.length ||
      tasks.some((t) => !projectIds.includes(t.projectId))
    )
      throw new HTTPException(409, {
        message: "Tasks changed projects; retry the operation",
      });
    const changed = tasks.filter((t) => t.milestoneId !== milestoneId);
    const next =
      milestoneId && changed.length
        ? await assertOpenMilestone(tx, milestoneId, tasks[0]!.projectId)
        : null;
    const oldIds = [
      ...new Set(
        changed
          .map((t) => t.milestoneId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const old = oldIds.length
      ? await tx
          .select()
          .from(milestoneTable)
          .where(inArray(milestoneTable.id, oldIds))
      : [];
    if (changed.length)
      await tx
        .update(taskTable)
        .set({ milestoneId })
        .where(
          inArray(
            taskTable.id,
            changed.map((t) => t.id),
          ),
        );
    const updated = await tx
      .select()
      .from(taskTable)
      .where(inArray(taskTable.id, ids));
    return { changed, next, old, updated };
  });
  const oldById = new Map(
    result.old.map((milestone) => [milestone.id, milestone]),
  );
  for (const task of result.changed)
    await publishMilestoneAssignment(
      task,
      userId,
      oldById.get(task.milestoneId ?? "") ?? null,
      result.next,
    );
  return result.updated;
}
