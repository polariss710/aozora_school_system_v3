-- CreateEnum
CREATE TYPE "CashRequestDirection" AS ENUM ('income', 'expense');

-- CreateTable
CREATE TABLE "cash_requests" (
    "id" UUID NOT NULL,
    "direction" "CashRequestDirection" NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "income_record_id" UUID,
    "status" "CashRequestStatus" NOT NULL DEFAULT 'cash_requested',
    "expected_currency" "CurrencyCode" NOT NULL,
    "expected_amount_jpy" INTEGER,
    "expected_amount_cny" DECIMAL(12,2),
    "carryover_amount_cny" DECIMAL(12,2),
    "requested_currency" "CurrencyCode" NOT NULL,
    "requested_amount_jpy" INTEGER,
    "requested_amount_cny" DECIMAL(12,2),
    "exchange_rate" DECIMAL(18,8),
    "exchange_rate_source" TEXT,
    "conversion_method" TEXT,
    "cash_account_code" TEXT,
    "external_cash_request_id" TEXT,
    "external_cash_event_id" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cash_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_requests_direction_idx" ON "cash_requests"("direction");

-- CreateIndex
CREATE INDEX "cash_requests_source_type_source_id_idx" ON "cash_requests"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "cash_requests_income_record_id_idx" ON "cash_requests"("income_record_id");

-- CreateIndex
CREATE INDEX "cash_requests_status_idx" ON "cash_requests"("status");

-- CreateIndex
CREATE INDEX "cash_requests_external_cash_request_id_idx" ON "cash_requests"("external_cash_request_id");

-- AddForeignKey
ALTER TABLE "cash_requests" ADD CONSTRAINT "cash_requests_income_record_id_fkey" FOREIGN KEY ("income_record_id") REFERENCES "income_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
