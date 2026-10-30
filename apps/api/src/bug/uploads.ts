import type { Context, Next } from "hono";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireEntitlement } from "../billing/require-entitlement-middleware";
import { stageAssetUpload, finalizeStagedAsset } from "../storage/stage-asset";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { normalizeApiServerUrl } from "../utils/openapi-spec";
import { bugProjectParam } from "./schema";
import { getBug } from "./controllers/bugs";

const uploadBody = z.strictObject({
  bugId: z
    .string()
    .min(1)
    .optional()
    .describe("Existing bug being edited; omit for a new report"),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  size: z.number().int().positive(),
});
async function uploadPermission(c: Context, next: Next) {
  const body: unknown = await c.req.json().catch(() => null);
  const bugId =
    body && typeof body === "object" && "bugId" in body
      ? body.bugId
      : undefined;
  return requireWorkspacePermission({
    task: [typeof bugId === "string" ? "update" : "create"],
  })(c, async () => {
    if (typeof bugId === "string")
      await getBug(c.req.param("projectId")!, bugId);
    await next();
  });
}
const middleware = [
  workspaceAccess.fromProject("projectId"),
  uploadPermission,
  requireEntitlement,
] as const;
const errors = {
  400: errorResponse("Invalid upload"),
  403: errorResponse(
    "Missing workspace access or bug create/update permission",
  ),
  404: errorResponse("Project or bug not found"),
  409: errorResponse("Upload already attached"),
  503: errorResponse("Storage unavailable"),
};
const stageRoute = createRoute({
  method: "post",
  path: "/project/{projectId}/uploads",
  operationId: "stageBugAssetUpload",
  tags: ["Bugs"],
  summary: "Stage an image, video or file for a bug description",
  description:
    "Staged uploads are private to the uploader and expire after 24 hours. Saving the bug attaches referenced uploads to it.",
  middleware: [...middleware],
  request: {
    params: bugProjectParam,
    body: {
      required: true,
      content: { "application/json": { schema: uploadBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "Presigned upload",
      z.object({
        key: z.string(),
        uploadUrl: z.string(),
        headers: z.record(z.string(), z.string()),
      }),
    ),
    ...errors,
  },
});
const finalizeRoute = createRoute({
  method: "post",
  path: "/project/{projectId}/uploads/finalize",
  operationId: "finalizeBugAssetUpload",
  tags: ["Bugs"],
  summary: "Verify a staged bug attachment and return its private URL",
  middleware: [...middleware],
  request: {
    params: bugProjectParam,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: uploadBody.extend({ key: z.string().min(1) }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse(
      "Verified attachment",
      z.object({ id: z.string(), url: z.string() }),
    ),
    ...errors,
  },
});
export default apiRouter()
  .openapi(stageRoute, async (c) =>
    c.json(
      await stageAssetUpload(
        c.req.valid("param").projectId,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(finalizeRoute, async (c) => {
    const asset = await finalizeStagedAsset(
      c.req.valid("param").projectId,
      c.get("userId"),
      c.req.valid("json"),
    );
    const base = normalizeApiServerUrl(
      process.env.KANEO_API_URL || new URL(c.req.url).origin,
    );
    return c.json({ id: asset.id, url: `${base}/asset/${asset.id}` }, 200);
  });
