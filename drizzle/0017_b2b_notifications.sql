CREATE TABLE b2b_notifications (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES b2b_orders(id),
  order_version integer NOT NULL,
  payload jsonb NOT NULL,
  sent_parts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  processing_token uuid,
  processing_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT b2b_notifications_order_version UNIQUE(order_id, order_version)
);
--> statement-breakpoint
CREATE INDEX b2b_notifications_pending_idx ON b2b_notifications(id) WHERE sent_at IS NULL;
