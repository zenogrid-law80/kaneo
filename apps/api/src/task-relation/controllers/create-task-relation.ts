import { and, eq, inArray, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskRelationTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";

async function createTaskRelation({
  sourceTaskId,
  targetTaskId,
  relationType,
  userId,
  workspaceId,
}: {
  sourceTaskId: string;
  targetTaskId: string;
  relationType: string;
  userId: string;
  workspaceId: string;
}) {
  if (sourceTaskId === targetTaskId) {
    throw new HTTPException(400, {
      message: "Cannot create a relation between a task and itself",
    });
  }

  const result = await db.transaction(async (tx) => {
    if (relationType === "subtask") {
      // Concurrent links must not both pass the cycle check before either commits.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('task-subtask'), hashtext(${workspaceId}))`,
      );
    }
    // Serialize relation creation with project moves before validating either
    // workspace. A move must see this relation or this request must see the move.
    await tx
      .select({ id: projectTable.id })
      .from(projectTable)
      .where(
        inArray(
          projectTable.id,
          tx
            .select({ projectId: taskTable.projectId })
            .from(taskTable)
            .where(inArray(taskTable.id, [sourceTaskId, targetTaskId])),
        ),
      )
      .orderBy(projectTable.id)
      .for("share");
    const [sourceTask] = await tx
      .select({
        id: taskTable.id,
        projectId: taskTable.projectId,
        workspaceId: projectTable.workspaceId,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .where(
        and(
          eq(taskTable.id, sourceTaskId),
          eq(projectTable.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!sourceTask) {
      throw new HTTPException(404, { message: "Source task not found" });
    }

    const [targetTask] = await tx
      .select({
        id: taskTable.id,
        projectId: taskTable.projectId,
        workspaceId: projectTable.workspaceId,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .where(
        and(
          eq(taskTable.id, targetTaskId),
          eq(projectTable.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!targetTask) {
      throw new HTTPException(404, { message: "Target task not found" });
    }

    const existing = await tx
      .select({ id: taskRelationTable.id })
      .from(taskRelationTable)
      .where(
        and(
          eq(taskRelationTable.relationType, relationType),
          or(
            and(
              eq(taskRelationTable.sourceTaskId, sourceTaskId),
              eq(taskRelationTable.targetTaskId, targetTaskId),
            ),
            and(
              eq(taskRelationTable.sourceTaskId, targetTaskId),
              eq(taskRelationTable.targetTaskId, sourceTaskId),
            ),
          ),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new HTTPException(409, {
        message: "This relation already exists",
      });
    }

    if (relationType === "subtask") {
      // UNION also terminates safely if an existing installation contains a cycle.
      const descendants = await tx.execute(sql`
        WITH RECURSIVE descendants(id) AS (
          SELECT ${targetTaskId}::text
          UNION
          SELECT ${taskRelationTable.targetTaskId}
          FROM ${taskRelationTable}
          INNER JOIN descendants ON ${taskRelationTable.sourceTaskId} = descendants.id
          WHERE ${taskRelationTable.relationType} = 'subtask'
        )
        SELECT id FROM descendants WHERE id = ${sourceTaskId} LIMIT 1
      `);
      if (descendants.rows.length > 0) {
        throw new HTTPException(400, {
          message: "Cannot create a circular subtask hierarchy",
        });
      }
    }

    const [relation] = await tx
      .insert(taskRelationTable)
      .values({
        sourceTaskId,
        targetTaskId,
        relationType,
      })
      .returning();

    if (!relation) {
      throw new HTTPException(500, {
        message: "Failed to create task relation",
      });
    }

    return { relation, sourceTask, targetTask };
  });

  const { relation, sourceTask, targetTask } = result;

  await publishEvent("task-relation.created", {
    ...relation,
    taskId: sourceTaskId,
    projectId: sourceTask.projectId,
    targetProjectId: targetTask.projectId,
    userId,
  });

  return relation;
}

export default createTaskRelation;
