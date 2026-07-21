ALTER TABLE "student_planned_lessons"
ADD COLUMN "planned_date" DATE;

UPDATE "student_planned_lessons"
SET "planned_date" = "week_anchor_date"
WHERE "planned_date" IS NULL;

UPDATE "student_planned_lessons"
SET "week_anchor_date" = date_trunc('week', "planned_date")::date
WHERE "source_type" = 'legacy_v2_import';

ALTER TABLE "student_planned_lessons"
ALTER COLUMN "planned_date" SET NOT NULL;

ALTER TABLE "student_planned_lessons"
ADD CONSTRAINT "student_planned_lessons_planned_date_in_week_check"
CHECK (
  "planned_date" >= "week_anchor_date"
  AND "planned_date" < ("week_anchor_date" + 7)
);

CREATE INDEX "student_planned_lessons_planned_date_idx"
ON "student_planned_lessons"("planned_date");
