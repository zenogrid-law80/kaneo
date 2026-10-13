CREATE TABLE IF NOT EXISTS "milestone" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "milestone_project_id_id_unique" UNIQUE("project_id","id"),
	CONSTRAINT "milestone_status_check" CHECK ("milestone"."status" IN ('open', 'closed')),
	CONSTRAINT "milestone_closed_at_check" CHECK (("milestone"."status" = 'open' AND "milestone"."closed_at" IS NULL) OR ("milestone"."status" = 'closed' AND "milestone"."closed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "milestone_id" text;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'milestone_project_id_project_id_fk' AND conrelid = 'public.milestone'::regclass) THEN
    ALTER TABLE "milestone" ADD CONSTRAINT "milestone_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestone_project_status_due_date_idx" ON "milestone" USING btree ("project_id","status","due_date");--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_project_milestone_fk' AND conrelid = 'public.task'::regclass) THEN
    ALTER TABLE "task" ADD CONSTRAINT "task_project_milestone_fk" FOREIGN KEY ("project_id","milestone_id") REFERENCES "public"."milestone"("project_id","id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_project_milestone_idx" ON "task" USING btree ("project_id","milestone_id");