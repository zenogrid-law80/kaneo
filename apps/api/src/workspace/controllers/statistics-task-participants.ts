import { sql } from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  taskSupportingAssigneeTable,
  taskTable,
  workspaceUserTable,
} from "../../database/schema";
import { statisticsTaskOwner } from "./statistics-task-owner";

export function statisticsTaskUserIds(includeSupportingAssignees: boolean) {
  if (!includeSupportingAssignees)
    return sql`array[${statisticsTaskOwner}]::text[]`;
  // UNION credits a person once even when they are both owner and supporter.
  return sql`array(
    select ${statisticsTaskOwner}
    union
    select ${workspaceUserTable.userId}
    from ${taskSupportingAssigneeTable}
    inner join ${workspaceUserTable} on ${workspaceUserTable.id} = ${taskSupportingAssigneeTable.membershipId}
    where ${taskSupportingAssigneeTable.taskId} = ${taskTable.id}
      and ${workspaceUserTable.userId} is distinct from ${taskTable.userId}
      and ${workspaceUserTable.workspaceId} = ${projectTable.workspaceId}
  )`;
}

export function statisticsTaskParticipants(
  includeSupportingAssignees: boolean,
) {
  return db
    .select({
      userId: sql<string>`task_participant.user_id`.as(
        "statistics_participant_user_id",
      ),
    })
    .from(
      sql`unnest(${statisticsTaskUserIds(includeSupportingAssignees)}) as task_participant(user_id)`,
    )
    .as("statistics_participant");
}
