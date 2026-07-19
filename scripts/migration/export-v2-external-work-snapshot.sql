\set ON_ERROR_STOP on

-- Read-only V2 source snapshot for the V3 private-tutoring migration plan.
-- Run only with a dedicated School V2 read-only connection. This file has no
-- DML, DDL, RPC, COPY, or file-writing statements. The single JSON result is
-- intentionally returned to the caller; it must be stored outside the repo.

begin transaction isolation level repeatable read read only;
set local statement_timeout = '90s';
set local lock_timeout = '5s';

with snapshot_context as (
  select transaction_timestamp() as captured_at
), batches as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'sourceKey', b.source_key,
    'sourceSha256', b.source_sha256,
    'sourceFilename', b.source_filename,
    'importKind', b.import_kind,
    'workplaceNameSnapshot', b.workplace_name,
    'periodStart', b.period_start,
    'periodEnd', b.period_end,
    'expectedLessonCount', b.expected_lesson_count,
    'expectedTotalJpy', b.expected_total_jpy,
    'expectedTotalCny', b.expected_total_cny,
    'sourceStatus', b.status,
    'resultSnapshot', b.result_snapshot,
    'importedBySnapshot', b.imported_by,
    'sourceImportedAt', b.imported_at,
    'sourceCreatedAt', b.created_at
  ) order by b.id), '[]'::jsonb) as rows
  from public.school_historical_part_time_work_import_batches b
  where b.period_end >= '2025-12' and b.period_start <= '2026-11'
), lessons as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'workplaceName', l.workplace_name,
    'yearMonth', l.year_month,
    'recordKind', l.record_kind,
    'plannedLessonId', l.planned_lesson_id,
    'workDate', to_char(l.work_date, 'YYYY-MM-DD'),
    'startTime', to_char(l.start_time, 'HH24:MI'),
    'endTime', to_char(l.end_time, 'HH24:MI'),
    'plannedHours', l.planned_hours,
    'actualHours', l.actual_hours,
    'teacherName', l.teacher_name,
    'subjectName', l.subject_name,
    'classDescription', l.class_description,
    'hourlyRateJpy', l.hourly_rate_jpy,
    'transportationFeeJpy', l.transportation_fee_jpy,
    'lessonWageJpy', l.lesson_wage_jpy,
    'memo', l.memo,
    'historicalImportBatchId', l.historical_import_batch_id,
    'historicalSourceRow', l.historical_source_row,
    'createdAt', l.created_at,
    'updatedAt', l.updated_at,
    'deletedAt', l.deleted_at
  ) order by l.id), '[]'::jsonb) as rows
  from public.school_part_time_work_lessons l
  where l.year_month between '2025-12' and '2026-11'
), settlements as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'workplaceName', s.workplace_name,
    'yearMonth', s.year_month,
    'actualLessonCount', s.actual_lesson_count,
    'actualHoursTotal', s.actual_hours_total,
    'lessonWageJpy', s.lesson_wage_jpy,
    'transportationFeeJpy', s.transportation_fee_jpy,
    'adjustmentJpy', s.adjustment_jpy,
    'totalWageJpy', s.total_wage_jpy,
    'status', s.status,
    'incomeRecordId', s.income_record_id,
    'lockedAt', s.locked_at,
    'memo', s.memo,
    'createdAt', s.created_at,
    'updatedAt', s.updated_at,
    'deletedAt', s.deleted_at
  ) order by s.id), '[]'::jsonb) as rows
  from public.school_part_time_work_monthly_settlements s
  where s.year_month between '2025-12' and '2026-11'
), settlement_details as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'settlementId', d.settlement_id,
    'actualLessonId', d.actual_lesson_id,
    'workDate', to_char(d.work_date, 'YYYY-MM-DD'),
    'startTime', to_char(d.start_time, 'HH24:MI'),
    'endTime', to_char(d.end_time, 'HH24:MI'),
    'actualHours', d.actual_hours,
    'teacherName', s.teacher_name,
    'subjectName', d.subject_name,
    'classDescription', d.class_description,
    'hourlyRateJpy', d.hourly_rate_jpy,
    'lessonWageJpy', d.lesson_wage_jpy,
    'transportationFeeJpy', d.transportation_fee_jpy,
    'memo', d.memo,
    'createdAt', d.created_at,
    'updatedAt', d.created_at,
    'deletedAt', null
  ) order by d.id), '[]'::jsonb) as rows
  from public.school_part_time_work_monthly_settlement_details d
  join public.school_part_time_work_monthly_settlements s on s.id = d.settlement_id
  where s.year_month between '2025-12' and '2026-11'
), incomes as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'sourceType', i.source_type,
    'sourceId', i.source_id,
    'yearMonth', i.year_month,
    'title', coalesce(i.description, 'Private tutoring work ' || i.year_month),
    'currency', i.currency,
    'amount', i.amount,
    'memo', i.note,
    'createdAt', i.created_at,
    'updatedAt', i.updated_at
  ) order by i.id), '[]'::jsonb) as rows
  from public.school_income_records i
  join public.school_part_time_work_monthly_settlements s on s.income_record_id = i.id
  where s.year_month between '2025-12' and '2026-11'
), linkage_events as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'incomeRecordId', e.income_record_id,
    'sourceTable', e.source_table,
    'sourceId', e.source_id,
    'sourceEventType', e.source_event_type,
    'legacyBusinessEntityId', e.business_entity_id,
    'cashAccountMappingId', e.cash_account_mapping_id,
    'cashUserId', e.cash_user_id,
    'cashAccountId', e.cash_account_id,
    'cashAccountNameSnapshot', e.cash_account_name_snapshot,
    'cashAccountTypeSnapshot', e.cash_account_type_snapshot,
    'cashTransactionTable', e.cash_transaction_table,
    'cashTransactionId', e.cash_transaction_id,
    'originalCurrency', e.currency,
    'originalAmount', e.amount,
    'paymentCurrency', e.payment_currency,
    'paymentExchangeRate', e.payment_exchange_rate,
    'paymentAmount', e.payment_amount,
    'idempotencyKey', e.idempotency_key,
    'syncStatus', e.sync_status,
    'attemptNo', e.attempt_no,
    'cashRequestId', e.cash_request_id,
    'cashRequestStatus', e.cash_request_status,
    'requestedAt', e.requested_at,
    'confirmedAt', e.confirmed_at,
    'rejectedAt', e.rejected_at,
    'rejectedReason', e.rejected_reason,
    'cashRequestLastCheckedAt', e.cash_request_last_checked_at,
    'retryCount', e.retry_count,
    'lastError', e.last_error,
    'note', e.note,
    'createdAt', e.created_at,
    'updatedAt', e.updated_at,
    'syncedAt', e.synced_at
  ) order by e.id), '[]'::jsonb) as rows
  from public.school_personal_cash_income_linkage_events e
  join public.school_part_time_work_monthly_settlements s on s.income_record_id = e.income_record_id
  where s.year_month between '2025-12' and '2026-11'
), legacy_income_requests as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'settlementId', r.settlement_id,
    'cashRequestId', r.cash_request_id,
    'cashTransactionId', r.cash_transaction_id,
    'status', r.status,
    'cashRequestStatus', r.cash_request_status,
    'amountJpy', r.amount_jpy,
    'createdAt', r.created_at,
    'updatedAt', r.updated_at,
    'deletedAt', r.deleted_at
  ) order by r.id), '[]'::jsonb) as rows
  from public.school_part_time_work_income_requests r
  join public.school_part_time_work_monthly_settlements s on s.id = r.settlement_id
  where s.year_month between '2025-12' and '2026-11'
)
select jsonb_build_object(
  'contractVersion', 'aozora-v2-external-work-snapshot-v1',
  'scope', jsonb_build_object('yearMonthFrom', '2025-12', 'yearMonthTo', '2026-11'),
  'sourceSnapshot', jsonb_build_object(
    'sourceSystem', 'school_v2',
    'capturedAt', (select captured_at from snapshot_context),
    'isolation', 'repeatable_read_read_only'
  ),
  'batches', (select rows from batches),
  'lessons', (select rows from lessons),
  'settlements', (select rows from settlements),
  'settlementDetails', (select rows from settlement_details),
  'incomes', (select rows from incomes),
  'linkageEvents', (select rows from linkage_events),
  'legacyIncomeRequests', (select rows from legacy_income_requests)
) as migration_snapshot;

rollback;
