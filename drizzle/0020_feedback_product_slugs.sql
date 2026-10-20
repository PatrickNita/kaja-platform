ALTER TABLE workspace_items ADD COLUMN feedback_slug varchar(200);
--> statement-breakpoint
CREATE UNIQUE INDEX workspace_items_brand_feedback_slug_unique ON workspace_items(brand, feedback_slug) WHERE feedback_slug IS NOT NULL;
--> statement-breakpoint
CREATE FUNCTION assign_feedback_product_slug() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE base_slug text; candidate text; suffix integer := 1;
BEGIN
 IF TG_OP = 'UPDATE' THEN
   IF OLD.feedback_slug IS NOT NULL THEN NEW.feedback_slug := OLD.feedback_slug; RETURN NEW; END IF;
 END IF;
 IF NEW.section <> 'catalogue' OR nullif(btrim(NEW.product_name), '') IS NULL THEN RETURN NEW; END IF;
 base_slug := trim(both '-' from regexp_replace(translate(lower(NEW.product_name), 'ăâîșşțţ', 'aaisstt'), '[^a-z0-9]+', '-', 'g'));
 IF base_slug = '' THEN base_slug := 'produs'; END IF;
 -- A brand-level lock handles concurrent duplicates and suffix collisions.
 PERFORM pg_advisory_xact_lock(hashtextextended('feedback-slug:' || NEW.brand, 0));
 candidate := base_slug;
 WHILE EXISTS(SELECT 1 FROM workspace_items WHERE brand=NEW.brand AND feedback_slug=candidate AND id<>NEW.id) LOOP
   suffix := suffix + 1; candidate := base_slug || '-' || suffix;
 END LOOP;
 NEW.feedback_slug := candidate;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER workspace_items_feedback_slug BEFORE INSERT OR UPDATE ON workspace_items FOR EACH ROW EXECUTE FUNCTION assign_feedback_product_slug();
--> statement-breakpoint
UPDATE workspace_items SET product_name=product_name WHERE section='catalogue' AND nullif(btrim(product_name),'') IS NOT NULL AND feedback_slug IS NULL;
