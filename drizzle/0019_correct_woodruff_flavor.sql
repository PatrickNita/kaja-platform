UPDATE workspace_items SET flavor = replace(flavor, 'Vînăriță', 'Vinariță') WHERE strpos(flavor, 'Vînăriță') > 0;
--> statement-breakpoint
UPDATE workspace_items SET body = replace(body, 'Vînăriță', 'Vinariță') WHERE section = 'catalogue' AND strpos(body, 'Vînăriță') > 0;
--> statement-breakpoint
UPDATE b2b_products SET flavor = replace(flavor, 'Vînăriță', 'Vinariță') WHERE strpos(flavor, 'Vînăriță') > 0;
--> statement-breakpoint
UPDATE b2b_order_items SET flavor = replace(flavor, 'Vînăriță', 'Vinariță') WHERE strpos(flavor, 'Vînăriță') > 0;
