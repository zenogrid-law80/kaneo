import { nullableResponseTimestamp, z } from "../openapi";

export const workspaceMemberSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
    role: z.string().openapi({
      description:
        "The member's workspace role: a built-in role (owner, admin, member, guest) or a custom role name.",
    }),
  })
  .openapi("WorkspaceMember");

export const workspaceMemberListSchema = z.array(workspaceMemberSchema);

const overdueTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  projectId: z.string(),
});

export const workspaceMemberStatisticSchema = z
  .object({
    userId: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
    assignedTasks: z.number().int().nonnegative(),
    completedTasks: z.number().int().nonnegative(),
    overdueTasks: z.number().int().nonnegative(),
    overdueTaskItems: z.array(overdueTaskSchema),
    inProgressTasks: z.number().int().nonnegative(),
    completionRate: z.number().int().min(0).max(100),
  })
  .openapi("WorkspaceMemberStatistic");

export const workspaceMemberStatisticListSchema = z.array(
  workspaceMemberStatisticSchema,
);

const projectMonthlyStatisticPointSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  createdTasks: z.number().int().nonnegative(),
  completedTasks: z.number().int().nonnegative(),
});

export const projectMonthlyStatisticSchema = z
  .object({
    projectId: z.string(),
    projectName: z.string(),
    overdueTasks: z.number().int().nonnegative(),
    overdueTaskItems: z.array(overdueTaskSchema),
    months: z.array(projectMonthlyStatisticPointSchema),
  })
  .openapi("ProjectMonthlyStatistic");

export const projectMonthlyStatisticListSchema = z.array(
  projectMonthlyStatisticSchema,
);

const memberMonthlyStatisticSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  overdueTasks: z.number().int().nonnegative(),
  overdueTaskItems: z.array(overdueTaskSchema),
  months: z.array(projectMonthlyStatisticPointSchema),
});

const teamMonthlyStatisticSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  overdueTasks: z.number().int().nonnegative(),
  overdueTaskItems: z.array(overdueTaskSchema),
  userIds: z.array(z.string()),
  months: z.array(projectMonthlyStatisticPointSchema),
});

export const memberTeamMonthlyStatisticsSchema = z
  .object({
    members: z.array(memberMonthlyStatisticSchema),
    teams: z.array(teamMonthlyStatisticSchema),
  })
  .openapi("MemberTeamMonthlyStatistics");

export const workspaceTeamSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    userIds: z.array(z.string()),
  })
  .openapi("WorkspaceTeam");

export const workspaceTeamListSchema = z.array(workspaceTeamSchema);

export const myTasksSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string(),
          title: z.string(),
          number: z.number().nullable(),
          priority: z.string().nullable(),
          dueDate: nullableResponseTimestamp,
          projectId: z.string(),
          projectName: z.string(),
          projectSlug: z.string(),
        })
        .openapi("MyTask"),
    ),
    hasMore: z.boolean(),
  })
  .openapi("MyTasks");
