\set ON_ERROR_STOP on

begin transaction isolation level repeatable read read only;
set local statement_timeout = '90s';
set local lock_timeout = '5s';

with requested_tables(table_name, migration_scope) as (
  values
    ('school_business_entities', 'reference_closure'),
    ('school_students', 'reference_closure'),
    ('school_teachers', 'reference_closure'),
    ('school_subjects', 'reference_closure'),
    ('school_lesson_records', '2026-07-plus'),
    ('school_student_monthly_settlements', '2026-07-plus'),
    ('school_student_settlement_adjustments', '2026-07-plus'),
    ('school_student_settlement_carryovers', '2026-07-plus'),
    ('school_student_tuition_bills', '2026-07-plus'),
    ('school_teacher_wage_rules', 'reference_closure'),
    ('school_teacher_wage_locks', '2026-07-plus'),
    ('school_teacher_wage_lock_details', '2026-07-plus'),
    ('school_teacher_wage_detail_adjustments', '2026-07-plus'),
    ('school_income_records', 'follow_source_scope'),
    ('school_expense_records', 'follow_source_scope'),
    ('school_expense_attachments', 'follow_source_scope'),
    ('school_payment_requests', 'legacy_audit_only')
),
table_inventory as (
  select
    requested.table_name,
    requested.migration_scope,
    exists(
      select 1
        from information_schema.tables t
       where t.table_schema = 'public'
         and t.table_name = requested.table_name
    ) as exists_in_source
  from requested_tables requested
),
column_inventory as (
  select
    c.table_name,
    c.ordinal_position,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    c.column_default
  from information_schema.columns c
  join requested_tables requested on requested.table_name = c.table_name
  where c.table_schema = 'public'
),
foreign_key_inventory as (
  select
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name as referenced_table,
    ccu.column_name as referenced_column
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_catalog = kcu.constraint_catalog
   and tc.constraint_schema = kcu.constraint_schema
   and tc.constraint_name = kcu.constraint_name
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_catalog = tc.constraint_catalog
   and ccu.constraint_schema = tc.constraint_schema
   and ccu.constraint_name = tc.constraint_name
  join requested_tables requested on requested.table_name = tc.table_name
  where tc.table_schema = 'public'
    and tc.constraint_type = 'FOREIGN KEY'
)
select jsonb_build_object(
  'contractVersion', 'aozora-v2-core-teaching-inventory-v1',
  'sourceSnapshot', jsonb_build_object(
    'sourceSystem', 'school_v2',
    'capturedAt', clock_timestamp(),
    'isolation', 'repeatable_read_read_only',
    'containsBusinessRows', false
  ),
  'tables', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'tableName', table_name,
      'migrationScope', migration_scope,
      'existsInSource', exists_in_source
    ) order by table_name), '[]'::jsonb)
    from table_inventory
  ),
  'columns', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'tableName', table_name,
      'ordinalPosition', ordinal_position,
      'columnName', column_name,
      'dataType', data_type,
      'udtName', udt_name,
      'nullable', is_nullable,
      'default', column_default
    ) order by table_name, ordinal_position), '[]'::jsonb)
    from column_inventory
  ),
  'foreignKeys', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'tableName', table_name,
      'constraintName', constraint_name,
      'columnName', column_name,
      'referencedTable', referenced_table,
      'referencedColumn', referenced_column
    ) order by table_name, constraint_name, column_name), '[]'::jsonb)
    from foreign_key_inventory
  )
) as core_teaching_inventory;

rollback;
