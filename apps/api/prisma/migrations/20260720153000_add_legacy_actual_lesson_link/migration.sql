ALTER TABLE "student_actual_lessons"
  ADD COLUMN "legacy_planned_lesson_id" UUID;

ALTER TABLE "student_actual_lessons"
  ADD CONSTRAINT "student_actual_lessons_legacy_planned_lesson_id_fkey"
  FOREIGN KEY ("legacy_planned_lesson_id")
  REFERENCES "student_planned_lessons"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

CREATE INDEX "student_actual_lessons_legacy_planned_lesson_id_idx"
  ON "student_actual_lessons"("legacy_planned_lesson_id");
