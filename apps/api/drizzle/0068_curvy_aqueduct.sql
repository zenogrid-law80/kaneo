CREATE TABLE "bug_history" (
	"id" text PRIMARY KEY NOT NULL,
	"bug_id" text NOT NULL,
	"user_id" text,
	"type" text NOT NULL,
	"changes" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "bug_id" text;--> statement-breakpoint
ALTER TABLE "bug_history" ADD CONSTRAINT "bug_history_bug_id_bug_id_fk" FOREIGN KEY ("bug_id") REFERENCES "public"."bug"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bug_history" ADD CONSTRAINT "bug_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "bug_history_bug_created_idx" ON "bug_history" USING btree ("bug_id","created_at","id");--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_bug_id_bug_id_fk" FOREIGN KEY ("bug_id") REFERENCES "public"."bug"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "asset_bugId_idx" ON "asset" USING btree ("bug_id");