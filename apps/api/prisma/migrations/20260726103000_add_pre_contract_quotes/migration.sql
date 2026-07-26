CREATE TYPE "ProspectiveStudentStatus" AS ENUM ('active', 'archived');
CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'shared', 'accepted', 'declined', 'archived');

CREATE TABLE "prospective_students" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "status" "ProspectiveStudentStatus" NOT NULL DEFAULT 'active',
  "memo" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prospective_students_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quotes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "prospective_student_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "course_track" VARCHAR(40) NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "exchange_rate" DECIMAL(18,7) NOT NULL,
  "total_hours" DECIMAL(10,2) NOT NULL,
  "total_jpy" INTEGER NOT NULL,
  "total_cny" DECIMAL(18,2) NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'draft',
  "note" TEXT,
  "calculation_snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quotes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quotes_period_check" CHECK ("end_date" >= "start_date"),
  CONSTRAINT "quotes_exchange_rate_positive" CHECK ("exchange_rate" > 0),
  CONSTRAINT "quotes_total_hours_nonnegative" CHECK ("total_hours" >= 0),
  CONSTRAINT "quotes_total_jpy_nonnegative" CHECK ("total_jpy" >= 0),
  CONSTRAINT "quotes_total_cny_nonnegative" CHECK ("total_cny" >= 0)
);

CREATE TABLE "quote_courses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "quote_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "hours_per_session" DECIMAL(6,2) NOT NULL,
  "weekly_frequency" INTEGER NOT NULL,
  "unit_price_jpy" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quote_courses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quote_courses_hours_positive" CHECK ("hours_per_session" > 0),
  CONSTRAINT "quote_courses_frequency_positive" CHECK ("weekly_frequency" > 0),
  CONSTRAINT "quote_courses_unit_price_nonnegative" CHECK ("unit_price_jpy" >= 0)
);

CREATE INDEX "prospective_students_status_idx" ON "prospective_students"("status");
CREATE INDEX "prospective_students_name_idx" ON "prospective_students"("name");
CREATE INDEX "quotes_prospective_student_id_idx" ON "quotes"("prospective_student_id");
CREATE INDEX "quotes_status_idx" ON "quotes"("status");
CREATE INDEX "quotes_start_date_idx" ON "quotes"("start_date");
CREATE UNIQUE INDEX "quote_courses_quote_id_sort_order_key" ON "quote_courses"("quote_id", "sort_order");
CREATE INDEX "quote_courses_quote_id_idx" ON "quote_courses"("quote_id");

ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_prospective_student_id_fkey"
  FOREIGN KEY ("prospective_student_id") REFERENCES "prospective_students"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quote_courses"
  ADD CONSTRAINT "quote_courses_quote_id_fkey"
  FOREIGN KEY ("quote_id") REFERENCES "quotes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
