ALTER TABLE "bug" ADD COLUMN "priority" text DEFAULT 'no-priority' NOT NULL;--> statement-breakpoint
ALTER TABLE "bug" ADD COLUMN "severity" text DEFAULT 'no-severity' NOT NULL;--> statement-breakpoint
ALTER TABLE "bug" ADD COLUMN "environment" text;--> statement-breakpoint
CREATE INDEX "bug_project_priority_idx" ON "bug" USING btree ("project_id","priority");--> statement-breakpoint
CREATE INDEX "bug_project_severity_idx" ON "bug" USING btree ("project_id","severity");--> statement-breakpoint
CREATE INDEX "bug_project_environment_idx" ON "bug" USING btree ("project_id","environment");--> statement-breakpoint
ALTER TABLE "bug" ADD CONSTRAINT "bug_priority_check" CHECK ("bug"."priority" IN ('no-priority', 'low', 'medium', 'high', 'urgent'));--> statement-breakpoint
ALTER TABLE "bug" ADD CONSTRAINT "bug_severity_check" CHECK ("bug"."severity" IN ('no-severity', 'trivial', 'minor', 'major', 'critical'));--> statement-breakpoint
ALTER TABLE "bug" ADD CONSTRAINT "bug_environment_check" CHECK ("bug"."environment" IN ('development', 'staging', 'production'));