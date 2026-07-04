-- CreateEnum
CREATE TYPE "StudentSettlementStatus" AS ENUM ('locked', 'revoked');

-- CreateTable
CREATE TABLE "student_monthly_settlements" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "year_month" VARCHAR(7) NOT NULL,
    "planned_lesson_count" INTEGER NOT NULL,
    "billable_lesson_count" INTEGER NOT NULL,
    "cancelled_lesson_count" INTEGER NOT NULL,
    "actual_lesson_count" INTEGER NOT NULL,
    "planned_amount_jpy" INTEGER NOT NULL,
    "billable_amount_jpy" INTEGER NOT NULL,
    "received_amount_jpy" INTEGER NOT NULL DEFAULT 0,
    "received_amount_cny" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "previous_carryover_amount_cny" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "settlement_exchange_rate" DECIMAL(18,8),
    "adjustment_amount_cny" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "carryover_amount_cny" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "StudentSettlementStatus" NOT NULL DEFAULT 'locked',
    "calculation_snapshot" JSONB NOT NULL,
    "locked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "memo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_monthly_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_monthly_settlements_year_month_idx" ON "student_monthly_settlements"("year_month");

-- CreateIndex
CREATE INDEX "student_monthly_settlements_status_idx" ON "student_monthly_settlements"("status");

-- CreateIndex
CREATE UNIQUE INDEX "student_monthly_settlements_student_id_year_month_key" ON "student_monthly_settlements"("student_id", "year_month");

-- AddForeignKey
ALTER TABLE "student_monthly_settlements" ADD CONSTRAINT "student_monthly_settlements_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
