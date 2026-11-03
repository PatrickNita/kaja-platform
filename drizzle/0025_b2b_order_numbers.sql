LOCK TABLE b2b_orders IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
CREATE SEQUENCE b2b_order_number_seq;
--> statement-breakpoint
ALTER TABLE b2b_orders ADD COLUMN order_number integer;
--> statement-breakpoint
WITH ranked AS (
  SELECT id,row_number() OVER (ORDER BY created_at,id)::integer AS number FROM b2b_orders
)
UPDATE b2b_orders o SET order_number=r.number FROM ranked r WHERE o.id=r.id;
--> statement-breakpoint
SELECT setval('b2b_order_number_seq',coalesce(max(order_number),0)+1,false) FROM b2b_orders;
--> statement-breakpoint
ALTER TABLE b2b_orders ALTER COLUMN order_number SET NOT NULL,
  ALTER COLUMN order_number SET DEFAULT nextval('b2b_order_number_seq'),
  ADD CONSTRAINT b2b_orders_order_number_unique UNIQUE(order_number),
  ADD CONSTRAINT b2b_orders_order_number_positive CHECK(order_number>0);
--> statement-breakpoint
ALTER SEQUENCE b2b_order_number_seq OWNED BY b2b_orders.order_number;
