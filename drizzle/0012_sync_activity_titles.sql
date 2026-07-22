UPDATE "activity" AS a
SET
	"summary" = CASE
		WHEN strpos(a."summary", '„') > 0
			AND strpos(reverse(a."summary"), '”') > 0
			AND length(a."summary") - strpos(reverse(a."summary"), '”') + 1 > strpos(a."summary", '„')
		THEN left(a."summary", strpos(a."summary", '„') - 1)
			|| '„' || u."title" || '”'
			|| substring(a."summary" FROM length(a."summary") - strpos(reverse(a."summary"), '”') + 2)
		ELSE a."summary"
	END,
	"title" = u."title"
FROM "updates" AS u
WHERE a."brand" = u."brand"
	AND a."entity_type" = 'update'
	AND a."entity_id" = u."id";
--> statement-breakpoint
UPDATE "activity" AS a
SET
	"summary" = CASE
		WHEN strpos(a."summary", '„') > 0
			AND strpos(reverse(a."summary"), '”') > 0
			AND length(a."summary") - strpos(reverse(a."summary"), '”') + 1 > strpos(a."summary", '„')
		THEN left(a."summary", strpos(a."summary", '„') - 1)
			|| '„' || t."title" || '”'
			|| substring(a."summary" FROM length(a."summary") - strpos(reverse(a."summary"), '”') + 2)
		ELSE a."summary"
	END,
	"title" = t."title"
FROM "tasks" AS t
WHERE a."brand" = t."brand"
	AND a."entity_type" = 'task'
	AND a."entity_id" = t."id";
--> statement-breakpoint
UPDATE "activity" AS a
SET
	"summary" = CASE
		WHEN strpos(a."summary", '„') > 0
			AND strpos(reverse(a."summary"), '”') > 0
			AND length(a."summary") - strpos(reverse(a."summary"), '”') + 1 > strpos(a."summary", '„')
		THEN left(a."summary", strpos(a."summary", '„') - 1)
			|| '„' || w."title" || '”'
			|| substring(a."summary" FROM length(a."summary") - strpos(reverse(a."summary"), '”') + 2)
		ELSE a."summary"
	END,
	"title" = w."title"
FROM "workspace_items" AS w
WHERE a."brand" = w."brand"
	AND a."entity_type" = w."section"
	AND a."entity_id" = w."id"
	AND w."section" IN ('events', 'catalogue', 'merch', 'information');
