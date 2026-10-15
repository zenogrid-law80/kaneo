import { and, eq, inArray } from "drizzle-orm";
import type db from "../../database";
import {
  taskSupportingAssigneeTable,
  taskTable,
  workspaceUserTable,
} from "../../database/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Call while holding the task locks, before and after changing the primary
// assignee, so legacy duplicates cannot reappear when the primary changes.
export async function clearPrimarySupportingAssignees(
  tx: Transaction,
  taskIds: string[],
) {
  await tx
    .delete(taskSupportingAssigneeTable)
    .where(
      and(
        inArray(taskSupportingAssigneeTable.taskId, taskIds),
        inArray(
          taskSupportingAssigneeTable.membershipId,
          tx
            .select({ id: workspaceUserTable.id })
            .from(workspaceUserTable)
            .innerJoin(
              taskTable,
              eq(taskTable.userId, workspaceUserTable.userId),
            )
            .where(eq(taskTable.id, taskSupportingAssigneeTable.taskId)),
        ),
      ),
    );
}
