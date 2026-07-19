\set ON_ERROR_STOP on

-- Synthetic, rollback-only verification for the V2 -> V3 migration audit
-- schema. Run only against v3-dev or v3-staging after the matching Prisma
-- migration has been applied. This script never imports production data.

begin;

insert into public.historical_external_work_import_batches (
  id,
  source_key,
  source_sha256,
  source_filename,
  import_kind,
  workplace_name_snapshot,
  period_start,
  period_end,
  expected_lesson_count,
  expected_total_jpy,
  expected_total_cny,
  source_status,
  result_snapshot,
  imported_by_snapshot,
  source_imported_at,
  source_created_at,
  migration_program_version
) values (
  '91000000-0000-4000-8000-000000000001',
  'SYNTHETIC-MIGRATION-VERIFY-20260719',
  repeat('a', 64),
  'synthetic-no-production-data.json',
  'external_work_2026',
  'STAGING-E2E-MIGRATION-WORKPLACE',
  '2025-12',
  '2026-11',
  1,
  1000,
  50,
  'verified',
  '{"synthetic":true,"productionData":false}'::jsonb,
  'migration-verifier',
  '2026-07-19T00:00:00Z',
  '2026-07-19T00:00:00Z',
  'synthetic-v1'
);

insert into public.external_workplaces (id, code, name, memo, created_at, updated_at)
values (
  '91000000-0000-4000-8000-000000000002',
  'SYNTH-MIGRATION-VERIFY',
  'STAGING-E2E-MIGRATION-WORKPLACE',
  'STAGING-E2E-MIGRATION rollback-only',
  now(),
  now()
);

insert into public.external_work_lessons (
  id,
  workplace_id,
  year_month,
  lesson_type,
  lesson_date,
  start_time,
  end_time,
  duration_hours,
  instructor_name,
  lesson_title,
  hourly_rate_jpy,
  transportation_fee_jpy,
  lesson_wage_jpy,
  status,
  source_type,
  source_id,
  historical_import_batch_id,
  historical_source_row,
  created_at,
  updated_at
) values (
  '91000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000002',
  '2026-07',
  'actual',
  '2026-07-19',
  '10:00',
  '11:00',
  1,
  'Synthetic Instructor',
  'Synthetic migration verification',
  1000,
  0,
  1000,
  'completed',
  'v2_historical_import',
  '91000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000001',
  1,
  now(),
  now()
);

insert into public.income_records (
  id,
  source_type,
  source_id,
  year_month,
  title,
  original_currency,
  original_amount_jpy,
  record_status,
  cash_status,
  memo,
  created_at,
  updated_at
) values
  (
    '91000000-0000-4000-8000-000000000004',
    'external_work',
    'synthetic-historical-income',
    '2026-07',
    'Synthetic historical confirmation',
    'JPY',
    1000,
    'historical_confirmed',
    'not_requested',
    'STAGING-E2E-MIGRATION rollback-only',
    now(),
    now()
  ),
  (
    '91000000-0000-4000-8000-000000000005',
    'external_work',
    'synthetic-synced-income',
    '2026-07',
    'Synthetic synced legacy income',
    'JPY',
    2000,
    'cash_confirmed',
    'account_transaction_created',
    'STAGING-E2E-MIGRATION rollback-only',
    now(),
    now()
  );

insert into public.migration_record_audits (
  import_batch_id,
  source_system,
  source_table,
  source_id,
  target_table,
  target_id,
  disposition,
  source_row_number,
  source_snapshot,
  source_sha256,
  migration_program_version
) values
  (
    '91000000-0000-4000-8000-000000000001',
    'school_v2',
    'school_income_records',
    '91000000-0000-4000-8000-000000000004',
    'income_records',
    '91000000-0000-4000-8000-000000000004',
    'migrated',
    1,
    '{"synthetic":true}'::jsonb,
    repeat('b', 64),
    'synthetic-v1'
  ),
  (
    '91000000-0000-4000-8000-000000000001',
    'school_v2',
    'school_actual_lessons',
    '91000000-0000-4000-8000-000000000006',
    null,
    null,
    'audit_only',
    2,
    '{"synthetic":true,"deleted":true}'::jsonb,
    repeat('c', 64),
    'synthetic-v1'
  );

insert into public.legacy_income_linkage_events (
  id,
  import_batch_id,
  income_record_id,
  source_table,
  source_id,
  source_event_type,
  legacy_business_entity_id,
  original_currency,
  original_amount,
  idempotency_key,
  sync_status,
  attempt_no,
  confirmed_at,
  retry_count,
  source_snapshot,
  source_created_at,
  source_updated_at,
  source_synced_at
) values (
  '91000000-0000-4000-8000-000000000007',
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000004',
  'school_income_records',
  '91000000-0000-4000-8000-000000000004',
  'income_received',
  '91000000-0000-4000-8000-000000000008',
  'JPY',
  1000,
  'synthetic-historical-confirmed',
  'historical_confirmed',
  1,
  '2026-07-19T00:00:00Z',
  0,
  '{"synthetic":true,"cashRequestCreated":false}'::jsonb,
  '2026-07-19T00:00:00Z',
  '2026-07-19T00:00:00Z',
  '2026-07-19T00:00:00Z'
);

