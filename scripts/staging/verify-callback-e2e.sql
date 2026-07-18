-- Read-only reconciliation for retained STAGING-E2E School/Cash callback facts.
select
  er.transaction_type,
  er.status as cash_status,
  er.created_transaction_id,
  cr.status as school_request_status,
  cr.external_cash_transaction_id,
  coalesce(i.record_status::text, e.record_status::text) as record_status,
  coalesce(i.cash_status::text, e.cash_status::text) as record_cash_status,
  cr.id::text = er.external_event_id::text as event_matches,
  coalesce(cr.income_record_id, cr.expense_record_id)::text =
    er.external_reference_id::text as reference_matches,
  coalesce(cr.requested_amount_jpy::numeric, cr.requested_amount_cny) =
    er.amount::numeric as amount_matches,
  cr.cash_account_id::text = er.account_id::text as account_matches,
  (
    select count(*)
    from public.home_jpy_transactions t
    where t.id::text = er.created_transaction_id::text
  ) as transaction_count,
  (
    select count(*)
    from public.audit_events a
    where a.target_id = cr.id::text
      and a.action in (
        'cash_request.external_confirm',
        'cash_request.external_reject'
      )
  ) as result_audit_count
from public.home_external_transaction_requests er
join public.cash_requests cr
  on cr.external_cash_request_id::text = er.id::text
left join public.income_records i on i.id = cr.income_record_id
left join public.expense_records e on e.id = cr.expense_record_id
where er.note like 'STAGING-E2E-%'
order by er.requested_at desc, er.transaction_type;

