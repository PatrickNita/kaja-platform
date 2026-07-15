CREATE TABLE IF NOT EXISTS "comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "brand" varchar(20) NOT NULL,
  "entity_type" varchar(20) NOT NULL,
  "entity_id" integer NOT NULL,
  "author_id" integer NOT NULL REFERENCES "members"("id"),
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "comments_brand_entity_created_idx" ON "comments" USING btree ("brand", "entity_type", "entity_id", "created_at");
