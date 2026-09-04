import { sql } from "drizzle-orm";
import { taskTable } from "../../database/schema";

// Keep attribution after completion, including tasks started before the date filter.
// External actors and users outside the task workspace cannot receive member credit.
export const statisticsTaskOwner = sql<string | null>`coalesce((
  select started.user_id
  from activity started
  inner join project owner_project on owner_project.id = ${taskTable.projectId}
  inner join workspace_member owner_member
    on owner_member.workspace_id = owner_project.workspace_id
    and owner_member.user_id = started.user_id
  where started.task_id = ${taskTable.id}
    and started.type = 'status_changed'
    and started.event_data->>'newStatus' = 'in-progress'
  order by started.created_at desc, started.id desc
  limit 1
), ${taskTable.userId})`;
