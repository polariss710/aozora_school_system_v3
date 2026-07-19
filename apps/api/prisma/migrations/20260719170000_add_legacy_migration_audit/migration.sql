-- Preserve V2 external-work import provenance and legacy Cash linkage without
-- turning historical confirmations into new operational Cash requests.

ALTER TYPE "IncomeRecordStatus" ADD VALUE 'historical_confirmed';

CREATE TYPE "MigrationRecordDisposition" AS ENUM ('migrated', 'audit_only', 'skipped');
CREATE TYPE "LegacyIncomeLinkageStatus" AS ENUM (
  'pending',
  'pending_cash_request',
  'awaiting_cash_confirmation',
  'synced',
  'historical_confirmed',
  'cash_rejected',
  'failed',
  'blocked'
);

CREATE TABLE "historical_external_work_import_batches" (
  "id" UUID NOT NULL,
  "source_key" TEXT NOT NULL,
  "source_sha256" CHAR(64) NOT NULL,
  "source_filename" TEXT NOT NULL,
  "import_kind" TEXT NOT NULL,
  "workplace_name_snapshot" TEXT NOT NULL,
  "period_start" VARCHAR(7) NOT NULL,
  "period_end" VARCHAR(7) NOT NULL,
  "expected_lesson_count" INTEGER NOT NULL,
  "expected_total_jpy" INTEGER NOT NULL,
  "expected_total_cny" DECIMAL(14,2) NOT NULL,
  "source_status" TEXT NOT NULL,
  "result_snapshot" JSONB NOT NULL,
  "imported_by_snapshot" TEXT NOT NULL,
  "source_imported_at" TIMESTAMPTZ(6) NOT NULL,
  "source_created_at" TIMESTAMPTZ(6) NOT NULL,
  "migration_program_version" TEXT NOT NULL,
  "migrated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "historical_external_work_import_batches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "historical_external_work_import_batches_sha_check"
    CHECK ("source_sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "historical_external_work_import_batches_period_check"
    CHECK (
      "period_start" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
      AND "period_end" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
      AND "period_start" <= "period_end"
    ),
  CONSTRAINT "historical_external_work_import_batches_totals_check"
    CHECK (
      "expected_lesson_count" >= 0
      AND "expected_total_jpy" >= 0
      AND "expected_total_cny" >= 0
    ),
  CONSTRAINT "historical_external_work_import_batches_text_check"
    CHECK (
      length(trim("source_key")) > 0
      AND length(trim("source_filename")) > 0
      AND length(trim("workplace_name_snapshot")) > 0
      AND length(trim("migration_program_version")) > 0
    )
);

CREATE UNIQUE INDEX "historical_external_work_import_batches_source_key_key"
  ON "historical_external_work_import_batches"("source_key");
CREATE INDEX "historical_external_work_import_batches_period_start_period_idx"
  ON "historical_external_work_import_batches"("period_start", "period_end");

ALTER TABLE "external_work_lessons"
  ADD COLUMN "historical_import_batch_id" UUID,
  ADD COLUMN "historical_source_row" INTEGER;

ALTER TABLE "external_work_lessons"
  ADD CONSTRAINT "external_work_lessons_historical_source_check"
  CHECK (
    ("historical_import_batch_id" IS NULL AND "historical_source_row" IS NULL)
    OR ("historical_import_batch_id" IS NOT NULL AND "historical_source_row" > 0)
  );

CREATE UNIQUE INDEX "external_work_lessons_historical_import_batch_id_historical_key"
  ON "external_work_lessons"("historical_import_batch_id", "historical_source_row", "lesson_type");

ALTER TABLE "external_work_lessons"
  ADD CONSTRAINT "external_work_lessons_historical_import_batch_id_fkey"
  FOREIGN KEY ("historical_import_batch_id")
  REFERENCES "historical_external_work_import_batches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "migration_record_audits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "import_batch_id" UUID,
  "source_system" TEXT NOT NULL,
  "source_table" TEXT NOT NULL,
  "source_id" UUID NOT NULL,
  "target_table" TEXT,
  "target_id" UUID,
  "disposition" "MigrationRecordDisposition" NOT NULL,
  "source_row_number" INTEGER,
  "source_snapshot" JSONB NOT NULL,
  "source_sha256" CHAR(64) NOT NULL,
  "migration_program_version" TEXT NOT NULL,
  "migrated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "migration_record_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "migration_record_audits_source_sha_check"
    CHECK ("source_sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "migration_record_audits_target_pair_check"
    CHECK (
      ("target_table" IS NULL AND "target_id" IS NULL)
      OR ("target_table" IS NOT NULL AND "target_id" IS NOT NULL)
    ),
  CONSTRAINT "migration_record_audits_disposition_target_check"
    CHECK (
      ("disposition" = 'migrated' AND "target_id" IS NOT NULL)
      OR ("disposition" IN ('audit_only', 'skipped') AND "target_id" IS NULL)
    ),
  CONSTRAINT "migration_record_audits_source_row_check"
    CHECK ("source_row_number" IS NULL OR "source_row_number" > 0),
  CONSTRAINT "migration_record_audits_text_check"
    CHECK (
      length(trim("source_system")) > 0
      AND length(trim("source_table")) > 0
      AND length(trim("migration_program_version")) > 0
    )
);

CREATE UNIQUE INDEX "migration_record_audits_source_system_source_table_source_i_key"
  ON "migration_record_audits"("source_system", "source_table", "source_id");
CREATE UNIQUE INDEX "migration_record_audits_target_table_target_id_key"
  ON "migration_record_audits"("target_table", "target_id");
CREATE INDEX "migration_record_audits_import_batch_id_disposition_idx"
  ON "migration_record_audits"("import_batch_id", "disposition");

ALTER TABLE "migration_record_audits"
  ADD CONSTRAINT "migration_record_audits_import_batch_id_fkey"
  FOREIGN KEY ("import_batch_id")
  REFERENCES "historical_external_work_import_batches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "legacy_income_linkage_events" (
  "id" UUID NOT NULL,
  "import_batch_id" UUID,
  "income_record_id" UUID NOT NULL,
  "source_table" TEXT NOT NULL,
  "source_id" UUID NOT NULL,
  "source_event_type" TEXT NOT NULL,
  "legacy_business_entity_id" UUID NOT NULL,
  "cash_account_mapping_id" UUID,
  "cash_user_id" UUID,
  "cash_account_id" UUID,
  "cash_account_name_snapshot" TEXT,
  "cash_account_type_snapshot" TEXT,
  "cash_transaction_table" TEXT,
  "cash_transaction_id" UUID,
  "original_currency" "CurrencyCode" NOT NULL,
  "original_amount" DECIMAL(14,2) NOT NULL,
  "payment_currency" "CurrencyCode",
  "payment_exchange_rate" DECIMAL(18,8),
  "payment_amount" DECIMAL(14,2),
  "idempotency_key" TEXT NOT NULL,
  "sync_status" "LegacyIncomeLinkageStatus" NOT NULL,
  "attempt_no" INTEGER NOT NULL,
  "cash_request_id" UUID,
  "cash_request_status" TEXT,
  "requested_at" TIMESTAMPTZ(6),
  "confirmed_at" TIMESTAMPTZ(6),
  "rejected_at" TIMESTAMPTZ(6),
  "rejected_reason" TEXT,
  "cash_request_last_checked_at" TIMESTAMPTZ(6),
  "retry_count" INTEGER NOT NULL,
  "last_error" TEXT,
  "note" TEXT,
  "source_snapshot" JSONB NOT NULL,
  "source_created_at" TIMESTAMPTZ(6) NOT NULL,
  "source_updated_at" TIMESTAMPTZ(6) NOT NULL,
  "source_synced_at" TIMESTAMPTZ(6),
  "migrated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "legacy_income_linkage_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "legacy_income_linkage_events_source_check"
    CHECK ("source_table" = 'school_income_records' AND "source_id" = "income_record_id"),
  CONSTRAINT "legacy_income_linkage_events_event_type_check"
    CHECK ("source_event_type" IN ('income_received', 'tuition_income_received')),
  CONSTRAINT "legacy_income_linkage_events_cash_table_check"
    CHECK (
      "cash_transaction_table" IS NULL
      OR "cash_transaction_table" IN ('home_jpy_transactions', 'home_cny_transactions')
    ),
  CONSTRAINT "legacy_income_linkage_events_amount_check"
    CHECK (
      "original_amount" > 0
      AND ("payment_amount" IS NULL OR "payment_amount" > 0)
      AND ("payment_exchange_rate" IS NULL OR "payment_exchange_rate" > 0)
    ),
  CONSTRAINT "legacy_income_linkage_events_attempt_check"
    CHECK ("attempt_no" > 0 AND "retry_count" >= 0),
  CONSTRAINT "legacy_income_linkage_events_idempotency_check"
    CHECK (length(trim("idempotency_key")) > 0),
  CONSTRAINT "legacy_income_linkage_events_synced_transaction_check"
    CHECK ("sync_status" <> 'synced' OR "cash_transaction_id" IS NOT NULL),
  CONSTRAINT "legacy_income_linkage_events_context_check"
    CHECK (
      (
        "sync_status" = 'historical_confirmed'
        AND "cash_user_id" IS NULL
        AND "cash_account_id" IS NULL
        AND "cash_account_name_snapshot" IS NULL
        AND "cash_transaction_table" IS NULL
        AND "cash_transaction_id" IS NULL
        AND "cash_request_id" IS NULL
        AND "confirmed_at" IS NOT NULL
        AND "source_synced_at" IS NOT NULL
      )
      OR (
        "sync_status" <> 'historical_confirmed'
        AND "cash_user_id" IS NOT NULL
        AND "cash_account_id" IS NOT NULL
        AND "cash_account_name_snapshot" IS NOT NULL
        AND "cash_transaction_table" IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX "legacy_income_linkage_events_idempotency_key_key"
  ON "legacy_income_linkage_events"("idempotency_key");
CREATE UNIQUE INDEX "legacy_income_linkage_events_source_table_source_id_source__key"
  ON "legacy_income_linkage_events"("source_table", "source_id", "source_event_type", "attempt_no");
CREATE INDEX "legacy_income_linkage_events_income_record_id_idx"
  ON "legacy_income_linkage_events"("income_record_id");
CREATE INDEX "legacy_income_linkage_events_cash_transaction_id_idx"
  ON "legacy_income_linkage_events"("cash_transaction_id");
CREATE INDEX "legacy_income_linkage_events_sync_status_idx"
  ON "legacy_income_linkage_events"("sync_status");

ALTER TABLE "legacy_income_linkage_events"
  ADD CONSTRAINT "legacy_income_linkage_events_import_batch_id_fkey"
  FOREIGN KEY ("import_batch_id")
  REFERENCES "historical_external_work_import_batches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legacy_income_linkage_events"
  ADD CONSTRAINT "legacy_income_linkage_events_income_record_id_fkey"
  FOREIGN KEY ("income_record_id")
  REFERENCES "income_records"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

REVOKE ALL ON TABLE "historical_external_work_import_batches" FROM anon, authenticated;
REVOKE ALL ON TABLE "migration_record_audits" FROM anon, authenticated;
REVOKE ALL ON TABLE "legacy_income_linkage_events" FROM anon, authenticated;
