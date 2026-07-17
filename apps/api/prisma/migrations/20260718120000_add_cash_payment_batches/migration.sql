CREATE TABLE "cash_payment_batches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "external_cash_batch_id" UUID NOT NULL,
  "external_cash_transaction_id" UUID NOT NULL,
  "batch_type" TEXT NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "total_amount_jpy" INTEGER,
  "total_amount_cny" DECIMAL(12,2),
  "cash_account_id" UUID NOT NULL,
  "cash_transacted_at" DATE NOT NULL,
  "teacher_id" UUID,
  "teacher_name_snapshot" TEXT NOT NULL,
  "year_month" VARCHAR(7) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'cash_confirmed',
  "approved_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "cash_payment_batches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_payment_batches_amount_check" CHECK (
    ("currency" = 'JPY' AND "total_amount_jpy" > 0 AND "total_amount_cny" IS NULL)
    OR
    ("currency" = 'CNY' AND "total_amount_cny" > 0 AND "total_amount_jpy" IS NULL)
  ),
  CONSTRAINT "cash_payment_batches_type_check" CHECK ("batch_type" = 'teacher_wage_payment'),
  CONSTRAINT "cash_payment_batches_status_check" CHECK ("status" = 'cash_confirmed')
);

CREATE TABLE "cash_payment_batch_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "batch_id" UUID NOT NULL,
  "cash_request_id" UUID NOT NULL,
  "expense_record_id" UUID NOT NULL,
  "external_cash_request_id" UUID NOT NULL,
  "amount_jpy" INTEGER,
  "amount_cny" DECIMAL(12,2),
  "item_order" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_payment_batch_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_payment_batch_items_amount_check" CHECK (
    ("amount_jpy" > 0 AND "amount_cny" IS NULL)
    OR
    ("amount_cny" > 0 AND "amount_jpy" IS NULL)
  )
);

CREATE UNIQUE INDEX "cash_payment_batches_external_cash_batch_id_key"
  ON "cash_payment_batches"("external_cash_batch_id");
CREATE UNIQUE INDEX "cash_payment_batches_external_cash_transaction_id_key"
  ON "cash_payment_batches"("external_cash_transaction_id");
CREATE INDEX "cash_payment_batches_teacher_id_year_month_idx"
  ON "cash_payment_batches"("teacher_id", "year_month");
CREATE INDEX "cash_payment_batches_status_idx"
  ON "cash_payment_batches"("status");

CREATE UNIQUE INDEX "cash_payment_batch_items_cash_request_id_key"
  ON "cash_payment_batch_items"("cash_request_id");
CREATE UNIQUE INDEX "cash_payment_batch_items_expense_record_id_key"
  ON "cash_payment_batch_items"("expense_record_id");
CREATE UNIQUE INDEX "cash_payment_batch_items_external_cash_request_id_key"
  ON "cash_payment_batch_items"("external_cash_request_id");
CREATE UNIQUE INDEX "cash_payment_batch_items_batch_id_item_order_key"
  ON "cash_payment_batch_items"("batch_id", "item_order");
CREATE INDEX "cash_payment_batch_items_batch_id_idx"
  ON "cash_payment_batch_items"("batch_id");

ALTER TABLE "cash_payment_batch_items"
  ADD CONSTRAINT "cash_payment_batch_items_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "cash_payment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_payment_batch_items"
  ADD CONSTRAINT "cash_payment_batch_items_cash_request_id_fkey"
  FOREIGN KEY ("cash_request_id") REFERENCES "cash_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_payment_batch_items"
  ADD CONSTRAINT "cash_payment_batch_items_expense_record_id_fkey"
  FOREIGN KEY ("expense_record_id") REFERENCES "expense_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
