-- CreateEnum
CREATE TYPE "CashInboundEventStatus" AS ENUM ('account_transaction_created', 'rejected');

-- CreateTable
CREATE TABLE "cash_inbound_events" (
    "id" UUID NOT NULL,
    "external_cash_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL DEFAULT 'cash_to_school_corporate_deposit',
    "corporate_account_id" UUID NOT NULL,
    "account_transaction_id" UUID NOT NULL,
    "event_date" DATE NOT NULL,
    "source_currency" "CurrencyCode",
    "source_amount_jpy" INTEGER,
    "source_amount_cny" DECIMAL(12,2),
    "target_currency" "CurrencyCode" NOT NULL,
    "target_amount_jpy" INTEGER,
    "target_amount_cny" DECIMAL(12,2),
    "exchange_rate" DECIMAL(18,8),
    "fee_currency" "CurrencyCode",
    "fee_amount_jpy" INTEGER,
    "fee_amount_cny" DECIMAL(12,2),
    "linked_income_record_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CashInboundEventStatus" NOT NULL DEFAULT 'account_transaction_created',
    "memo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cash_inbound_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_inbound_events_external_cash_event_id_key" ON "cash_inbound_events"("external_cash_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_inbound_events_account_transaction_id_key" ON "cash_inbound_events"("account_transaction_id");

-- CreateIndex
CREATE INDEX "cash_inbound_events_event_date_idx" ON "cash_inbound_events"("event_date");

-- CreateIndex
CREATE INDEX "cash_inbound_events_event_type_idx" ON "cash_inbound_events"("event_type");

-- CreateIndex
CREATE INDEX "cash_inbound_events_corporate_account_id_idx" ON "cash_inbound_events"("corporate_account_id");

-- CreateIndex
CREATE INDEX "cash_inbound_events_status_idx" ON "cash_inbound_events"("status");

-- AddForeignKey
ALTER TABLE "cash_inbound_events" ADD CONSTRAINT "cash_inbound_events_corporate_account_id_fkey" FOREIGN KEY ("corporate_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_inbound_events" ADD CONSTRAINT "cash_inbound_events_account_transaction_id_fkey" FOREIGN KEY ("account_transaction_id") REFERENCES "account_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
