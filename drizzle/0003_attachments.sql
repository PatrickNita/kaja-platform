CREATE TABLE IF NOT EXISTS "attachments" (
  "id" serial PRIMARY KEY NOT NULL,
  "filename" varchar(255) NOT NULL,
  "pathname" text NOT NULL,
  "url" text NOT NULL,
  "size" integer NOT NULL,
  "uploaded_by" integer NOT NULL REFERENCES "members"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "attachments_pathname_unique" ON "attachments" USING btree ("pathname");
