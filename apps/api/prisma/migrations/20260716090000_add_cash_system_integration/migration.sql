-- Extend local Cash request attempts with the external Cash identity and sync audit trail.
ALTER TABLE "cash_requests"
  ADD COLUMN "cash_account_id" UUID,
  ADD COLUMN "cash_account_name_snapshot" TEXT,
  ADD COLUMN "cash_account_type_snapshot" TEXT,
  ADD COLUMN "cash_transacted_at" DATE,
  ADD COLUMN "external_cash_transaction_id" TEXT,
  ADD COLUMN "cash_confirmed_at" TIMESTAMPTZ(6),
  ADD COLUMN "sync_attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_sync_attempt_at" TIMESTAMPTZ(6),
  ADD COLUMN "last_sync_error" TEXT;

DROP INDEX IF EXISTS "cash_requests_external_cash_request_id_idx";

CREATE UNIQUE INDEX "cash_requests_external_cash_request_id_key"
  ON "cash_requests"("external_cash_request_id");

CREATE INDEX "cash_requests_cash_account_id_idx"
  ON "cash_requests"("cash_account_id");
