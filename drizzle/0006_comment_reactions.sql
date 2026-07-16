CREATE TABLE IF NOT EXISTS "comment_reactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "brand" varchar(20) NOT NULL,
  "comment_id" integer NOT NULL REFERENCES "comments"("id"),
  "member_id" integer NOT NULL REFERENCES "members"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "comment_reactions_comment_member_unique" ON "comment_reactions" USING btree ("comment_id", "member_id");
CREATE INDEX IF NOT EXISTS "comment_reactions_brand_comment_created_idx" ON "comment_reactions" USING btree ("brand", "comment_id", "created_at");
