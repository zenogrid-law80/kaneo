import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  createMilestone,
  deleteMilestone,
  getMilestone,
  listMilestones,
  listMilestoneTasks,
  updateMilestone,
} from "./controllers/milestones";
import { requireMilestoneCreatePermission } from "./controllers/require-milestone-create-permission";
import { getCurrentMilestone } from "./controllers/current-milestone";
import {
  currentMilestoneSchema,
  deleteMilestoneSchema,
  milestoneListSchema,
  milestoneSchema,
  milestoneTaskListSchema,
  milestoneWithStatisticsSchema,
} from "./response";
import {
  createMilestoneBody,
  listMilestonesQuery,
  milestoneParam,
  milestoneProjectParam,
  milestoneTasksQuery,
  updateMilestoneBody,
} from "./schema";

const errors = {
  400: errorResponse("Invalid input or milestone/project mismatch"),
  401: errorResponse("Authentication required"),
  403: errorResponse("No workspace access or insufficient permissions"),
  404: errorResponse("Milestone not found"),
  409: errorResponse("Milestone is closed or changed concurrently"),
};

const listRoute = createRoute({
  method: "get",
  path: "/project/{projectId}",
  operationId: "listMilestones",
  tags: ["Milestones"],
  summary: "List milestones",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["read"], task: ["read"] }),
  ] as const,
  request: { params: milestoneProjectParam, query: listMilestonesQuery },
  responses: {
    200: jsonResponse("List milestones", milestoneListSchema),
    ...errors,
  },
});

const createMilestoneRoute = createRoute({
  method: "post",
  path: "/project/{projectId}",
  operationId: "createMilestone",
  tags: ["Milestones"],
  summary: "Create milestone",
  description:
    "Only workspace owners and administrators can create milestones. Requires project:update and matching API key scopes.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
    requireMilestoneCreatePermission,
  ] as const,
  request: {
    params: milestoneProjectParam,
    body: {
      required: true,
      content: { "application/json": { schema: createMilestoneBody } },
    },
  },
  responses: {
    200: jsonResponse("Create milestone", milestoneSchema),
    ...errors,
    403: errorResponse(
      "Requires workspace owner/admin role and project:update permission",
    ),
  },
});

const currentRoute = createRoute({
  method: "get",
  path: "/project/{projectId}/current",
  operationId: "getCurrentMilestone",
  tags: ["Milestones"],
  summary: "Get the project's current milestone",
  description:
    "Returns the open milestone used by default for project views and new tasks, or null when none is designated.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["read"], task: ["read"] }),
  ] as const,
  request: { params: milestoneProjectParam },
  responses: {
    200: jsonResponse("Current milestone", currentMilestoneSchema),
    ...errors,
  },
});

const getRoute = createRoute({
  method: "get",
  path: "/{id}",
  operationId: "getMilestone",
  tags: ["Milestones"],
  summary: "Get milestone",
  middleware: [
    workspaceAccess.fromMilestone(),
    requireWorkspacePermission({ project: ["read"], task: ["read"] }),
  ] as const,
  request: { params: milestoneParam },
  responses: {
    200: jsonResponse("Get milestone", milestoneWithStatisticsSchema),
    ...errors,
  },
});

const tasksRoute = createRoute({
  method: "get",
  path: "/{id}/tasks",
  operationId: "tasksMilestone",
  tags: ["Milestones"],
  summary: "List milestone tasks",
  middleware: [
    workspaceAccess.fromMilestone(),
    requireWorkspacePermission({ project: ["read"], task: ["read"] }),
  ] as const,
  request: { params: milestoneParam, query: milestoneTasksQuery },
  responses: {
    200: jsonResponse("List milestone tasks", milestoneTaskListSchema),
    ...errors,
  },
});

const updateRoute = createRoute({
  method: "patch",
  path: "/{id}",
  operationId: "updateMilestone",
  tags: ["Milestones"],
  summary: "Update, designate as current, or close/reopen milestone",
  description:
    "Setting isCurrent replaces the previous current milestone. Closing a current milestone clears the default; reopening does not restore it.",
  middleware: [
    workspaceAccess.fromMilestone(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: milestoneParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateMilestoneBody } },
    },
  },
  responses: {
    200: jsonResponse("Update or close/reopen milestone", milestoneSchema),
    ...errors,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  operationId: "deleteMilestone",
  tags: ["Milestones"],
  summary: "Delete milestone and detach its tasks",
  middleware: [
    workspaceAccess.fromMilestone(),
    requireWorkspacePermission({ project: ["update"], task: ["update"] }),
  ] as const,
  request: { params: milestoneParam },
  responses: {
    200: jsonResponse(
      "Delete milestone and detach its tasks",
      deleteMilestoneSchema,
    ),
    ...errors,
  },
});

const milestone = apiRouter()
  .openapi(currentRoute, async (c) =>
    c.json(await getCurrentMilestone(c.req.valid("param").projectId), 200),
  )
  .openapi(listRoute, async (c) =>
    c.json(
      await listMilestones(
        c.req.valid("param").projectId,
        c.req.valid("query"),
      ),
      200,
    ),
  )
  .openapi(createMilestoneRoute, async (c) =>
    c.json(
      await createMilestone(
        c.req.valid("param").projectId,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(getRoute, async (c) =>
    c.json(await getMilestone(c.req.valid("param").id), 200),
  )
  .openapi(tasksRoute, async (c) =>
    c.json(
      await listMilestoneTasks(c.req.valid("param").id, c.req.valid("query")),
      200,
    ),
  )
  .openapi(updateRoute, async (c) =>
    c.json(
      await updateMilestone(c.req.valid("param").id, c.req.valid("json")),
      200,
    ),
  )
  .openapi(deleteRoute, async (c) =>
    c.json(
      await deleteMilestone(c.req.valid("param").id, c.get("userId")),
      200,
    ),
  );

export default milestone;
