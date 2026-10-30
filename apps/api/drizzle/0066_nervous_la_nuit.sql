ALTER TABLE "bug" ADD COLUMN "reporter_id" text;--> statement-breakpoint
ALTER TABLE "bug" ADD COLUMN "fixer_id" text;--> statement-breakpoint
ALTER TABLE "bug" ADD COLUMN "verifier_id" text;--> statement-breakpoint
ALTER TABLE "bug" ADD CONSTRAINT "bug_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bug" ADD CONSTRAINT "bug_fixer_id_user_id_fk" FOREIGN KEY ("fixer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bug" ADD CONSTRAINT "bug_verifier_id_user_id_fk" FOREIGN KEY ("verifier_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;