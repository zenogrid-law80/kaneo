import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../../openapi";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { bugParam } from "../schema";
import {
  createBugComment,
  deleteBugComment,
  listBugComments,
  updateBugComment,
} from "./controllers";
import { bugCommentSchema, bugCommentsSchema } from "./response";
import { bugCommentBody, bugCommentParam, bugCommentsQuery } from "./schema";

const errors = {
  400: errorResponse("Invalid comment or project"),
  403: errorResponse("No workspace access or insufficient permission"),
  404: errorResponse(
    "Bug or comment not found, or comment belongs to another author",
  ),
};
const writeMiddleware = [
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ task: ["update"] }),
] as const;
const body = {
  required: true as const,
  content: { "application/json": { schema: bugCommentBody } },
};

const comments = apiRouter()
  .openapi(
    createRoute({
      method: "get",
      path: "/project/{projectId}/{id}/comments",
      operationId: "listBugComments",
      tags: ["Bugs"],
      summary: "List bug comments, newest first (20 per page)",
      middleware: [
        workspaceAccess.fromProject("projectId"),
        requireWorkspacePermission({ project: ["read"], task: ["read"] }),
      ] as const,
      request: { params: bugParam, query: bugCommentsQuery },
      responses: {
        200: jsonResponse(
          "Bug comments with author and timestamps",
          bugCommentsSchema,
        ),
        ...errors,
      },
    }),
    async (c) => {
      const { projectId, id } = c.req.valid("param");
      return c.json(
        await listBugComments(projectId, id, c.req.valid("query").page),
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/project/{projectId}/{id}/comments",
      operationId: "createBugComment",
      tags: ["Bugs"],
      summary: "Add a Markdown comment to a bug",
      middleware: [...writeMiddleware],
      request: { params: bugParam, body },
      responses: {
        200: jsonResponse("Created comment", bugCommentSchema),
        ...errors,
      },
    }),
    async (c) => {
      const { projectId, id } = c.req.valid("param");
      return c.json(
        await createBugComment(
          projectId,
          id,
          c.get("userId"),
          c.req.valid("json").content,
        ),
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "patch",
      path: "/project/{projectId}/{id}/comments/{commentId}",
      operationId: "updateBugComment",
      tags: ["Bugs"],
      summary: "Edit your own bug comment",
      middleware: [...writeMiddleware],
      request: { params: bugCommentParam, body },
      responses: {
        200: jsonResponse("Updated comment", bugCommentSchema),
        ...errors,
      },
    }),
    async (c) => {
      const { projectId, id, commentId } = c.req.valid("param");
      return c.json(
        await updateBugComment(
          projectId,
          id,
          commentId,
          c.get("userId"),
          c.req.valid("json").content,
        ),
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "delete",
      path: "/project/{projectId}/{id}/comments/{commentId}",
      operationId: "deleteBugComment",
      tags: ["Bugs"],
      summary: "Delete your own bug comment and its attachments",
      middleware: [...writeMiddleware],
      request: { params: bugCommentParam },
      responses: {
        200: jsonResponse(
          "Deleted comment",
          z.object({ success: z.boolean() }),
        ),
        ...errors,
      },
    }),
    async (c) => {
      const { projectId, id, commentId } = c.req.valid("param");
      return c.json(
        await deleteBugComment(projectId, id, commentId, c.get("userId")),
        200,
      );
    },
  );
export default comments;
