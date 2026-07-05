-- CreateEnum
CREATE TYPE "AccountTransferStatus" AS ENUM ('completed', 'voided');

-- CreateTable
CREATE TABLE "account_transfers" (
    "id" UUID NOT NULL,
    "from_account_id" UUID NOT NULL,
    "to_account_id" UUID NOT NULL,
    "from_transaction_id" UUID NOT NULL,
    "to_transaction_id" UUID NOT NULL,
    "transfer_date" DATE NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "amount_jpy" INTEGER,
    "amount_cny" DECIMAL(12,2),
    "status" "AccountTransferStatus" NOT NULL DEFAULT 'completed',
    "memo" TEXT,
    "voided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "account_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_transfers_from_transaction_id_key" ON "account_transfers"("from_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_transfers_to_transaction_id_key" ON "account_transfers"("to_transaction_id");

-- CreateIndex
CREATE INDEX "account_transfers_transfer_date_idx" ON "account_transfers"("transfer_date");

-- CreateIndex
CREATE INDEX "account_transfers_from_account_id_idx" ON "account_transfers"("from_account_id");

-- CreateIndex
CREATE INDEX "account_transfers_to_account_id_idx" ON "account_transfers"("to_account_id");

-- CreateIndex
CREATE INDEX "account_transfers_status_idx" ON "account_transfers"("status");

-- AddForeignKey
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_from_transaction_id_fkey" FOREIGN KEY ("from_transaction_id") REFERENCES "account_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_to_transaction_id_fkey" FOREIGN KEY ("to_transaction_id") REFERENCES "account_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
