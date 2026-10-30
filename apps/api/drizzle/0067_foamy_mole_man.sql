ALTER TABLE "bug" ADD COLUMN "milestone_id" text;--> statement-breakpoint
ALTER TABLE "bug" ADD CONSTRAINT "bug_project_milestone_fk" FOREIGN KEY ("project_id","milestone_id") REFERENCES "public"."milestone"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_project_milestone_idx" ON "bug" USING btree ("project_id","milestone_id");--> statement-breakpoint
CREATE INDEX "bug_project_reporter_idx" ON "bug" USING btree ("project_id","reporter_id");--> statement-breakpoint
CREATE INDEX "bug_project_fixer_idx" ON "bug" USING btree ("project_id","fixer_id");--> statement-breakpoint
CREATE INDEX "bug_project_verifier_idx" ON "bug" USING btree ("project_id","verifier_id");