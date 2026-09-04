import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  projectTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import { resolveStatisticsDateRange } from "./statistics-date-range";

async function getWorkspaceMemberStatistics(
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
) {
  const range = resolveStatisticsDateRange(startDate, endDate);
  const rows = await db
    .select({
      userId: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      assignedTasks: sql<number>`count(${taskTable.id})`,
      completedTasks: sql<number>`count(${taskTable.id}) filter (where ${taskTable.status} = 'archived' or ${columnTable.isFinal} = true)`,
      overdueTasks: sql<number>`count(${taskTable.id}) filter (where ${taskTable.dueDate} < now() and ${taskTable.status} <> 'archived' and coalesce(${columnTable.isFinal}, false) = false)`,
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(workspaceUserTable.userId, userTable.id))
    .leftJoin(
      projectTable,
      and(
        eq(projectTable.workspaceId, workspaceUserTable.workspaceId),
        isNull(projectTable.archivedAt),
        projectId ? eq(projectTable.id, projectId) : undefined,
      ),
    )
    .leftJoin(
      taskTable,
      and(
        eq(taskTable.projectId, projectTable.id),
        eq(taskTable.userId, workspaceUserTable.userId),
        gte(taskTable.createdAt, range.start),
        lt(taskTable.createdAt, range.endExclusive),
      ),
    )
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(eq(workspaceUserTable.workspaceId, workspaceId))
    .groupBy(userTable.id)
    .orderBy(userTable.name, userTable.id);

  return rows.map((row) => {
    const assignedTasks = Number(row.assignedTasks);
    const completedTasks = Number(row.completedTasks);
    const overdueTasks = Number(row.overdueTasks);

    return {
      userId: row.userId,
      name: row.name,
      email: row.email,
      image: row.image,
      assignedTasks,
      completedTasks,
      overdueTasks,
      inProgressTasks: assignedTasks - completedTasks,
      completionRate:
        assignedTasks > 0
          ? Math.round((completedTasks / assignedTasks) * 100)
          : 0,
    };
  });
}

export default getWorkspaceMemberStatistics;
