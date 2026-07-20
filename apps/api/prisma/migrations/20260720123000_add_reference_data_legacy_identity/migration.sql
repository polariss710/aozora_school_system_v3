ALTER TABLE "business_entities"
  ADD COLUMN "legacy_table" TEXT,
  ADD COLUMN "legacy_id" TEXT;

ALTER TABLE "business_entities"
  ADD CONSTRAINT "business_entities_legacy_identity_check"
  CHECK (
    ("legacy_table" IS NULL AND "legacy_id" IS NULL)
    OR (
      "legacy_table" IS NOT NULL
      AND "legacy_id" IS NOT NULL
      AND length(btrim("legacy_table")) > 0
      AND length(btrim("legacy_id")) > 0
    )
  );

CREATE UNIQUE INDEX "business_entities_legacy_table_legacy_id_key"
  ON "business_entities"("legacy_table", "legacy_id");

ALTER TABLE "subjects"
  ADD COLUMN "legacy_table" TEXT,
  ADD COLUMN "legacy_id" TEXT;

ALTER TABLE "subjects"
  ADD CONSTRAINT "subjects_legacy_identity_check"
  CHECK (
    ("legacy_table" IS NULL AND "legacy_id" IS NULL)
    OR (
      "legacy_table" IS NOT NULL
      AND "legacy_id" IS NOT NULL
      AND length(btrim("legacy_table")) > 0
      AND length(btrim("legacy_id")) > 0
    )
  );

CREATE UNIQUE INDEX "subjects_legacy_table_legacy_id_key"
  ON "subjects"("legacy_table", "legacy_id");
