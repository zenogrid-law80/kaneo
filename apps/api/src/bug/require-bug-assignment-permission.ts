import type { Context, Next } from "hono";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";

export async function requireBugAssignmentPermission(c: Context, next: Next) {
  const body: unknown = await c.req.json().catch(() => null);
  if (
    body &&
    typeof body === "object" &&
    ("reporterId" in body || "fixerId" in body || "verifierId" in body)
  ) {
    return requireWorkspacePermission({ task: ["assign"] })(c, next);
  }
  return next();
}
