CREATE TABLE "receipt_records" (
  "id" UUID NOT NULL,
  "receipt_serial" BIGSERIAL NOT NULL,
  "receipt_no" VARCHAR(32) NOT NULL,
  "income_record_id" UUID NOT NULL,
  "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issued_by_id" UUID,
  "snapshot_issued_by_name" TEXT NOT NULL,
  "snapshot_payment_date" DATE NOT NULL,
  "snapshot_currency" "CurrencyCode" NOT NULL,
  "snapshot_amount_jpy" INTEGER,
  "snapshot_amount_cny" DECIMAL(12,2),
  "snapshot_student_name" TEXT NOT NULL,
  "snapshot_business_entity_name" TEXT NOT NULL,
  "snapshot_item" TEXT NOT NULL,
  "snapshot_description" TEXT NOT NULL,
  "snapshot_business_month" VARCHAR(7),
  "snapshot_income_title" TEXT NOT NULL,
  "snapshot_memo" TEXT,
  "authority_source" TEXT NOT NULL,
  "source_cash_request_id" UUID NOT NULL,
  "source_account_transaction_id" UUID,
  "external_cash_request_id" TEXT,
  "external_cash_event_id" TEXT,
  "pdf_metadata" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "receipt_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "receipt_records_receipt_serial_key"
  ON "receipt_records"("receipt_serial");

CREATE UNIQUE INDEX "receipt_records_receipt_no_key"
  ON "receipt_records"("receipt_no");

CREATE UNIQUE INDEX "receipt_records_income_record_id_key"
  ON "receipt_records"("income_record_id");

CREATE INDEX "receipt_records_issued_at_idx"
  ON "receipt_records"("issued_at");

CREATE INDEX "receipt_records_issued_by_id_idx"
  ON "receipt_records"("issued_by_id");

CREATE INDEX "receipt_records_snapshot_student_name_idx"
  ON "receipt_records"("snapshot_student_name");

ALTER TABLE "receipt_records"
  ADD CONSTRAINT "receipt_records_income_record_id_fkey"
  FOREIGN KEY ("income_record_id") REFERENCES "income_records"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "receipt_records"
  ADD CONSTRAINT "receipt_records_issued_by_id_fkey"
  FOREIGN KEY ("issued_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
