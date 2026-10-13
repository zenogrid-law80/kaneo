import { and, asc, eq, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  assetTable,
  columnTable,
  milestoneTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import {
  lockMilestoneProjects,
  publishMilestoneAssignment,
} from "../../milestone/controllers/milestones";
import { claimTaskNumber } from "./claim-task-numbers";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

function isSameProjectMove(
  sourceProjectId: string,
  destinationProjectId: string,
) {
  return sourceProjectId === destinationProjectId;
}

async function resolveDestinationStatus(
  destinationProjectId: string,
  currentStatus: string,
  requestedStatus?: string,
) {
  const destinationColumns = await db
    .select({
      id: columnTable.id,
      slug: columnTable.slug,
      position: columnTable.position,
    })
    .from(columnTable)
    .where(eq(columnTable.projectId, destinationProjectId))
    .orderBy(asc(columnTable.position));

  const [firstColumn] = destinationColumns;

  if (!firstColumn) {
    throw new HTTPException(400, {
      message: "Destination project does not have a workflow",
    });
  }

  const requestedColumn = requestedStatus
    ? destinationColumns.find((column) => column.slug === requestedStatus)
    : null;

  if (requestedStatus && !requestedColumn) {
    throw new HTTPException(400, {
      message: "Selected status is not valid for the destination project",
    });
  }

  const matchingCurrentColumn = destinationColumns.find(
    (column) => column.slug === currentStatus,
  );

  return requestedColumn ?? matchingCurrentColumn ?? firstColumn;
}

async function getNextTaskPosition(
  dbOrTx: DbOrTx,
  projectId: string,
  status: string,
  columnId: string,
) {
  const [maxPositionResult] = await dbOrTx
    .select({ maxPosition: max(taskTable.position) })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.projectId, projectId),
        eq(taskTable.status, status),
        eq(taskTable.columnId, columnId),
      ),
    );

  return (maxPositionResult?.maxPosition ?? 0) + 1;
}

async function moveTask({
  taskId,
  destinationProjectId,
  destinationStatus,
  currentUserId,
}: {
  taskId: string;
  destinationProjectId: string;
  destinationStatus?: string;
  currentUserId: string;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  if (isSameProjectMove(existingTask.projectId, destinationProjectId)) {
    throw new HTTPException(400, {
      message: "Task is already in that project",
    });
  }

  const [sourceProject, destinationProject] = await Promise.all([
    db.query.projectTable.findFirst({
      where: eq(projectTable.id, existingTask.projectId),
    }),
    db.query.projectTable.findFirst({
      where: eq(projectTable.id, destinationProjectId),
    }),
  ]);

  if (!sourceProject || !destinationProject) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  if (sourceProject.workspaceId !== destinationProject.workspaceId) {
    throw new HTTPException(400, {
      message: "Tasks can only be moved within the same workspace",
    });
  }

  const resolvedColumn = await resolveDestinationStatus(
    destinationProjectId,
    existingTask.status,
    destinationStatus,
  );

  const moved = await db.transaction(async (tx) => {
    await lockMilestoneProjects(tx, [
      existingTask.projectId,
      destinationProjectId,
    ]);
    const [current] = await tx
      .select()
      .from(taskTable)
      .where(eq(taskTable.id, taskId))
      .for("update");
    if (!current || current.projectId !== existingTask.projectId)
      throw new HTTPException(409, {
        message: "Task changed projects; retry the move",
      });
    const [oldMilestone] = current.milestoneId
      ? await tx
          .select()
          .from(milestoneTable)
          .where(eq(milestoneTable.id, current.milestoneId))
      : [];

    const [nextTaskNumber, nextPosition] = await Promise.all([
      claimTaskNumber(destinationProjectId, tx),
      getNextTaskPosition(
        tx,
        destinationProjectId,
        resolvedColumn.slug,
        resolvedColumn.id,
      ),
    ]);

    const [updatedTask] = await tx
      .update(taskTable)
      .set({
        projectId: destinationProjectId,
        milestoneId: null,
        status: resolvedColumn.slug,
        columnId: resolvedColumn.id,
        number: nextTaskNumber,
        position: nextPosition,
      })
      .where(eq(taskTable.id, taskId))
      .returning();

    if (!updatedTask) {
      throw new HTTPException(500, {
        message: "Failed to move task",
      });
    }

    await tx
      .update(assetTable)
      .set({ projectId: destinationProjectId })
      .where(eq(assetTable.taskId, taskId));

    return { updatedTask, oldMilestone };
  });

  const movedTask = moved.updatedTask;
  if (moved.oldMilestone)
    await publishMilestoneAssignment(
      { id: taskId, projectId: sourceProject.id },
      currentUserId,
      moved.oldMilestone,
      null,
    );

  await publishEvent("task.moved", {
    taskId,
    type: "moved",
    userId: currentUserId,
    fromProjectId: sourceProject.id,
    fromProjectName: sourceProject.name,
    toProjectId: destinationProject.id,
    toProjectName: destinationProject.name,
    oldStatus: existingTask.status,
    newStatus: resolvedColumn.slug,
  });

  return {
    task: movedTask,
    sourceProjectId: sourceProject.id,
    destinationProjectId: destinationProject.id,
  };
}

export default moveTask;
