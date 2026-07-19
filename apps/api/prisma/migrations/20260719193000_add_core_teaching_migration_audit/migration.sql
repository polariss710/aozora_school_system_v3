CREATE TABLE "core_teaching_migration_batches" (
  "id" UUID NOT NULL,
  "source_key" TEXT NOT NULL,
  "source_sha256" CHAR(64) NOT NULL,
  "source_filename" TEXT NOT NULL,
  "period_start" VARCHAR(7) NOT NULL,
  "period_end" VARCHAR(7) NOT NULL,
  "expected_summary" JSONB NOT NULL,
  "source_snapshot_metadata" JSONB NOT NULL,
  "migration_program_version" TEXT NOT NULL,
  "migrated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "core_teaching_migration_batches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_teaching_migration_batches_source_key_key" UNIQUE ("source_key"),
  CONSTRAINT "core_teaching_migration_batches_source_sha_check"
    CHECK ("source_sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "core_teaching_migration_batches_period_check"
    CHECK ("period_start" ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'
       AND "period_end" ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'
       AND "period_start" <= "period_end"),
  CONSTRAINT "core_teaching_migration_batches_text_check"
    CHECK (length(btrim("source_key")) > 0
       AND length(btrim("source_filename")) > 0
       AND length(btrim("migration_program_version")) > 0)
);

CREATE INDEX "core_teaching_migration_batches_period_start_period_end_idx"
  ON "core_teaching_migration_batches"("period_start", "period_end");

ALTER TABLE "migration_record_audits"
  ADD COLUMN "core_teaching_batch_id" UUID;

ALTER TABLE "migration_record_audits"
  ADD CONSTRAINT "migration_record_audits_core_teaching_batch_id_fkey"
  FOREIGN KEY ("core_teaching_batch_id")
  REFERENCES "core_teaching_migration_batches"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "migration_record_audits"
  ADD CONSTRAINT "migration_record_audits_single_batch_owner_check"
  CHECK (num_nonnulls("import_batch_id", "core_teaching_batch_id") <= 1);

CREATE INDEX "migration_record_audits_core_teaching_batch_id_disposition_idx"
  ON "migration_record_audits"("core_teaching_batch_id", "disposition");

REVOKE ALL ON TABLE "core_teaching_migration_batches" FROM anon, authenticated;
