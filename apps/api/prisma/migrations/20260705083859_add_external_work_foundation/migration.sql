-- CreateEnum
CREATE TYPE "ExternalWorkLessonType" AS ENUM ('planned', 'actual');

-- CreateEnum
CREATE TYPE "ExternalWorkLessonStatus" AS ENUM ('scheduled', 'actual_created', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ExternalWorkSettlementStatus" AS ENUM ('locked', 'income_created', 'revoked');

-- CreateTable
CREATE TABLE "external_work_lessons" (
    "id" UUID NOT NULL,
    "workplace_id" UUID NOT NULL,
    "year_month" VARCHAR(7) NOT NULL,
    "lesson_type" "ExternalWorkLessonType" NOT NULL,
    "planned_lesson_id" UUID,
    "lesson_date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "duration_hours" DECIMAL(6,2) NOT NULL,
    "instructor_name" TEXT NOT NULL,
    "lesson_title" TEXT,
    "hourly_rate_jpy" INTEGER NOT NULL,
    "transportation_fee_jpy" INTEGER NOT NULL DEFAULT 0,
    "lesson_wage_jpy" INTEGER NOT NULL,
    "status" "ExternalWorkLessonStatus" NOT NULL DEFAULT 'scheduled',
    "content" TEXT,
    "memo" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'manual',
    "source_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "external_work_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_work_monthly_settlements" (
    "id" UUID NOT NULL,
    "workplace_id" UUID NOT NULL,
    "year_month" VARCHAR(7) NOT NULL,
    "lesson_count" INTEGER NOT NULL,
    "total_lesson_hours" DECIMAL(8,2) NOT NULL,
    "lesson_wage_jpy" INTEGER NOT NULL,
    "transportation_fee_jpy" INTEGER NOT NULL DEFAULT 0,
    "adjustment_amount_jpy" INTEGER NOT NULL DEFAULT 0,
    "total_amount_jpy" INTEGER NOT NULL,
    "status" "ExternalWorkSettlementStatus" NOT NULL DEFAULT 'locked',
    "calculation_snapshot" JSONB NOT NULL,
    "income_record_id" UUID,
    "locked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "memo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "external_work_monthly_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_work_settlement_details" (
    "id" UUID NOT NULL,
    "settlement_id" UUID NOT NULL,
    "actual_lesson_id" UUID NOT NULL,
    "lesson_date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "duration_hours" DECIMAL(6,2) NOT NULL,
    "instructor_name_snapshot" TEXT NOT NULL,
    "lesson_title_snapshot" TEXT,
    "hourly_rate_jpy" INTEGER NOT NULL,
    "lesson_wage_jpy" INTEGER NOT NULL,
    "transportation_fee_jpy" INTEGER NOT NULL,
    "content_snapshot" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "external_work_settlement_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_work_lessons_planned_lesson_id_key" ON "external_work_lessons"("planned_lesson_id");

-- CreateIndex
CREATE INDEX "external_work_lessons_workplace_id_year_month_idx" ON "external_work_lessons"("workplace_id", "year_month");

-- CreateIndex
CREATE INDEX "external_work_lessons_year_month_idx" ON "external_work_lessons"("year_month");

-- CreateIndex
CREATE INDEX "external_work_lessons_lesson_type_idx" ON "external_work_lessons"("lesson_type");

-- CreateIndex
CREATE INDEX "external_work_lessons_status_idx" ON "external_work_lessons"("status");

-- CreateIndex
CREATE INDEX "external_work_lessons_lesson_date_idx" ON "external_work_lessons"("lesson_date");

-- CreateIndex
CREATE UNIQUE INDEX "external_work_monthly_settlements_income_record_id_key" ON "external_work_monthly_settlements"("income_record_id");

-- CreateIndex
CREATE INDEX "external_work_monthly_settlements_year_month_idx" ON "external_work_monthly_settlements"("year_month");

-- CreateIndex
CREATE INDEX "external_work_monthly_settlements_status_idx" ON "external_work_monthly_settlements"("status");

-- CreateIndex
CREATE UNIQUE INDEX "external_work_monthly_settlements_workplace_id_year_month_key" ON "external_work_monthly_settlements"("workplace_id", "year_month");

-- CreateIndex
CREATE INDEX "external_work_settlement_details_actual_lesson_id_idx" ON "external_work_settlement_details"("actual_lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_work_settlement_details_settlement_id_actual_lesso_key" ON "external_work_settlement_details"("settlement_id", "actual_lesson_id");

-- AddForeignKey
ALTER TABLE "external_work_lessons" ADD CONSTRAINT "external_work_lessons_workplace_id_fkey" FOREIGN KEY ("workplace_id") REFERENCES "external_workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_work_lessons" ADD CONSTRAINT "external_work_lessons_planned_lesson_id_fkey" FOREIGN KEY ("planned_lesson_id") REFERENCES "external_work_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_work_monthly_settlements" ADD CONSTRAINT "external_work_monthly_settlements_workplace_id_fkey" FOREIGN KEY ("workplace_id") REFERENCES "external_workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_work_monthly_settlements" ADD CONSTRAINT "external_work_monthly_settlements_income_record_id_fkey" FOREIGN KEY ("income_record_id") REFERENCES "income_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_work_settlement_details" ADD CONSTRAINT "external_work_settlement_details_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "external_work_monthly_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_work_settlement_details" ADD CONSTRAINT "external_work_settlement_details_actual_lesson_id_fkey" FOREIGN KEY ("actual_lesson_id") REFERENCES "external_work_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
