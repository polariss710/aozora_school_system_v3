ALTER TYPE "TuitionBillStatus" ADD VALUE 'superseded';

ALTER TABLE "student_tuition_bills"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "replaces_id" UUID;

DROP INDEX "student_tuition_bills_student_id_year_month_key";

CREATE UNIQUE INDEX "student_tuition_bills_student_id_year_month_version_key"
  ON "student_tuition_bills"("student_id", "year_month", "version");

CREATE INDEX "student_tuition_bills_student_id_year_month_status_idx"
  ON "student_tuition_bills"("student_id", "year_month", "status");

CREATE INDEX "student_tuition_bills_replaces_id_idx"
  ON "student_tuition_bills"("replaces_id");

ALTER TABLE "student_tuition_bills"
  ADD CONSTRAINT "student_tuition_bills_replaces_id_fkey"
  FOREIGN KEY ("replaces_id") REFERENCES "student_tuition_bills"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
