-- New business is consolidated under Aozora School. The personal entity remains
-- available for historical relations and audit, but cannot receive new records.
UPDATE "business_entities"
SET
  "status" = 'archived',
  "memo" = CASE
    WHEN "memo" IS NULL OR btrim("memo") = '' THEN '历史业务归属；不再接受新业务。'
    WHEN "memo" NOT LIKE '%不再接受新业务%' THEN "memo" || ' 历史业务归属；不再接受新业务。'
    ELSE "memo"
  END,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'personal';

UPDATE "business_entities"
SET
  "status" = 'active',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'aozora_school';
