CREATE TABLE "bug" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bug_status_check" CHECK ("bug"."status" IN ('new', 'in-progress', 'resolved'))
);
--> statement-breakpoint
CREATE TABLE "bug_template" (
	"project_id" text PRIMARY KEY NOT NULL,
	"template" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bug" ADD CONSTRAINT "bug_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bug_template" ADD CONSTRAINT "bug_template_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "bug_project_status_created_idx" ON "bug" USING btree ("project_id","status","created_at","id");