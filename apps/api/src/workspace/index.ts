import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getMemberTeamMonthlyStatisticsCtrl from "./controllers/get-member-team-monthly-statistics";
import getMyTasks from "./controllers/get-my-tasks";
import getProjectMonthlyStatisticsCtrl from "./controllers/get-project-monthly-statistics";
import getWorkspaceMemberStatisticsCtrl from "./controllers/get-workspace-member-statistics";
import getWorkspaceMembersCtrl from "./controllers/get-workspace-members";
import getWorkspaceTeamsCtrl from "./controllers/get-workspace-teams";
import {
  memberTeamMonthlyStatisticsSchema,
  myTasksSchema,
  projectMonthlyStatisticListSchema,
  workspaceMemberListSchema,
  workspaceMemberStatisticListSchema,
  workspaceTeamListSchema,
} from "./response";
import { myTasksQuery, statisticsQuery, workspaceIdParam } from "./schema";

const getWorkspaceMembersRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceMembers",
  path: "/{workspaceId}/members",
  tags: ["Workspaces"],
  summary: "Get workspace members",
  description: "Get all members of a workspace, with their role.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("List of workspace members", workspaceMemberListSchema),
    400: errorResponse("Workspace ID could not be determined"),
    403: errorResponse("No access to the workspace"),
  },
});

const getWorkspaceTeamsRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceTeams",
  path: "/{workspaceId}/teams",
  tags: ["Workspaces"],
  summary: "Get workspace teams",
  description:
    "Get every team in a workspace with its member user IDs. Workspace membership is sufficient; the caller does not need to belong to each team.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("List of workspace teams", workspaceTeamListSchema),
    400: errorResponse("Workspace ID could not be determined"),
    403: errorResponse("No access to the workspace"),
  },
});

const getWorkspaceMemberStatisticsRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceMemberStatistics",
  path: "/{workspaceId}/member-statistics",
  tags: ["Workspaces"],
  summary: "Get workspace member statistics",
  description:
    "Get assigned, completed, and in-progress task counts and completion rates for every workspace member. Archived projects are excluded.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ workspace: ["update", "manage_settings"] }),
  ] as const,
  request: { params: workspaceIdParam, query: statisticsQuery },
  responses: {
    200: jsonResponse(
      "Task statistics for each workspace member",
      workspaceMemberStatisticListSchema,
    ),
    400: errorResponse("Workspace ID could not be determined"),
    403: errorResponse("No access to the workspace"),
  },
});

const getProjectMonthlyStatisticsRoute = createRoute({
  method: "get",
  operationId: "getProjectMonthlyStatistics",
  path: "/{workspaceId}/project-monthly-statistics",
  tags: ["Workspaces"],
  summary: "Get project monthly statistics",
  description:
    "Get monthly created and completed task counts for each active project over the last 12 calendar months.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ workspace: ["update", "manage_settings"] }),
  ] as const,
  request: { params: workspaceIdParam, query: statisticsQuery },
  responses: {
    200: jsonResponse(
      "Monthly task statistics for each project",
      projectMonthlyStatisticListSchema,
    ),
    400: errorResponse("Workspace ID could not be determined"),
    403: errorResponse("No access to the workspace"),
  },
});

const getMemberTeamMonthlyStatisticsRoute = createRoute({
  method: "get",
  operationId: "getMemberTeamMonthlyStatistics",
  path: "/{workspaceId}/member-team-monthly-statistics",
  tags: ["Workspaces"],
  summary: "Get member and team monthly statistics",
  description:
    "Get monthly created and completed task counts for each workspace member and team over the last 12 calendar months.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ workspace: ["update", "manage_settings"] }),
  ] as const,
  request: { params: workspaceIdParam, query: statisticsQuery },
  responses: {
    200: jsonResponse(
      "Monthly task statistics for members and teams",
      memberTeamMonthlyStatisticsSchema,
    ),
    400: errorResponse("Workspace ID could not be determined"),
    403: errorResponse("No access to the workspace"),
  },
});

const getMyTasksRoute = createRoute({
  method: "get",
  operationId: "getMyTasks",
  path: "/{workspaceId}/my-tasks",
  tags: ["Workspaces"],
  summary: "Get my open tasks",
  description:
    "Get 12 open tasks assigned to the authenticated user in this workspace, ordered by due date (undated tasks last). Excludes archived projects and final columns. Date filters are applied before pagination using the supplied local-day boundaries.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam, query: myTasksQuery },
  responses: {
    200: jsonResponse("My open tasks", myTasksSchema),
    400: errorResponse("Invalid page or workspace"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("No access to tasks in this workspace"),
  },
});

const workspace = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getMyTasksRoute, async (c) =>
    c.json(
      await getMyTasks(
        c.get("workspaceId"),
        c.get("userId"),
        c.req.valid("query").page,
        c.req.valid("query").due,
        c.req.valid("query").dayStart,
        c.req.valid("query").dayEnd,
      ),
      200,
    ),
  )
  .openapi(getWorkspaceMembersRoute, async (c) =>
    c.json(await getWorkspaceMembersCtrl(c.get("workspaceId")), 200),
  )
  .openapi(getWorkspaceTeamsRoute, async (c) =>
    c.json(await getWorkspaceTeamsCtrl(c.get("workspaceId")), 200),
  )
  .openapi(getWorkspaceMemberStatisticsRoute, async (c) => {
    const { projectId, startDate, endDate } = c.req.valid("query");
    return c.json(
      await getWorkspaceMemberStatisticsCtrl(
        c.get("workspaceId"),
        projectId,
        startDate,
        endDate,
      ),
      200,
    );
  })
  .openapi(getProjectMonthlyStatisticsRoute, async (c) => {
    const { projectId, startDate, endDate } = c.req.valid("query");
    return c.json(
      await getProjectMonthlyStatisticsCtrl(
        c.get("workspaceId"),
        projectId,
        startDate,
        endDate,
      ),
      200,
    );
  })
  .openapi(getMemberTeamMonthlyStatisticsRoute, async (c) => {
    const { projectId, startDate, endDate } = c.req.valid("query");
    return c.json(
      await getMemberTeamMonthlyStatisticsCtrl(
        c.get("workspaceId"),
        projectId,
        startDate,
        endDate,
      ),
      200,
    );
  });

export default workspace;
