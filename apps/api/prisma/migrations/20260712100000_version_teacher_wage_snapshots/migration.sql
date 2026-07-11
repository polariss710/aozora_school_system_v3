ALTER TABLE "teacher_wage_snapshots"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "replaces_id" UUID;

DROP INDEX "teacher_wage_snapshots_teacher_id_year_month_business_entit_key";

CREATE UNIQUE INDEX "teacher_wage_snapshots_teacher_id_year_month_business_entity_id_version_key"
ON "teacher_wage_snapshots"("teacher_id", "year_month", "business_entity_id", "version");

CREATE INDEX "teacher_wage_snapshots_replaces_id_idx"
ON "teacher_wage_snapshots"("replaces_id");

ALTER TABLE "teacher_wage_snapshots"
ADD CONSTRAINT "teacher_wage_snapshots_replaces_id_fkey"
FOREIGN KEY ("replaces_id") REFERENCES "teacher_wage_snapshots"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
