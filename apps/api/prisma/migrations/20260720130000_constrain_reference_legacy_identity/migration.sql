ALTER TABLE "students"
  ADD CONSTRAINT "students_legacy_identity_check"
  CHECK (
    ("legacy_table" IS NULL AND "legacy_id" IS NULL)
    OR (
      "legacy_table" IS NOT NULL
      AND "legacy_id" IS NOT NULL
      AND length(btrim("legacy_table")) > 0
      AND length(btrim("legacy_id")) > 0
    )
  );

CREATE UNIQUE INDEX "students_legacy_table_legacy_id_key"
  ON "students"("legacy_table", "legacy_id");

ALTER TABLE "teachers"
  ADD CONSTRAINT "teachers_legacy_identity_check"
  CHECK (
    ("legacy_table" IS NULL AND "legacy_id" IS NULL)
    OR (
      "legacy_table" IS NOT NULL
      AND "legacy_id" IS NOT NULL
      AND length(btrim("legacy_table")) > 0
      AND length(btrim("legacy_id")) > 0
    )
  );

CREATE UNIQUE INDEX "teachers_legacy_table_legacy_id_key"
  ON "teachers"("legacy_table", "legacy_id");
