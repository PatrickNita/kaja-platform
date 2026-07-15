CREATE TABLE IF NOT EXISTS "members" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" varchar(32) NOT NULL,
  "name" varchar(64) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "members_slug_unique" ON "members" USING btree ("slug");
CREATE TABLE IF NOT EXISTS "updates" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" varchar(160) NOT NULL,
  "body" text NOT NULL,
  "created_by" integer NOT NULL REFERENCES "members"("id"),
  "updated_by" integer NOT NULL REFERENCES "members"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" varchar(160) NOT NULL,
  "status" varchar(20) DEFAULT 'To do' NOT NULL,
  "created_by" integer NOT NULL REFERENCES "members"("id"),
  "updated_by" integer NOT NULL REFERENCES "members"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "activity" (
  "id" serial PRIMARY KEY NOT NULL,
  "actor_id" integer NOT NULL REFERENCES "members"("id"),
  "entity_type" varchar(20) NOT NULL,
  "entity_id" integer NOT NULL,
  "action" varchar(24) NOT NULL,
  "summary" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
