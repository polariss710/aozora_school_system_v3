-- CreateEnum
CREATE TYPE "PlannedLessonStatus" AS ENUM ('scheduled', 'actual_created', 'makeup_pending', 'makeup_completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ActualLessonStatus" AS ENUM ('completed', 'cancelled');

-- CreateTable
CREATE TABLE "student_planned_lessons" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "business_entity_id" UUID NOT NULL,
    "year_month" VARCHAR(7) NOT NULL,
    "week_anchor_date" DATE NOT NULL,
    "lesson_no" INTEGER,
    "planned_start_time" VARCHAR(5),
    "planned_end_time" VARCHAR(5),
    "duration_hours" DECIMAL(6,2) NOT NULL,
    "planned_fee_jpy" INTEGER NOT NULL,
    "content" TEXT,
    "memo" TEXT,
    "status" "PlannedLessonStatus" NOT NULL DEFAULT 'scheduled',
    "source_type" TEXT NOT NULL DEFAULT 'manual',
    "source_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_planned_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_actual_lessons" (
    "id" UUID NOT NULL,
    "planned_lesson_id" UUID,
    "student_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "business_entity_id" UUID NOT NULL,
    "year_month" VARCHAR(7) NOT NULL,
    "actual_date" DATE NOT NULL,
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "duration_hours" DECIMAL(6,2) NOT NULL,
    "content" TEXT,
    "memo" TEXT,
    "status" "ActualLessonStatus" NOT NULL DEFAULT 'completed',
    "teacher_wage_eligible" BOOLEAN NOT NULL DEFAULT true,
    "source_type" TEXT NOT NULL DEFAULT 'planned_lesson',
    "source_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_actual_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_planned_lessons_year_month_idx" ON "student_planned_lessons"("year_month");

-- CreateIndex
CREATE INDEX "student_planned_lessons_student_id_year_month_idx" ON "student_planned_lessons"("student_id", "year_month");

-- CreateIndex
CREATE INDEX "student_planned_lessons_teacher_id_year_month_idx" ON "student_planned_lessons"("teacher_id", "year_month");

-- CreateIndex
CREATE INDEX "student_planned_lessons_subject_id_idx" ON "student_planned_lessons"("subject_id");

-- CreateIndex
CREATE INDEX "student_planned_lessons_business_entity_id_idx" ON "student_planned_lessons"("business_entity_id");

-- CreateIndex
CREATE INDEX "student_planned_lessons_status_idx" ON "student_planned_lessons"("status");

-- CreateIndex
CREATE INDEX "student_planned_lessons_week_anchor_date_idx" ON "student_planned_lessons"("week_anchor_date");

-- CreateIndex
CREATE UNIQUE INDEX "student_actual_lessons_planned_lesson_id_key" ON "student_actual_lessons"("planned_lesson_id");

-- CreateIndex
CREATE INDEX "student_actual_lessons_year_month_idx" ON "student_actual_lessons"("year_month");

-- CreateIndex
CREATE INDEX "student_actual_lessons_student_id_year_month_idx" ON "student_actual_lessons"("student_id", "year_month");

-- CreateIndex
CREATE INDEX "student_actual_lessons_teacher_id_year_month_idx" ON "student_actual_lessons"("teacher_id", "year_month");

-- CreateIndex
CREATE INDEX "student_actual_lessons_subject_id_idx" ON "student_actual_lessons"("subject_id");

-- CreateIndex
CREATE INDEX "student_actual_lessons_business_entity_id_idx" ON "student_actual_lessons"("business_entity_id");

-- CreateIndex
CREATE INDEX "student_actual_lessons_status_idx" ON "student_actual_lessons"("status");

-- CreateIndex
CREATE INDEX "student_actual_lessons_actual_date_idx" ON "student_actual_lessons"("actual_date");

-- AddForeignKey
ALTER TABLE "student_planned_lessons" ADD CONSTRAINT "student_planned_lessons_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_planned_lessons" ADD CONSTRAINT "student_planned_lessons_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_planned_lessons" ADD CONSTRAINT "student_planned_lessons_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_planned_lessons" ADD CONSTRAINT "student_planned_lessons_business_entity_id_fkey" FOREIGN KEY ("business_entity_id") REFERENCES "business_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_actual_lessons" ADD CONSTRAINT "student_actual_lessons_planned_lesson_id_fkey" FOREIGN KEY ("planned_lesson_id") REFERENCES "student_planned_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_actual_lessons" ADD CONSTRAINT "student_actual_lessons_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_actual_lessons" ADD CONSTRAINT "student_actual_lessons_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_actual_lessons" ADD CONSTRAINT "student_actual_lessons_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_actual_lessons" ADD CONSTRAINT "student_actual_lessons_business_entity_id_fkey" FOREIGN KEY ("business_entity_id") REFERENCES "business_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
