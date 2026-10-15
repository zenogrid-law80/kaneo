import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  projectTable,
  taskSupportingAssigneeTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import type { TaskReadDatabase } from "../bounded-read";

// Only enrich the current task page; never issue one membership query per card.
export async function getSupportingAssigneesByTask(
  db: TaskReadDatabase,
  taskIds: string[],
  workspaceId: string,
) {
  const result = new Map<string, Array<{ userId: string; name: string }>>();
  if (!taskIds.length) return result;
  const rows = await db
    .select({
      taskId: taskSupportingAssigneeTable.taskId,
      userId: userTable.id,
      name: userTable.name,
    })
    .from(taskSupportingAssigneeTable)
    .innerJoin(taskTable, eq(taskTable.id, taskSupportingAssigneeTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .innerJoin(
      workspaceUserTable,
      eq(workspaceUserTable.id, taskSupportingAssigneeTable.membershipId),
    )
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .where(
      and(
        inArray(taskTable.id, taskIds),
        eq(projectTable.workspaceId, workspaceId),
        eq(workspaceUserTable.workspaceId, workspaceId),
        sql`${taskTable.userId} is distinct from ${userTable.id}`,
      ),
    )
    .groupBy(taskSupportingAssigneeTable.taskId, userTable.id, userTable.name)
    .orderBy(
      asc(taskSupportingAssigneeTable.taskId),
      asc(sql`min(${taskSupportingAssigneeTable.createdAt})`),
      asc(userTable.id),
    );
  for (const row of rows) {
    const members = result.get(row.taskId) ?? [];
    members.push({ userId: row.userId, name: row.name });
    result.set(row.taskId, members);
  }
  return result;
}
