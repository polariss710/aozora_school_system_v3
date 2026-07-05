-- CreateEnum
CREATE TYPE "ExpenseRecordStatus" AS ENUM ('pending', 'voided', 'cash_confirmed');

-- AlterTable
ALTER TABLE "cash_requests" ADD COLUMN     "expense_record_id" UUID;

-- CreateTable
CREATE TABLE "expense_records" (
    "id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "teacher_id" UUID,
    "business_entity_id" UUID,
    "year_month" VARCHAR(7),
    "title" TEXT NOT NULL,
    "original_currency" "CurrencyCode" NOT NULL,
    "original_amount_jpy" INTEGER,
    "original_amount_cny" DECIMAL(12,2),
    "record_status" "ExpenseRecordStatus" NOT NULL DEFAULT 'pending',
    "cash_status" "CashRequestStatus" NOT NULL DEFAULT 'not_requested',
    "memo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "expense_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_records_source_type_source_id_idx" ON "expense_records"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "expense_records_teacher_id_year_month_idx" ON "expense_records"("teacher_id", "year_month");

-- CreateIndex
CREATE INDEX "expense_records_business_entity_id_idx" ON "expense_records"("business_entity_id");

-- CreateIndex
CREATE INDEX "expense_records_record_status_idx" ON "expense_records"("record_status");

-- CreateIndex
CREATE INDEX "expense_records_cash_status_idx" ON "expense_records"("cash_status");

-- CreateIndex
CREATE INDEX "cash_requests_expense_record_id_idx" ON "cash_requests"("expense_record_id");

-- AddForeignKey
ALTER TABLE "teacher_wage_snapshots" ADD CONSTRAINT "teacher_wage_snapshots_expense_record_id_fkey" FOREIGN KEY ("expense_record_id") REFERENCES "expense_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_records" ADD CONSTRAINT "expense_records_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_records" ADD CONSTRAINT "expense_records_business_entity_id_fkey" FOREIGN KEY ("business_entity_id") REFERENCES "business_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_requests" ADD CONSTRAINT "cash_requests_expense_record_id_fkey" FOREIGN KEY ("expense_record_id") REFERENCES "expense_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
