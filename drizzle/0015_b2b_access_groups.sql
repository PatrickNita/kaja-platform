CREATE TABLE b2b_access_groups (
 id serial PRIMARY KEY,
 contact_key text NOT NULL UNIQUE,
 token_hash varchar(64) NOT NULL UNIQUE,
 token_cipher text NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version > 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE b2b_locations ADD COLUMN access_group_id integer REFERENCES b2b_access_groups(id);
--> statement-breakpoint
CREATE INDEX b2b_locations_access_group ON b2b_locations(access_group_id);
