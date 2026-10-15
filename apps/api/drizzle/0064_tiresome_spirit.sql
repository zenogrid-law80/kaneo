ALTER TABLE "task_supporting_assignee" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
-- Recover the current assignment's latest add event where history is available.
UPDATE "task_supporting_assignee" AS assignment
SET "created_at" = history.assigned_at
FROM "workspace_member" AS membership,
  (
    SELECT "task_id", "event_data"->>'supportingAssigneeId' AS user_id,
      MAX("created_at") AS assigned_at
    FROM "activity"
    WHERE "type" = 'supporting_assignee_added'
    GROUP BY "task_id", "event_data"->>'supportingAssigneeId'
  ) AS history
WHERE membership."id" = assignment."membership_id"
  AND history."task_id" = assignment."task_id"
  AND history.user_id = membership."user_id";
