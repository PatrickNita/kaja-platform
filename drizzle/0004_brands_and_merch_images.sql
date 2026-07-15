ALTER TABLE "updates" ADD COLUMN IF NOT EXISTS "brand" varchar(20) NOT NULL DEFAULT 'kaja';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "brand" varchar(20) NOT NULL DEFAULT 'kaja';
ALTER TABLE "workspace_items" ADD COLUMN IF NOT EXISTS "brand" varchar(20) NOT NULL DEFAULT 'kaja';
ALTER TABLE "workspace_items" ADD COLUMN IF NOT EXISTS "merch_image_url" text;
ALTER TABLE "workspace_items" ADD COLUMN IF NOT EXISTS "merch_image_pathname" text;
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "brand" varchar(20) NOT NULL DEFAULT 'kaja';
ALTER TABLE "activity" ADD COLUMN IF NOT EXISTS "brand" varchar(20) NOT NULL DEFAULT 'kaja';
