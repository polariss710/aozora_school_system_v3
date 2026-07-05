-- CreateEnum
CREATE TYPE "AccountTransactionDirection" AS ENUM ('in', 'out');

-- CreateEnum
CREATE TYPE "AccountTransactionStatus" AS ENUM ('active', 'reversed');

-- CreateTable
CREATE TABLE "account_transactions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "direction" "AccountTransactionDirection" NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "income_record_id" UUID,
    "expense_record_id" UUID,
    "transaction_date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "amount_jpy" INTEGER,
    "amount_cny" DECIMAL(12,2),
    "status" "AccountTransactionStatus" NOT NULL DEFAULT 'active',
    "idempotency_key" TEXT,
    "external_event_id" TEXT,
    "memo" TEXT,
    "reversed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "account_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_transactions_idempotency_key_key" ON "account_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "account_transactions_account_id_transaction_date_idx" ON "account_transactions"("account_id", "transaction_date");

-- CreateIndex
CREATE INDEX "account_transactions_direction_idx" ON "account_transactions"("direction");

-- CreateIndex
CREATE INDEX "account_transactions_source_type_source_id_idx" ON "account_transactions"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "account_transactions_income_record_id_idx" ON "account_transactions"("income_record_id");

-- CreateIndex
CREATE INDEX "account_transactions_expense_record_id_idx" ON "account_transactions"("expense_record_id");

-- CreateIndex
CREATE INDEX "account_transactions_status_idx" ON "account_transactions"("status");

-- AddForeignKey
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_income_record_id_fkey" FOREIGN KEY ("income_record_id") REFERENCES "income_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_expense_record_id_fkey" FOREIGN KEY ("expense_record_id") REFERENCES "expense_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
