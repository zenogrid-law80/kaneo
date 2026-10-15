CREATE TABLE "task_supporting_assignee" (
	"task_id" text NOT NULL,
	"membership_id" text NOT NULL,
	CONSTRAINT "task_supporting_assignee_task_id_membership_id_pk" PRIMARY KEY("task_id","membership_id")
);
--> statement-breakpoint
ALTER TABLE "task_supporting_assignee" ADD CONSTRAINT "task_supporting_assignee_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_supporting_assignee" ADD CONSTRAINT "task_supporting_assignee_membership_id_workspace_member_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."workspace_member"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_supporting_assignee_membership_idx" ON "task_supporting_assignee" USING btree ("membership_id");