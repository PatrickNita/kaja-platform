UPDATE "activity"
SET "summary" = replace("summary", 'actualizarea', 'propunerea')
WHERE "entity_type" = 'update'
  AND "summary" LIKE '%actualizarea%';
