import { and, count, eq, gte, isNull, lt, sql } from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  columnTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import {
  getMonthKeys,
  resolveStatisticsDateRange,
} from "./statistics-date-range";

async function getProjectMonthlyStatistics(
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
) {
  const range = resolveStatisticsDateRange(startDate, endDate);
  const monthKeys = getMonthKeys(range.start, range.endExclusive);
  const taskMonth = sql<string>`to_char(date_trunc('month', ${taskTable.createdAt}), 'YYYY-MM')`;
  const activityMonth = sql<string>`to_char(date_trunc('month', ${activityTable.createdAt}), 'YYYY-MM')`;

  const [projects, createdRows, completedRows, overdueRows] = await Promise.all(
    [
      db
        .select({ id: projectTable.id, name: projectTable.name })
        .from(projectTable)
        .where(
          and(
            eq(projectTable.workspaceId, workspaceId),
            projectId ? eq(projectTable.id, projectId) : undefined,
            isNull(projectTable.archivedAt),
          ),
        )
        .orderBy(
          projectTable.position,
          projectTable.createdAt,
          projectTable.id,
        ),
      db
        .select({
          projectId: taskTable.projectId,
          month: taskMonth,
          count: count(),
        })
        .from(taskTable)
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .where(
          and(
            eq(projectTable.workspaceId, workspaceId),
            projectId ? eq(projectTable.id, projectId) : undefined,
            isNull(projectTable.archivedAt),
            gte(taskTable.createdAt, range.start),
            lt(taskTable.createdAt, range.endExclusive),
          ),
        )
        .groupBy(taskTable.projectId, taskMonth),
      db
        .select({
          projectId: taskTable.projectId,
          month: activityMonth,
          count: sql<number>`count(distinct ${taskTable.id})`,
        })
        .from(activityTable)
        .innerJoin(taskTable, eq(activityTable.taskId, taskTable.id))
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .leftJoin(
          columnTable,
          and(
            eq(columnTable.projectId, projectTable.id),
            sql`${activityTable.eventData}->>'newStatus' = ${columnTable.slug}`,
          ),
        )
        .where(
          and(
            eq(projectTable.workspaceId, workspaceId),
            projectId ? eq(projectTable.id, projectId) : undefined,
            isNull(projectTable.archivedAt),
            eq(activityTable.type, "status_changed"),
            gte(activityTable.createdAt, range.start),
            lt(activityTable.createdAt, range.endExclusive),
            sql`(${activityTable.eventData}->>'newStatus' = 'archived' or ${columnTable.isFinal} = true)`,
          ),
        )
        .groupBy(taskTable.projectId, activityMonth),
      db
        .select({
          projectId: taskTable.projectId,
          count: count(),
        })
        .from(taskTable)
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
        .where(
          and(
            eq(projectTable.workspaceId, workspaceId),
            projectId ? eq(projectTable.id, projectId) : undefined,
            isNull(projectTable.archivedAt),
            gte(taskTable.createdAt, range.start),
            lt(taskTable.createdAt, range.endExclusive),
            sql`${taskTable.dueDate} < now()`,
            sql`${taskTable.status} <> 'archived'`,
            sql`coalesce(${columnTable.isFinal}, false) = false`,
          ),
        )
        .groupBy(taskTable.projectId),
    ],
  );

  const createdByProjectMonth = new Map(
    createdRows.map((row) => [
      `${row.projectId}:${row.month}`,
      Number(row.count),
    ]),
  );
  const completedByProjectMonth = new Map(
    completedRows.map((row) => [
      `${row.projectId}:${row.month}`,
      Number(row.count),
    ]),
  );
  const overdueByProject = new Map(
    overdueRows.map((row) => [row.projectId, Number(row.count)]),
  );

  return projects.map((project) => ({
    projectId: project.id,
    projectName: project.name,
    overdueTasks: overdueByProject.get(project.id) ?? 0,
    months: monthKeys.map((month) => ({
      month,
      createdTasks: createdByProjectMonth.get(`${project.id}:${month}`) ?? 0,
      completedTasks:
        completedByProjectMonth.get(`${project.id}:${month}`) ?? 0,
    })),
  }));
}

export default getProjectMonthlyStatistics;
