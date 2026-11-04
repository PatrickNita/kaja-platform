LOCK TABLE b2b_orders IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
CREATE TEMP TABLE kaja_order_number_mapping ON COMMIT DROP AS
SELECT id, row_number() OVER (ORDER BY created_at,id)::integer AS number FROM b2b_orders;
--> statement-breakpoint
WITH offset_value AS (SELECT coalesce(max(order_number),0) AS value FROM b2b_orders)
UPDATE b2b_orders o SET order_number=m.number+x.value
FROM kaja_order_number_mapping m,offset_value x WHERE o.id=m.id;
--> statement-breakpoint
UPDATE b2b_orders o SET order_number=m.number FROM kaja_order_number_mapping m WHERE o.id=m.id;
--> statement-breakpoint
CREATE TABLE b2b_order_counter (
  id integer PRIMARY KEY CHECK(id=1),
  next_number integer NOT NULL CHECK(next_number>0)
);
--> statement-breakpoint
INSERT INTO b2b_order_counter(id,next_number) SELECT 1,coalesce(max(order_number),0)+1 FROM b2b_orders;
--> statement-breakpoint
ALTER TABLE b2b_orders ALTER COLUMN order_number DROP DEFAULT;
--> statement-breakpoint
CREATE FUNCTION assign_b2b_order_number() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allocated integer;
BEGIN
  -- This row lock and increment roll back with the order and its stock changes.
  SELECT next_number INTO STRICT allocated FROM b2b_order_counter WHERE id=1 FOR UPDATE;
  -- A retried request may have committed while this request waited for the lock.
  IF EXISTS(SELECT 1 FROM b2b_orders WHERE request_key=NEW.request_key) THEN RETURN NULL; END IF;
  UPDATE b2b_order_counter SET next_number=allocated+1 WHERE id=1;
  NEW.order_number:=allocated;
  NEW.created_at:=clock_timestamp();
  NEW.updated_at:=NEW.created_at;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER b2b_assign_order_number BEFORE INSERT ON b2b_orders
FOR EACH ROW EXECUTE FUNCTION assign_b2b_order_number();
--> statement-breakpoint
CREATE TABLE b2b_order_rejections (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  mode varchar(10),
  actor_slug varchar(32),
  location_id integer REFERENCES b2b_locations(id) ON DELETE SET NULL,
  location_name text,
  order_id integer,
  request_key uuid,
  http_status integer NOT NULL,
  error_code varchar(32) NOT NULL,
  reason text NOT NULL,
  requested_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  stock_details jsonb,
  diagnostics jsonb
);
--> statement-breakpoint
CREATE INDEX b2b_order_rejections_created ON b2b_order_rejections(created_at DESC);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION adjust_b2b_stock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE delta integer; product integer; available integer;
BEGIN
  IF TG_OP='INSERT' THEN delta:=NEW.quantity; product:=NEW.product_id;
  ELSIF TG_OP='DELETE' THEN delta:=-OLD.quantity; product:=OLD.product_id;
  ELSE delta:=NEW.quantity-OLD.quantity; product:=NEW.product_id;
  END IF;
  IF delta<>0 THEN
    PERFORM pg_advisory_xact_lock(1792586000);
    UPDATE b2b_products SET stock=stock-delta,stock_version=stock_version+1 WHERE id=product AND stock>=delta;
    IF NOT FOUND THEN
      SELECT stock INTO available FROM b2b_products WHERE id=product;
      RAISE EXCEPTION 'B2B_STOCK_INSUFFICIENT' USING ERRCODE='P0001',
        DETAIL=jsonb_build_object('productId',product,'requestedDelta',delta,'available',available)::text;
    END IF;
  END IF;
  RETURN NULL;
END $$;
