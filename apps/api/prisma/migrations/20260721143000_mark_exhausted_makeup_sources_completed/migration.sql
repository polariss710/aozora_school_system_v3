-- A fully allocated makeup balance closes the original planned lesson's makeup workflow.
-- This also repairs balances completed before the status transition was introduced.
UPDATE "student_planned_lessons" AS planned_lesson
SET
  "status" = 'makeup_completed',
  "updated_at" = NOW()
FROM "student_makeup_balances" AS makeup_balance
WHERE makeup_balance."source_planned_lesson_id" = planned_lesson."id"
  AND makeup_balance."status" = 'exhausted'
  AND planned_lesson."status" IN ('makeup_pending', 'cancelled');
