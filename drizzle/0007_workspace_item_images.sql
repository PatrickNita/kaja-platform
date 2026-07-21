CREATE TABLE IF NOT EXISTS "workspace_item_images" (
  "id" serial PRIMARY KEY NOT NULL,
  "brand" varchar(20) NOT NULL,
  "item_id" integer NOT NULL REFERENCES "workspace_items"("id"),
  "pathname" text NOT NULL,
  "url" text NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "uploaded_by" integer NOT NULL REFERENCES "members"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_item_images_pathname_unique" ON "workspace_item_images" USING btree ("pathname");
CREATE INDEX IF NOT EXISTS "workspace_item_images_brand_item_position_idx" ON "workspace_item_images" USING btree ("brand", "item_id", "position");
INSERT INTO "workspace_item_images" ("brand", "item_id", "pathname", "url", "position", "uploaded_by", "created_at")
SELECT "brand", "id", "merch_image_pathname", "merch_image_url", 0, "created_by", "created_at"
FROM "workspace_items"
WHERE "section" = 'merch' AND "merch_image_url" IS NOT NULL AND "merch_image_pathname" IS NOT NULL
ON CONFLICT ("pathname") DO NOTHING;
