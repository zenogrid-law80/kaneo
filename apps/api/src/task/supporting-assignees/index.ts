import { requireEntitlement } from "../../billing/require-entitlement-middleware";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../../openapi";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { taskParam } from "../schema";
import clearSupportingAssignees from "./clear-supporting-assignees";
import getSupportingAssignees from "./get-supporting-assignees";
import setSupportingAssignee from "./set-supporting-assignee";
import { supportingAssigneeParam, supportingAssigneesSchema } from "./schema";

const readRoute = createRoute({
  method: "get",
  path: "/{id}",
  operationId: "getTaskSupportingAssignees",
  tags: ["Tasks"],
  summary: "List task supporting assignees",
  description:
    "Lists current workspace members designated as supporting assignees. This role does not grant permissions or subscribe members to notifications.",
  middleware: [
    workspaceAccess.fromTask(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: taskParam },
  responses: {
    200: jsonResponse("Supporting assignees", supportingAssigneesSchema),
    400: errorResponse("Unknown task"),
    403: errorResponse("No task read access"),
  },
});

const mutationMiddleware = [
  workspaceAccess.fromTask(),
  requireWorkspacePermission({ task: ["assign"] }),
  requireEntitlement,
] as const;
const responses = {
  204: { description: "Supporting assignment saved" },
  400: errorResponse("Unknown task, non-member or primary assignee selected"),
  403: errorResponse("No workspace access or missing task:assign permission"),
  404: errorResponse("Task not found in the authorized workspace"),
  409: errorResponse("Task moved concurrently; retry the request"),
};
const addRoute = createRoute({
  method: "put",
  path: "/{id}/{userId}",
  operationId: "addTaskSupportingAssignee",
  tags: ["Tasks"],
  summary: "Add a task supporting assignee",
  description:
    "Idempotently adds a current workspace member other than the primary assignee. The primary assignee, permissions and notifications are unchanged. Statistics can opt in to include supporting participation.",
  middleware: [...mutationMiddleware] as const,
  request: { params: supportingAssigneeParam },
  responses,
});
const removeRoute = createRoute({
  method: "delete",
  path: "/{id}/{userId}",
  operationId: "removeTaskSupportingAssignee",
  tags: ["Tasks"],
  summary: "Remove a task supporting assignee",
  description:
    "Idempotently removes a supporting assignment. The primary assignee is unchanged.",
  middleware: [...mutationMiddleware] as const,
  request: { params: supportingAssigneeParam },
  responses,
});

const clearRoute = createRoute({
  method: "delete",
  path: "/{id}",
  operationId: "clearTaskSupportingAssignees",
  tags: ["Tasks"],
  summary: "Remove all task supporting assignees",
  description:
    "Atomically removes all supporting assignments and records removal activity for each member. Repeating the request is a no-op. The primary assignee is unchanged.",
  middleware: [...mutationMiddleware] as const,
  request: { params: taskParam },
  responses,
});

export default apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(readRoute, async (c) =>
    c.json(
      await getSupportingAssignees(
        c.req.valid("param").id,
        c.get("workspaceId"),
      ),
      200,
    ),
  )
  .openapi(clearRoute, async (c) => {
    await clearSupportingAssignees({
      taskId: c.req.valid("param").id,
      workspaceId: c.get("workspaceId"),
      actorId: c.get("userId"),
    });
    return c.body(null, 204);
  })
  .openapi(addRoute, async (c) => {
    const { id, userId } = c.req.valid("param");
    await setSupportingAssignee({
      taskId: id,
      userId,
      workspaceId: c.get("workspaceId"),
      actorId: c.get("userId"),
      assigned: true,
    });
    return c.body(null, 204);
  })
  .openapi(removeRoute, async (c) => {
    const { id, userId } = c.req.valid("param");
    await setSupportingAssignee({
      taskId: id,
      userId,
      workspaceId: c.get("workspaceId"),
      actorId: c.get("userId"),
      assigned: false,
    });
    return c.body(null, 204);
  });
