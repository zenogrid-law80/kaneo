import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type db from "../../database";
import { projectTable, taskTable } from "../../database/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function lockSupportingAssigneeTask(
  tx: Transaction,
  taskId: string,
  workspaceId: string,
) {
  // Lock projects before tasks, matching task/project moves. Authorization
  // must still refer to the same workspace when the relationship is written.
  const [project] = await tx
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        inArray(
          projectTable.id,
          tx
            .select({ id: taskTable.projectId })
            .from(taskTable)
            .where(eq(taskTable.id, taskId)),
        ),
      ),
    )
    .for("share");
  if (!project) throw new HTTPException(404, { message: "Task not found" });
  const [task] = await tx
    .select({ id: taskTable.id, userId: taskTable.userId })
    .from(taskTable)
    .where(and(eq(taskTable.id, taskId), eq(taskTable.projectId, project.id)))
    .for("update");
  if (!task)
    throw new HTTPException(409, { message: "Task moved; please try again" });

  return { ...task, projectId: project.id };
}
