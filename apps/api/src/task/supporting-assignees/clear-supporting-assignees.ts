import { eq } from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  taskSupportingAssigneeTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { lockSupportingAssigneeTask } from "./lock-supporting-assignee-task";

export default async function clearSupportingAssignees({
  taskId,
  workspaceId,
  actorId,
}: {
  taskId: string;
  workspaceId: string;
  actorId: string;
}) {
  const result = await db.transaction(async (tx) => {
    const task = await lockSupportingAssigneeTask(tx, taskId, workspaceId);
    const members = await tx
      .select({
        membershipId: workspaceUserTable.id,
        userId: userTable.id,
        name: userTable.name,
      })
      .from(taskSupportingAssigneeTable)
      .innerJoin(
        workspaceUserTable,
        eq(workspaceUserTable.id, taskSupportingAssigneeTable.membershipId),
      )
      .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
      .where(eq(taskSupportingAssigneeTable.taskId, taskId));
    const removed = await tx
      .delete(taskSupportingAssigneeTable)
      .where(eq(taskSupportingAssigneeTable.taskId, taskId))
      .returning({ membershipId: taskSupportingAssigneeTable.membershipId });
    const removedIds = new Set(removed.map((row) => row.membershipId));
    const people = new Map(
      members
        .filter((member) => removedIds.has(member.membershipId))
        .map((member) => [member.userId, member]),
    );
    if (people.size) {
      await tx.insert(activityTable).values(
        [...people.values()].map((member) => ({
          taskId,
          userId: actorId,
          type: "supporting_assignee_removed",
          content: null,
          eventData: {
            supportingAssigneeId: member.userId,
            supportingAssigneeName: member.name,
          },
        })),
      );
    }
    return { projectId: task.projectId, changed: removed.length > 0 };
  });
  if (result.changed) {
    await publishEvent("task.supporting_assignees_changed", {
      taskId,
      projectId: result.projectId,
    });
  }
}
