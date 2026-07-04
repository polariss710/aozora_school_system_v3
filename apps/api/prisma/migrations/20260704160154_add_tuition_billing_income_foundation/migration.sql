-- CreateEnum
CREATE TYPE "TuitionBillStatus" AS ENUM ('generated', 'income_created', 'voided');

-- CreateEnum
CREATE TYPE "IncomeRecordStatus" AS ENUM ('pending', 'voided', 'cash_confirmed');

-- CreateEnum
CREATE TYPE "CashRequestStatus" AS ENUM ('not_requested', 'cash_requested', 'cash_rejected', 'cash_confirmed', 'account_transaction_created', 'needs_manual_review');

-- CreateTable
CREATE TABLE "student_tuition_bills" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "year_month" VARCHAR(7) NOT NULL,
    "planned_lesson_count" INTEGER NOT NULL,
    "planned_amount_jpy" INTEGER NOT NULL,
    "carryover_amount_cny" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "TuitionBillStatus" NOT NULL DEFAULT 'generated',
    "calculation_snapshot" JSONB NOT NULL,
    "income_record_id" UUID,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_tuition_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_records" (
    "id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "student_id" UUID,
    "business_entity_id" UUID,
    "year_month" VARCHAR(7),
    "title" TEXT NOT NULL,
    "original_currency" "CurrencyCode" NOT NULL,
    "original_amount_jpy" INTEGER,
    "original_amount_cny" DECIMAL(12,2),
    "carryover_amount_cny" DECIMAL(12,2),
    "record_status" "IncomeRecordStatus" NOT NULL DEFAULT 'pending',
    "cash_status" "CashRequestStatus" NOT NULL DEFAULT 'not_requested',
    "memo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "income_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_tuition_bills_income_record_id_key" ON "student_tuition_bills"("income_record_id");

-- CreateIndex
CREATE INDEX "student_tuition_bills_year_month_idx" ON "student_tuition_bills"("year_month");

-- CreateIndex
CREATE INDEX "student_tuition_bills_status_idx" ON "student_tuition_bills"("status");

-- CreateIndex
CREATE UNIQUE INDEX "student_tuition_bills_student_id_year_month_key" ON "student_tuition_bills"("student_id", "year_month");

-- CreateIndex
CREATE INDEX "income_records_source_type_source_id_idx" ON "income_records"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "income_records_student_id_year_month_idx" ON "income_records"("student_id", "year_month");

-- CreateIndex
CREATE INDEX "income_records_business_entity_id_idx" ON "income_records"("business_entity_id");

-- CreateIndex
CREATE INDEX "income_records_record_status_idx" ON "income_records"("record_status");

-- CreateIndex
CREATE INDEX "income_records_cash_status_idx" ON "income_records"("cash_status");

-- AddForeignKey
ALTER TABLE "student_tuition_bills" ADD CONSTRAINT "student_tuition_bills_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_tuition_bills" ADD CONSTRAINT "student_tuition_bills_income_record_id_fkey" FOREIGN KEY ("income_record_id") REFERENCES "income_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_records" ADD CONSTRAINT "income_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_records" ADD CONSTRAINT "income_records_business_entity_id_fkey" FOREIGN KEY ("business_entity_id") REFERENCES "business_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
