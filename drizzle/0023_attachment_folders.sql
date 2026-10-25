CREATE TABLE IF NOT EXISTS attachment_folders (
 id serial PRIMARY KEY,
 brand varchar(20) NOT NULL,
 title varchar(160) NOT NULL,
 subtitle varchar(300) NOT NULL DEFAULT '',
 published boolean NOT NULL DEFAULT true,
 created_by integer NOT NULL REFERENCES members(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz
);
--> statement-breakpoint
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS content_type varchar(64) NOT NULL DEFAULT 'application/pdf';
--> statement-breakpoint
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS folder_id integer REFERENCES attachment_folders(id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS attachments_folder_idx ON attachments(folder_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS attachments_folder_filename_unique ON attachments(folder_id, filename) WHERE deleted_at IS NULL AND folder_id IS NOT NULL;