insert into public.legacy_income_linkage_events (
  id,
  import_batch_id,
  income_record_id,
  source_table,
  source_id,
  source_event_type,
  legacy_business_entity_id,
  cash_user_id,
  cash_account_id,
  cash_account_name_snapshot,
  cash_account_type_snapshot,
  cash_transaction_table,
  cash_transaction_id,
  original_currency,
  original_amount,
  payment_currency,
  payment_exchange_rate,
  payment_amount,
  idempotency_key,
  sync_status,
  attempt_no,
  retry_count,
  source_snapshot,
  source_created_at,
  source_updated_at,
  source_synced_at
) values (
  '91000000-0000-4000-8000-000000000009',
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000005',
  'school_income_records',
  '91000000-0000-4000-8000-000000000005',
  'income_received',
  '91000000-0000-4000-8000-000000000008',
  '91000000-0000-4000-8000-000000000010',
  '91000000-0000-4000-8000-000000000011',
  'Synthetic JPY Account',
  'bank',
  'home_jpy_transactions',
  '91000000-0000-4000-8000-000000000012',
  'JPY',
  2000,
  'CNY',
  0.05,
  100,
  'synthetic-synced',
  'synced',
  1,
  0,
  '{"synthetic":true}'::jsonb,
  '2026-07-19T00:00:00Z',
  '2026-07-19T00:00:00Z',
  '2026-07-19T00:00:00Z'
);

do $$
begin
  begin
    insert into public.migration_record_audits (
      import_batch_id, source_system, source_table, source_id, target_table,
      target_id, disposition, source_snapshot, source_sha256,
      migration_program_version
    ) values (
      '91000000-0000-4000-8000-000000000001', 'school_v2',
      'school_income_records', '91000000-0000-4000-8000-000000000004',
      'income_records', '91000000-0000-4000-8000-000000000004', 'migrated',
      '{}'::jsonb, repeat('d', 64), 'synthetic-v1'
    );
    raise exception 'duplicate source audit was not rejected';
  exception when unique_violation then
    null;
  end;

  begin
    insert into public.migration_record_audits (
      source_system, source_table, source_id, disposition, source_snapshot,
      source_sha256, migration_program_version
    ) values (
      'school_v2', 'school_income_records',
      '91000000-0000-4000-8000-000000000013', 'migrated', '{}'::jsonb,
      repeat('e', 64), 'synthetic-v1'
    );
    raise exception 'migrated audit without target was not rejected';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.external_work_lessons (
      id, workplace_id, year_month, lesson_type, lesson_date, start_time, end_time,
      duration_hours, instructor_name, hourly_rate_jpy,
      transportation_fee_jpy, lesson_wage_jpy, status,
      historical_import_batch_id, created_at, updated_at
    ) values (
      '91000000-0000-4000-8000-000000000016',
      '91000000-0000-4000-8000-000000000002', '2026-07', 'actual',
      '2026-07-19', '12:00', '13:00', 1, 'Synthetic Instructor', 1000, 0,
      1000, 'completed', '91000000-0000-4000-8000-000000000001',
      now(), now()
    );
    raise exception 'historical lesson without source row was not rejected';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.legacy_income_linkage_events (
      id, income_record_id, source_table, source_id, source_event_type,
      legacy_business_entity_id, cash_transaction_id, original_currency,
      original_amount, idempotency_key, sync_status, attempt_no, confirmed_at,
      retry_count, source_snapshot, source_created_at, source_updated_at,
      source_synced_at
    ) values (
      '91000000-0000-4000-8000-000000000014',
      '91000000-0000-4000-8000-000000000004', 'school_income_records',
      '91000000-0000-4000-8000-000000000004', 'income_received',
      '91000000-0000-4000-8000-000000000008',
      '91000000-0000-4000-8000-000000000015', 'JPY', 1000,
      'invalid-historical-with-cash', 'historical_confirmed', 2,
      '2026-07-19T00:00:00Z', 0, '{}'::jsonb, '2026-07-19T00:00:00Z',
      '2026-07-19T00:00:00Z', '2026-07-19T00:00:00Z'
    );
    raise exception 'historical confirmation with Cash transaction was not rejected';
  exception when check_violation then
    null;
  end;

  if (select count(*) from public.historical_external_work_import_batches
      where source_key = 'SYNTHETIC-MIGRATION-VERIFY-20260719') <> 1
    or (select count(*) from public.migration_record_audits
        where import_batch_id = '91000000-0000-4000-8000-000000000001') <> 2
    or (select count(*) from public.legacy_income_linkage_events
        where import_batch_id = '91000000-0000-4000-8000-000000000001') <> 2
    or (select count(*) from public.cash_requests
        where income_record_id = '91000000-0000-4000-8000-000000000004') <> 0 then
    raise exception 'synthetic migration verification reconciliation failed';
  end if;

  raise notice 'Legacy migration audit synthetic verification: passed';
end $$;

rollback;

select
  (select count(*) from public.historical_external_work_import_batches
   where source_key = 'SYNTHETIC-MIGRATION-VERIFY-20260719') as batch_residual,
  (select count(*) from public.income_records
   where memo = 'STAGING-E2E-MIGRATION rollback-only') as income_residual,
  (select count(*) from public.external_workplaces
   where memo = 'STAGING-E2E-MIGRATION rollback-only') as workplace_residual;
