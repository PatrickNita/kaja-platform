ALTER TABLE "workspace_items" ADD COLUMN IF NOT EXISTS "catalogue_group" varchar(20);
UPDATE "workspace_items" SET "catalogue_group" = 'live' WHERE "section" = 'catalogue' AND "catalogue_group" IS NULL;
