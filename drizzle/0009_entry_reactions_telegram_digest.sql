CREATE TABLE "entry_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand" varchar(20) NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"entity_id" integer NOT NULL,
	"reaction_type" varchar(20) NOT NULL,
	"member_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer NOT NULL,
	"member_name" varchar(64) NOT NULL,
	"brand" varchar(20) NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"entity_id" integer NOT NULL,
	"action" varchar(24) NOT NULL,
	"title" text NOT NULL,
	"catalogue_group" varchar(20),
	"reaction_type" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "telegram_debounce" (
	"actor_id" integer PRIMARY KEY NOT NULL,
	"generation" varchar(64) NOT NULL,
	"last_activity_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"sent_generation" varchar(64),
	"processing_generation" varchar(64),
	"processing_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entry_reactions" ADD CONSTRAINT "entry_reactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "telegram_outbox" ADD CONSTRAINT "telegram_outbox_actor_id_members_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "telegram_debounce" ADD CONSTRAINT "telegram_debounce_actor_id_members_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "entry_reactions_entity_member_type_unique" ON "entry_reactions" USING btree ("brand","entity_type","entity_id","member_id","reaction_type");
--> statement-breakpoint
CREATE INDEX "entry_reactions_brand_entity_created_idx" ON "entry_reactions" USING btree ("brand","entity_type","entity_id","created_at");
--> statement-breakpoint
CREATE INDEX "telegram_outbox_actor_sent_created_idx" ON "telegram_outbox" USING btree ("actor_id","sent_at","created_at");
