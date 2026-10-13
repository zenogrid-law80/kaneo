import { and, eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceUserTable } from "../../database/schema";

// Creation is restricted to workspace owner/admin roles even when a custom
// role has project:update. The route separately enforces permission/key scopes.
export async function requireMilestoneCreatePermission(c: Context, next: Next) {
  const [member] = await db
    .select({ role: workspaceUserTable.role })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, c.get("workspaceId")),
        eq(workspaceUserTable.userId, c.get("userId")),
      ),
    )
    .limit(1);
  if (member?.role !== "owner" && member?.role !== "admin") {
    throw new HTTPException(403, {
      message: "Only workspace owners and administrators can create milestones",
    });
  }
  return next();
}
