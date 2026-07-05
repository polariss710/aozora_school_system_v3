-- CreateEnum
CREATE TYPE "TeacherWageSnapshotStatus" AS ENUM ('locked', 'adjustment_confirmed', 'expense_created', 'revoked');

-- CreateEnum
CREATE TYPE "TeacherWageAdjustmentStatus" AS ENUM ('none', 'exported', 'imported', 'manual_adjusted', 'confirmed');

-- CreateTable
CREATE TABLE "teacher_wage_rules" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "business_entity_id" UUID NOT NULL,
    "hourly_rate_jpy" INTEGER NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "memo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "teacher_wage_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_wage_snapshots" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "year_month" VARCHAR(7) NOT NULL,
    "business_entity_id" UUID NOT NULL,
    "lesson_count" INTEGER NOT NULL,
    "total_lesson_hours" DECIMAL(8,2) NOT NULL,
    "base_wage_jpy" INTEGER NOT NULL,
    "transportation_fee_jpy" INTEGER NOT NULL DEFAULT 0,
    "classroom_fee_jpy" INTEGER NOT NULL DEFAULT 0,
    "manual_adjustment_jpy" INTEGER NOT NULL DEFAULT 0,
    "total_wage_jpy" INTEGER NOT NULL,
    "status" "TeacherWageSnapshotStatus" NOT NULL DEFAULT 'locked',
    "adjustment_status" "TeacherWageAdjustmentStatus" NOT NULL DEFAULT 'none',
    "calculation_snapshot" JSONB NOT NULL,
    "expense_record_id" UUID,
    "locked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "memo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "teacher_wage_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_wage_snapshot_details" (
    "id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "actual_lesson_id" UUID NOT NULL,
    "actual_date" DATE NOT NULL,
    "duration_hours" DECIMAL(6,2) NOT NULL,
    "hourly_rate_jpy" INTEGER NOT NULL,
    "lesson_wage_jpy" INTEGER NOT NULL,
    "teacher_wage_eligible" BOOLEAN NOT NULL,
    "included_in_wage" BOOLEAN NOT NULL DEFAULT true,
    "student_name_snapshot" TEXT,
    "subject_name_snapshot" TEXT,
    "content_snapshot" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "teacher_wage_snapshot_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_wage_rules_teacher_id_idx" ON "teacher_wage_rules"("teacher_id");

-- CreateIndex
CREATE INDEX "teacher_wage_rules_business_entity_id_idx" ON "teacher_wage_rules"("business_entity_id");

-- CreateIndex
CREATE INDEX "teacher_wage_rules_status_idx" ON "teacher_wage_rules"("status");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_wage_rules_teacher_id_business_entity_id_key" ON "teacher_wage_rules"("teacher_id", "business_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_wage_snapshots_expense_record_id_key" ON "teacher_wage_snapshots"("expense_record_id");

-- CreateIndex
CREATE INDEX "teacher_wage_snapshots_year_month_idx" ON "teacher_wage_snapshots"("year_month");

-- CreateIndex
CREATE INDEX "teacher_wage_snapshots_teacher_id_year_month_idx" ON "teacher_wage_snapshots"("teacher_id", "year_month");

-- CreateIndex
CREATE INDEX "teacher_wage_snapshots_business_entity_id_idx" ON "teacher_wage_snapshots"("business_entity_id");

-- CreateIndex
CREATE INDEX "teacher_wage_snapshots_status_idx" ON "teacher_wage_snapshots"("status");

-- CreateIndex
CREATE INDEX "teacher_wage_snapshots_adjustment_status_idx" ON "teacher_wage_snapshots"("adjustment_status");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_wage_snapshots_teacher_id_year_month_business_entit_key" ON "teacher_wage_snapshots"("teacher_id", "year_month", "business_entity_id");

-- CreateIndex
CREATE INDEX "teacher_wage_snapshot_details_actual_lesson_id_idx" ON "teacher_wage_snapshot_details"("actual_lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_wage_snapshot_details_snapshot_id_actual_lesson_id_key" ON "teacher_wage_snapshot_details"("snapshot_id", "actual_lesson_id");

-- AddForeignKey
ALTER TABLE "teacher_wage_rules" ADD CONSTRAINT "teacher_wage_rules_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_wage_rules" ADD CONSTRAINT "teacher_wage_rules_business_entity_id_fkey" FOREIGN KEY ("business_entity_id") REFERENCES "business_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_wage_snapshots" ADD CONSTRAINT "teacher_wage_snapshots_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_wage_snapshots" ADD CONSTRAINT "teacher_wage_snapshots_business_entity_id_fkey" FOREIGN KEY ("business_entity_id") REFERENCES "business_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_wage_snapshot_details" ADD CONSTRAINT "teacher_wage_snapshot_details_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "teacher_wage_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_wage_snapshot_details" ADD CONSTRAINT "teacher_wage_snapshot_details_actual_lesson_id_fkey" FOREIGN KEY ("actual_lesson_id") REFERENCES "student_actual_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
