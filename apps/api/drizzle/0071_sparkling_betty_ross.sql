CREATE TABLE "bug_environment" (
	"project_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bug_environment_project_id_id_pk" PRIMARY KEY("project_id","id")
);
--> statement-breakpoint
ALTER TABLE "bug" DROP CONSTRAINT "bug_environment_check";--> statement-breakpoint
ALTER TABLE "bug_environment" ADD CONSTRAINT "bug_environment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;