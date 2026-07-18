-- Read-only inventory for synthetic staging acceptance records.
select
  (select count(*) from public.students where memo like 'STAGING-E2E-%') as students,
  (select count(*) from public.teachers where memo like 'STAGING-E2E-%') as teachers,
  (select count(*) from public.income_records where memo like 'STAGING-E2E-%') as incomes,
  (select count(*) from public.expense_records where memo like 'STAGING-E2E-%') as expenses,
  (select count(*) from public.account_transactions where memo like 'STAGING-E2E-%') as account_transactions,
  (
    select count(*)
    from public.cash_requests cr
    left join public.income_records i on i.id = cr.income_record_id
    left join public.expense_records e on e.id = cr.expense_record_id
    where coalesce(i.memo, e.memo) like 'STAGING-E2E-%'
  ) as school_cash_requests,
  (
    select count(*)
    from public.home_external_transaction_requests
    where note like 'STAGING-E2E-%'
  ) as external_cash_requests;

