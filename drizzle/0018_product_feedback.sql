ALTER TABLE workspace_items ADD COLUMN product_name varchar(160);
--> statement-breakpoint
ALTER TABLE workspace_items ADD COLUMN flavor varchar(200);
--> statement-breakpoint
ALTER TABLE workspace_items ADD COLUMN feedback_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;
--> statement-breakpoint
CREATE TABLE product_feedback (
 id serial PRIMARY KEY,
 item_id integer NOT NULL REFERENCES workspace_items(id),
 body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
 request_id uuid NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX product_feedback_item_created_idx ON product_feedback(item_id, created_at DESC, id DESC);
--> statement-breakpoint
CREATE TABLE feedback_rate_limits (
 source_hash varchar(64) PRIMARY KEY,
 hits integer NOT NULL,
 expires_at timestamptz NOT NULL
);
--> statement-breakpoint
CREATE FUNCTION submit_product_feedback(public_id uuid, message text, submission_id uuid, source_key varchar)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE target_id integer; hit_count integer;
BEGIN
 SELECT id INTO target_id FROM workspace_items
 WHERE feedback_id=public_id AND section='catalogue' AND catalogue_group='live'
 AND deleted_at IS NULL AND nullif(btrim(product_name),'') IS NOT NULL AND nullif(btrim(flavor),'') IS NOT NULL
 FOR SHARE;
 IF target_id IS NULL THEN RETURN 'unavailable'; END IF;
 IF char_length(btrim(message)) NOT BETWEEN 1 AND 2000 THEN RETURN 'invalid'; END IF;
 -- Serialize requests per source, including requests to different products.
 PERFORM pg_advisory_xact_lock(hashtextextended(source_key, 0));
 IF EXISTS(SELECT 1 FROM product_feedback WHERE request_id=submission_id AND item_id=target_id) THEN RETURN 'ok'; END IF;
 DELETE FROM feedback_rate_limits WHERE expires_at < now();
 INSERT INTO feedback_rate_limits(source_hash,hits,expires_at) VALUES(source_key,1,now()+interval '10 minutes')
 ON CONFLICT(source_hash) DO UPDATE SET hits=feedback_rate_limits.hits+1
 RETURNING hits INTO hit_count;
 IF hit_count>5 THEN RETURN 'limited'; END IF;
 INSERT INTO product_feedback(item_id,body,request_id) VALUES(target_id,btrim(message),submission_id)
 ON CONFLICT(request_id) DO NOTHING;
 RETURN 'ok';
END $$;
