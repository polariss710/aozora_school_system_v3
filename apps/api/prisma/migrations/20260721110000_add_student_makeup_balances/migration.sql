CREATE TYPE "MakeupBalanceStatus" AS ENUM ('open', 'exhausted', 'voided');

CREATE TABLE "student_makeup_balances" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "business_entity_id" UUID NOT NULL,
  "source_planned_lesson_id" UUID NOT NULL,
  "source_actual_lesson_id" UUID,
  "source_reason" VARCHAR(40) NOT NULL,
  "source_duration_hours" DECIMAL(6,2) NOT NULL,
  "remaining_duration_hours" DECIMAL(6,2) NOT NULL,
  "status" "MakeupBalanceStatus" NOT NULL DEFAULT 'open',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "exhausted_at" TIMESTAMPTZ(6),
  "voided_at" TIMESTAMPTZ(6),
  "memo" TEXT,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_makeup_balances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_makeup_balances_source_duration_positive"
    CHECK ("source_duration_hours" > 0),
  CONSTRAINT "student_makeup_balances_remaining_duration_nonnegative"
    CHECK ("remaining_duration_hours" >= 0),
  CONSTRAINT "student_makeup_balances_remaining_not_over_source"
    CHECK ("remaining_duration_hours" <= "source_duration_hours")
);

CREATE TABLE "student_makeup_balance_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "makeup_balance_id" UUID NOT NULL,
  "actual_lesson_id" UUID NOT NULL,
  "allocated_hours" DECIMAL(6,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voided_at" TIMESTAMPTZ(6),
  CONSTRAINT "student_makeup_balance_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_makeup_balance_allocations_allocated_positive"
    CHECK ("allocated_hours" > 0)
);

CREATE UNIQUE INDEX "student_makeup_balances_source_planned_lesson_id_key"
  ON "student_makeup_balances"("source_planned_lesson_id");
CREATE UNIQUE INDEX "student_makeup_balances_source_actual_lesson_id_key"
  ON "student_makeup_balances"("source_actual_lesson_id");
CREATE INDEX "student_makeup_balances_student_id_business_entity_id_status_idx"
  ON "student_makeup_balances"("student_id", "business_entity_id", "status");
CREATE INDEX "student_makeup_balances_status_idx"
  ON "student_makeup_balances"("status");
CREATE UNIQUE INDEX "student_makeup_balance_allocations_makeup_balance_id_actual_lesson_id_key"
  ON "student_makeup_balance_allocations"("makeup_balance_id", "actual_lesson_id");
CREATE INDEX "student_makeup_balance_allocations_actual_lesson_id_idx"
  ON "student_makeup_balance_allocations"("actual_lesson_id");

ALTER TABLE "student_makeup_balances"
  ADD CONSTRAINT "student_makeup_balances_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "student_makeup_balances_business_entity_id_fkey"
  FOREIGN KEY ("business_entity_id") REFERENCES "business_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "student_makeup_balances_source_planned_lesson_id_fkey"
  FOREIGN KEY ("source_planned_lesson_id") REFERENCES "student_planned_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "student_makeup_balances_source_actual_lesson_id_fkey"
  FOREIGN KEY ("source_actual_lesson_id") REFERENCES "student_actual_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_makeup_balance_allocations"
  ADD CONSTRAINT "student_makeup_balance_allocations_makeup_balance_id_fkey"
  FOREIGN KEY ("makeup_balance_id") REFERENCES "student_makeup_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "student_makeup_balance_allocations_actual_lesson_id_fkey"
  FOREIGN KEY ("actual_lesson_id") REFERENCES "student_actual_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
