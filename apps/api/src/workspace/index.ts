import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getWorkspaceMembersCtrl from "./controllers/get-workspace-members";
import getWorkspaceTeamsCtrl from "./controllers/get-workspace-teams";
import { workspaceMemberListSchema, workspaceTeamListSchema } from "./response";
import { workspaceIdParam } from "./schema";

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

const workspace = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getWorkspaceMembersRoute, async (c) =>
    c.json(await getWorkspaceMembersCtrl(c.get("workspaceId")), 200),
  )
  .openapi(getWorkspaceTeamsRoute, async (c) =>
    c.json(await getWorkspaceTeamsCtrl(c.get("workspaceId")), 200),
  );

export default workspace;
