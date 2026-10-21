ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 100 CHECK(stock >= 0);
--> statement-breakpoint
ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS stock_version integer NOT NULL DEFAULT 1 CHECK(stock_version > 0);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION adjust_b2b_stock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE delta integer; product integer;
BEGIN
  IF TG_OP = 'INSERT' THEN delta := NEW.quantity; product := NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN delta := -OLD.quantity; product := OLD.product_id;
  ELSE delta := NEW.quantity - OLD.quantity; product := NEW.product_id;
  END IF;
  IF delta <> 0 THEN
    -- Serialize stock adjustments across multi-product orders; retries/no-ops have no movement.
    PERFORM pg_advisory_xact_lock(1792586000);
    UPDATE b2b_products SET stock=stock-delta,stock_version=stock_version+1 WHERE id=product AND stock >= delta;
    IF NOT FOUND THEN RAISE EXCEPTION 'B2B_STOCK_INSUFFICIENT' USING ERRCODE='P0001'; END IF;
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS b2b_order_stock ON b2b_order_items;
--> statement-breakpoint
CREATE TRIGGER b2b_order_stock AFTER INSERT OR UPDATE OF quantity OR DELETE ON b2b_order_items FOR EACH ROW EXECUTE FUNCTION adjust_b2b_stock();
