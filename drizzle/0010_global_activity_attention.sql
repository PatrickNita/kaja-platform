ALTER TABLE "activity" ADD COLUMN IF NOT EXISTS "title" text;
--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN IF NOT EXISTS "catalogue_group" varchar(20);
--> statement-breakpoint
ALTER TABLE "telegram_outbox" ADD COLUMN IF NOT EXISTS "activity_id" integer;
--> statement-breakpoint
UPDATE "activity" AS a
SET "title" = u."title"
FROM "updates" AS u
WHERE a."entity_type" = 'update'
  AND a."entity_id" = u."id"
  AND a."brand" = u."brand"
  AND a."title" IS NULL;
--> statement-breakpoint
UPDATE "activity" AS a
SET "title" = t."title"
FROM "tasks" AS t
WHERE a."entity_type" = 'task'
  AND a."entity_id" = t."id"
  AND a."brand" = t."brand"
  AND a."title" IS NULL;
--> statement-breakpoint
UPDATE "activity" AS a
SET "title" = w."title", "catalogue_group" = w."catalogue_group"
FROM "workspace_items" AS w
WHERE a."entity_type" = w."section"
  AND a."entity_id" = w."id"
  AND a."brand" = w."brand"
  AND a."title" IS NULL;
--> statement-breakpoint
UPDATE "activity" AS a
SET "title" = f."filename"
FROM "attachments" AS f
WHERE a."entity_type" = 'attachment'
  AND a."entity_id" = f."id"
  AND a."brand" = f."brand"
  AND a."title" IS NULL;
--> statement-breakpoint
UPDATE "activity"
SET "title" = substring("summary" from '„([^”]+)”')
WHERE "title" IS NULL
  AND "summary" LIKE '%„%”%';
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'telegram_outbox_activity_id_activity_id_fk'
  ) THEN
    ALTER TABLE "telegram_outbox" ADD CONSTRAINT "telegram_outbox_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_outbox_activity_unique" ON "telegram_outbox" USING btree ("activity_id") WHERE "activity_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "activity_attention_entity_unique" ON "activity" USING btree ("brand", "entity_type", "entity_id") WHERE "action" = 'attention_requested';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_created_id_idx" ON "activity" USING btree ("created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_brand_created_id_idx" ON "activity" USING btree ("brand", "created_at" DESC, "id" DESC);
