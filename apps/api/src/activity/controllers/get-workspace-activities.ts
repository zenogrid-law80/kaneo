import { and, eq, isNull } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";
import getWorkspaceTaskActivities from "./get-workspace-task-activities";
import getWorkspaceBugActivities from "./get-workspace-bug-activities";

export const WORKSPACE_ACTIVITY_LIMIT = 20;
const WINDOW_DAYS = 30;

async function getWorkspaceActivities(workspaceId: string) {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  // Concrete project IDs avoid scanning other tenants' recent activity to fill a quiet feed.
  const projects = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNull(projectTable.archivedAt),
      ),
    );
  if (!projects.length) return [];
  const projectIds = projects.map((project) => project.id);
  const [tasks, bugs] = await Promise.all([
    getWorkspaceTaskActivities(
      workspaceId,
      projectIds,
      since,
      WORKSPACE_ACTIVITY_LIMIT,
    ),
    getWorkspaceBugActivities(
      workspaceId,
      projectIds,
      since,
      WORKSPACE_ACTIVITY_LIMIT,
    ),
  ]);
  return [...tasks, ...bugs]
    .sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id),
    )
    .slice(0, WORKSPACE_ACTIVITY_LIMIT);
}
export default getWorkspaceActivities;
