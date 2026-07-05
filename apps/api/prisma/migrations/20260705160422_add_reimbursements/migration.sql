-- CreateEnum
CREATE TYPE "ReimbursementStatus" AS ENUM ('completed', 'voided');

-- CreateTable
CREATE TABLE "reimbursement_records" (
    "id" UUID NOT NULL,
    "expense_record_id" UUID NOT NULL,
    "corporate_account_id" UUID NOT NULL,
    "advance_account_id" UUID NOT NULL,
    "corporate_transaction_id" UUID NOT NULL,
    "advance_transaction_id" UUID NOT NULL,
    "reimbursement_date" DATE NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "amount_jpy" INTEGER,
    "amount_cny" DECIMAL(12,2),
    "status" "ReimbursementStatus" NOT NULL DEFAULT 'completed',
    "memo" TEXT,
    "voided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reimbursement_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reimbursement_records_expense_record_id_key" ON "reimbursement_records"("expense_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "reimbursement_records_corporate_transaction_id_key" ON "reimbursement_records"("corporate_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "reimbursement_records_advance_transaction_id_key" ON "reimbursement_records"("advance_transaction_id");

-- CreateIndex
CREATE INDEX "reimbursement_records_reimbursement_date_idx" ON "reimbursement_records"("reimbursement_date");

-- CreateIndex
CREATE INDEX "reimbursement_records_corporate_account_id_idx" ON "reimbursement_records"("corporate_account_id");

-- CreateIndex
CREATE INDEX "reimbursement_records_advance_account_id_idx" ON "reimbursement_records"("advance_account_id");

-- CreateIndex
CREATE INDEX "reimbursement_records_status_idx" ON "reimbursement_records"("status");

-- AddForeignKey
ALTER TABLE "reimbursement_records" ADD CONSTRAINT "reimbursement_records_expense_record_id_fkey" FOREIGN KEY ("expense_record_id") REFERENCES "expense_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursement_records" ADD CONSTRAINT "reimbursement_records_corporate_account_id_fkey" FOREIGN KEY ("corporate_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursement_records" ADD CONSTRAINT "reimbursement_records_advance_account_id_fkey" FOREIGN KEY ("advance_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursement_records" ADD CONSTRAINT "reimbursement_records_corporate_transaction_id_fkey" FOREIGN KEY ("corporate_transaction_id") REFERENCES "account_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursement_records" ADD CONSTRAINT "reimbursement_records_advance_transaction_id_fkey" FOREIGN KEY ("advance_transaction_id") REFERENCES "account_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
