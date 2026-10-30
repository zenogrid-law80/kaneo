CREATE TABLE "bug_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"bug_id" text NOT NULL,
	"user_id" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "bug_comment_id" text;--> statement-breakpoint
ALTER TABLE "bug_comment" ADD CONSTRAINT "bug_comment_bug_id_bug_id_fk" FOREIGN KEY ("bug_id") REFERENCES "public"."bug"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bug_comment" ADD CONSTRAINT "bug_comment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "bug_comment_bug_created_idx" ON "bug_comment" USING btree ("bug_id","created_at","id");--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_bug_comment_id_bug_comment_id_fk" FOREIGN KEY ("bug_comment_id") REFERENCES "public"."bug_comment"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "asset_bugCommentId_idx" ON "asset" USING btree ("bug_comment_id");