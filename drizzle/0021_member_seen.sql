CREATE TABLE IF NOT EXISTS member_order_seen (
  member_id integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  order_id integer NOT NULL REFERENCES b2b_orders(id) ON DELETE CASCADE,
  seen_version integer NOT NULL CHECK (seen_version > 0),
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, order_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS member_feedback_seen (
  member_id integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  feedback_id integer NOT NULL REFERENCES product_feedback(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, feedback_id)
);
