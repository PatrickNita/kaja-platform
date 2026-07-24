CREATE TABLE IF NOT EXISTS "task_assignees" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_completed_by_members_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_assignees_task_member_unique" ON "task_assignees" USING btree ("task_id","member_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_assignees_member_task_idx" ON "task_assignees" USING btree ("member_id","task_id");
--> statement-breakpoint
INSERT INTO "task_assignees" ("task_id", "member_id", "completed")
SELECT t."id", m."id", false
FROM "tasks" t
JOIN "members" m ON m."slug" = 'patrick'
WHERE t."deleted_at" IS NULL
ON CONFLICT ("task_id", "member_id") DO NOTHING;
--> statement-breakpoint
DELETE FROM "telegram_outbox"
WHERE "sent_at" IS NULL
  AND "activity_id" IN (
    SELECT "id" FROM "activity"
    WHERE "entity_type" = 'task' AND "action" = 'reacted'
  );
--> statement-breakpoint
UPDATE "telegram_outbox"
SET "activity_id" = NULL
WHERE "sent_at" IS NOT NULL
  AND "activity_id" IN (
    SELECT "id" FROM "activity"
    WHERE "entity_type" = 'task' AND "action" = 'reacted'
  );
--> statement-breakpoint
DELETE FROM "activity"
WHERE "entity_type" = 'task' AND "action" = 'reacted';
--> statement-breakpoint
DELETE FROM "entry_reactions"
WHERE "entity_type" = 'task';
--> statement-breakpoint
DELETE FROM "telegram_outbox"
WHERE "sent_at" IS NULL
  AND "activity_id" IN (
    SELECT "id" FROM "activity"
    WHERE "action" IN ('deleted', 'comment_deleted', 'image_deleted')
  );
