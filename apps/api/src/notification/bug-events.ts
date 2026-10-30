import { eq } from "drizzle-orm";
import db from "../database";
import { projectTable } from "../database/schema";
import { subscribeToEvent } from "../events";
import type { BugNotificationEvent } from "../bug/event-types";
import createNotification from "./controllers/create-notification";

for (const event of ["bug.created", "bug.assignees_changed"] as const) {
  subscribeToEvent<BugNotificationEvent>(event, async (data) => {
    const [project] = await db
      .select({ workspaceId: projectTable.workspaceId })
      .from(projectTable)
      .where(eq(projectTable.id, data.projectId))
      .limit(1);
    if (!project) return;
    const recipients = new Set(data.assignments.map(({ userId }) => userId));
    for (const userId of recipients) {
      // Match task creation: do not notify the creator about their own new item.
      if (event === "bug.created" && userId === data.userId) continue;
      await createNotification({
        userId,
        type: event === "bug.created" ? "bug_created" : "bug_assigned",
        resourceId: data.bugId,
        resourceType: "bug",
        eventData: {
          bugTitle: data.title,
          projectId: data.projectId,
          workspaceId: project.workspaceId,
          roles: data.assignments
            .filter((assignment) => assignment.userId === userId)
            .map(({ role }) => role),
        },
      });
    }
  });
}
