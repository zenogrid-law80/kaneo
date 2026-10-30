import {
  apiRouter,
  z,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { requireBugAssignmentPermission } from "./require-bug-assignment-permission";
import {
  createBug,
  deleteBug,
  getBug,
  listBugs,
  updateBug,
} from "./controllers/bugs";
import { getBugTemplate, updateBugTemplate } from "./controllers/template";
import {
  bugSchema,
  bugHistorySchema,
  bugListSchema,
  bugTemplateSchema,
  deleteBugSchema,
} from "./response";
import {
  bugParam,
  bugProjectParam,
  listBugsQuery,
  createBugBody,
  updateBugBody,
  bugTemplateBody,
} from "./schema";

import bugUploads from "./uploads";
import bugComments from "./comments";
import { getBugHistory } from "./controllers/history";

const errors = {
  409: errorResponse("Reopen the milestone before assigning bugs"),
  400: errorResponse("Invalid input or unknown project"),
  403: errorResponse("No workspace access or insufficient permissions"),
  404: errorResponse("Bug not found in this project"),
};

const listRoute = createRoute({
  method: "get",
  path: "/project/{projectId}",
  operationId: "listBugs",
  tags: ["Bugs"],
  summary: "List bugs separately from tasks",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["read"], task: ["read"] }),
  ] as const,
  request: { params: bugProjectParam, query: listBugsQuery },
  responses: {
    200: jsonResponse("List bugs separately from tasks", bugListSchema),
    ...errors,
  },
});

const templateGetRoute = createRoute({
  method: "get",
  path: "/project/{projectId}/template",
  operationId: "getBugTemplate",
  tags: ["Bugs"],
  summary: "Get the template used for new bugs",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: bugProjectParam },
  responses: {
    200: jsonResponse("Get the template used for new bugs", bugTemplateSchema),
    ...errors,
  },
});

const templateUpdateRoute = createRoute({
  method: "put",
  path: "/project/{projectId}/template",
  operationId: "updateBugTemplate",
  tags: ["Bugs"],
  summary: "Update or reset the template for future bugs",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: bugProjectParam,
    body: {
      required: true,
      content: { "application/json": { schema: bugTemplateBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "Update or reset the template for future bugs",
      bugTemplateSchema,
    ),
    ...errors,
  },
});

const createBugRoute = createRoute({
  method: "post",
  path: "/project/{projectId}",
  operationId: "createBug",
  tags: ["Bugs"],
  summary: "Create a bug in New status without parent or child tasks",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ task: ["create"] }),
    requireBugAssignmentPermission,
  ] as const,
  request: {
    params: bugProjectParam,
    body: {
      required: true,
      content: { "application/json": { schema: createBugBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "Create a bug in New status without parent or child tasks",
      bugSchema,
    ),
    ...errors,
  },
});

const getRoute = createRoute({
  method: "get",
  path: "/project/{projectId}/{id}",
  operationId: "getBug",
  tags: ["Bugs"],
  summary: "Get a bug",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["read"], task: ["read"] }),
  ] as const,
  request: { params: bugParam },
  responses: { 200: jsonResponse("Get a bug", bugSchema), ...errors },
});

const updateRoute = createRoute({
  method: "patch",
  path: "/project/{projectId}/{id}",
  operationId: "updateBug",
  tags: ["Bugs"],
  summary: "Edit a bug or move it between New, In Progress and Resolved",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ task: ["update"] }),
    requireBugAssignmentPermission,
  ] as const,
  request: {
    params: bugParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateBugBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "Edit a bug or move it between New, In Progress and Resolved",
      bugSchema,
    ),
    ...errors,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/project/{projectId}/{id}",
  operationId: "deleteBug",
  tags: ["Bugs"],
  summary: "Delete a bug",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ task: ["delete"] }),
  ] as const,
  request: { params: bugParam },
  responses: { 200: jsonResponse("Delete a bug", deleteBugSchema), ...errors },
});

const historyRoute = createRoute({
  method: "get",
  path: "/project/{projectId}/{id}/history",
  operationId: "getBugHistory",
  tags: ["Bugs"],
  summary: "Read bug changes with actor, timestamp and before/after values",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["read"], task: ["read"] }),
  ] as const,
  request: {
    params: bugParam,
    query: z.object({
      page: z.coerce.number().int().min(1).max(100000).default(1),
    }),
  },
  responses: {
    200: jsonResponse(
      "Bug change history, newest first (20 per page)",
      bugHistorySchema,
    ),
    ...errors,
  },
});

const bugs = apiRouter()
  .route("/", bugComments)
  .route("/", bugUploads)
  .openapi(historyRoute, async (c) => {
    const { projectId, id } = c.req.valid("param");
    return c.json(
      await getBugHistory(projectId, id, c.req.valid("query").page),
      200,
    );
  })
  .openapi(listRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    return c.json(await listBugs(projectId, c.req.valid("query")), 200);
  })
  .openapi(templateGetRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    return c.json(await getBugTemplate(projectId), 200);
  })
  .openapi(templateUpdateRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    return c.json(
      await updateBugTemplate(projectId, c.req.valid("json").template),
      200,
    );
  })
  .openapi(createBugRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    return c.json(
      await createBug(projectId, c.req.valid("json"), c.get("userId")),
      200,
    );
  })
  .openapi(getRoute, async (c) => {
    const { projectId, id } = c.req.valid("param");
    return c.json(await getBug(projectId, id), 200);
  })
  .openapi(updateRoute, async (c) => {
    const { projectId, id } = c.req.valid("param");
    return c.json(
      await updateBug(projectId, id, c.req.valid("json"), c.get("userId")),
      200,
    );
  })
  .openapi(deleteRoute, async (c) => {
    const { projectId, id } = c.req.valid("param");
    return c.json(await deleteBug(projectId, id), 200);
  });
export default bugs;
