-- PostgreSQL CHECK constraints accept NULL results. Require both provenance
-- fields explicitly whenever either one is present.

ALTER TABLE "external_work_lessons"
  DROP CONSTRAINT "external_work_lessons_historical_source_check";

ALTER TABLE "external_work_lessons"
  ADD CONSTRAINT "external_work_lessons_historical_source_check"
  CHECK (
    ("historical_import_batch_id" IS NULL AND "historical_source_row" IS NULL)
    OR (
      "historical_import_batch_id" IS NOT NULL
      AND "historical_source_row" IS NOT NULL
      AND "historical_source_row" > 0
    )
  );
