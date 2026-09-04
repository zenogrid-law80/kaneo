import { and, count, eq, gte, isNull, lt, sql } from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  columnTable,
  projectTable,
  taskTable,
  teamMemberTable,
  teamTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import {
  getMonthKeys,
  resolveStatisticsDateRange,
} from "./statistics-date-range";

type MonthlyCounts = { createdTasks: number; completedTasks: number };

async function getMemberTeamMonthlyStatistics(
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
) {
  const range = resolveStatisticsDateRange(startDate, endDate);
  const monthKeys = getMonthKeys(range.start, range.endExclusive);
  const taskMonth = sql<string>`to_char(date_trunc('month', ${taskTable.createdAt}), 'YYYY-MM')`;
  const activityMonth = sql<string>`to_char(date_trunc('month', ${activityTable.createdAt}), 'YYYY-MM')`;

  const [
    members,
    teams,
    teamMemberships,
    createdRows,
    completedRows,
    overdueRows,
  ] = await Promise.all([
    db
      .select({
        userId: userTable.id,
        name: userTable.name,
        email: userTable.email,
        image: userTable.image,
      })
      .from(workspaceUserTable)
      .innerJoin(userTable, eq(workspaceUserTable.userId, userTable.id))
      .where(eq(workspaceUserTable.workspaceId, workspaceId))
      .orderBy(userTable.name, userTable.id),
    db
      .select({ id: teamTable.id, name: teamTable.name })
      .from(teamTable)
      .where(eq(teamTable.workspaceId, workspaceId))
      .orderBy(teamTable.name, teamTable.id),
    db
      .select({
        teamId: teamMemberTable.teamId,
        userId: teamMemberTable.userId,
      })
      .from(teamMemberTable)
      .innerJoin(teamTable, eq(teamMemberTable.teamId, teamTable.id))
      .where(eq(teamTable.workspaceId, workspaceId)),
    db
      .select({
        userId: taskTable.userId,
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
          sql`${taskTable.userId} is not null`,
        ),
      )
      .groupBy(taskTable.userId, taskMonth),
    db
      .select({
        userId: taskTable.userId,
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
          sql`${taskTable.userId} is not null`,
          sql`(${activityTable.eventData}->>'newStatus' = 'archived' or ${columnTable.isFinal} = true)`,
        ),
      )
      .groupBy(taskTable.userId, activityMonth),
    db
      .select({
        userId: taskTable.userId,
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
          sql`${taskTable.userId} is not null`,
          gte(taskTable.createdAt, range.start),
          lt(taskTable.createdAt, range.endExclusive),
          sql`${taskTable.dueDate} < now()`,
          sql`${taskTable.status} <> 'archived'`,
          sql`coalesce(${columnTable.isFinal}, false) = false`,
        ),
      )
      .groupBy(taskTable.userId),
  ]);

  const overdueByUser = new Map(
    overdueRows.flatMap((row) =>
      row.userId ? [[row.userId, Number(row.count)] as const] : [],
    ),
  );

  const countsByUserMonth = new Map<string, MonthlyCounts>();
  for (const row of createdRows) {
    if (!row.userId) continue;
    countsByUserMonth.set(`${row.userId}:${row.month}`, {
      createdTasks: Number(row.count),
      completedTasks: 0,
    });
  }
  for (const row of completedRows) {
    if (!row.userId) continue;
    const key = `${row.userId}:${row.month}`;
    const existing = countsByUserMonth.get(key);
    countsByUserMonth.set(key, {
      createdTasks: existing?.createdTasks ?? 0,
      completedTasks: Number(row.count),
    });
  }

  const monthsForUsers = (userIds: string[]) =>
    monthKeys.map((month) =>
      userIds.reduce(
        (total, userId) => {
          const counts = countsByUserMonth.get(`${userId}:${month}`);
          return {
            month,
            createdTasks: total.createdTasks + (counts?.createdTasks ?? 0),
            completedTasks:
              total.completedTasks + (counts?.completedTasks ?? 0),
          };
        },
        { month, createdTasks: 0, completedTasks: 0 },
      ),
    );

  return {
    members: members.map((member) => ({
      ...member,
      overdueTasks: overdueByUser.get(member.userId) ?? 0,
      months: monthsForUsers([member.userId]),
    })),
    teams: teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      userIds: teamMemberships
        .filter((membership) => membership.teamId === team.id)
        .map((membership) => membership.userId),
      months: monthsForUsers(
        teamMemberships
          .filter((membership) => membership.teamId === team.id)
          .map((membership) => membership.userId),
      ),
      overdueTasks: teamMemberships
        .filter((membership) => membership.teamId === team.id)
        .reduce(
          (total, membership) =>
            total + (overdueByUser.get(membership.userId) ?? 0),
          0,
        ),
    })),
  };
}

export default getMemberTeamMonthlyStatistics;
