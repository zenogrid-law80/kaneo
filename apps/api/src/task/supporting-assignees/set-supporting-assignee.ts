import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  taskSupportingAssigneeTable,
  workspaceUserTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { lockSupportingAssigneeTask } from "./lock-supporting-assignee-task";

export default async function setSupportingAssignee({
  taskId,
  workspaceId,
  userId,
  assigned,
  actorId,
}: {
  taskId: string;
  workspaceId: string;
  userId: string;
  assigned: boolean;
  actorId: string;
}) {
  const result = await db.transaction(async (tx) => {
    const task = await lockSupportingAssigneeTask(tx, taskId, workspaceId);

    if (assigned && task.userId === userId)
      throw new HTTPException(400, {
        message: "Primary assignee cannot be a supporting assignee",
      });

    const memberships = await tx
      .select({ id: workspaceUserTable.id })
      .from(workspaceUserTable)
      .where(
        and(
          eq(workspaceUserTable.workspaceId, workspaceId),
          eq(workspaceUserTable.userId, userId),
        ),
      )
      .orderBy(workspaceUserTable.id)
      .for("key share");
    const membership = memberships[0];
    if (assigned && !membership) {
      throw new HTTPException(400, {
        message: "Supporting assignee must be a current workspace member",
      });
    }
    if (!membership) return { changed: false, projectId: task.projectId };
    const changed = assigned
      ? await tx
          .insert(taskSupportingAssigneeTable)
          .values({ taskId, membershipId: membership.id })
          .onConflictDoNothing()
          .returning()
      : await tx
          .delete(taskSupportingAssigneeTable)
          .where(
            and(
              eq(taskSupportingAssigneeTable.taskId, taskId),
              inArray(
                taskSupportingAssigneeTable.membershipId,
                memberships.map((m) => m.id),
              ),
            ),
          )
          .returning();
    if (changed.length > 0) {
      const [member] = await tx
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, userId));
      // Keep the history atomic with the assignment and visible before the
      // refresh event is delivered to other windows.
      await tx.insert(activityTable).values({
        taskId,
        userId: actorId,
        type: assigned
          ? "supporting_assignee_added"
          : "supporting_assignee_removed",
        content: null,
        eventData: {
          supportingAssigneeId: userId,
          supportingAssigneeName: member?.name ?? "",
        },
      });
    }
    return { changed: changed.length > 0, projectId: task.projectId };
  });
  if (result.changed)
    await publishEvent("task.supporting_assignees_changed", {
      taskId,
      projectId: result.projectId,
    });
}
