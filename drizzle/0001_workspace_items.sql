CREATE TABLE IF NOT EXISTS "workspace_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "section" varchar(20) NOT NULL,
  "title" varchar(160) NOT NULL,
  "body" text NOT NULL,
  "status" varchar(20) DEFAULT 'To do' NOT NULL,
  "created_by" integer NOT NULL REFERENCES "members"("id"),
  "updated_by" integer NOT NULL REFERENCES "members"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
