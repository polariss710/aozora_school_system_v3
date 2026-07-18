-- Reconciliation-aware cleanup for the finalized callback facts accepted in the
-- Cash staging UI on 2026-07-18. Never run this against dev or production.
begin;

do $$
declare
  v_marker constant text := 'STAGING-E2E-CROSS-1784380703210';
begin
  if (
    select count(*)
    from public.home_external_transaction_requests
    where note = v_marker
  ) <> 2 then
    raise exception 'Expected exactly two finalized Cash requests for %.', v_marker;
  end if;

  if not exists (
    select 1
    from public.home_external_transaction_requests
    where id = '37de2a9c-ba0b-4f59-a98b-4e32fe831113'::uuid
      and note = v_marker
      and status = 'approved'
      and transaction_type = 'income'
      and amount = 2200
      and created_transaction_id::text =
        '7a942033-8bd7-40f6-8804-a8e75bbdfcb9'
  ) then
    raise exception 'Approved Cash request no longer matches accepted evidence.';
  end if;

  if not exists (
    select 1
    from public.home_external_transaction_requests
    where id = '6212b91e-af6c-43f7-99a7-2b1fc86f5235'::uuid
      and note = v_marker
      and status = 'rejected'
      and transaction_type = 'expense'
      and amount = 1100
      and created_transaction_id is null
  ) then
    raise exception 'Rejected Cash request no longer matches accepted evidence.';
  end if;

  if not exists (
    select 1
    from public.cash_requests
    where id = '4d8063af-b404-4bef-a0a4-f99315fd8e4b'::uuid
      and income_record_id = 'e560d734-64ab-4b6f-8669-d512aad846bc'::uuid
      and status = 'cash_confirmed'
      and external_cash_request_id::text =
        '37de2a9c-ba0b-4f59-a98b-4e32fe831113'
      and external_cash_transaction_id::text =
        '7a942033-8bd7-40f6-8804-a8e75bbdfcb9'
  ) then
    raise exception 'Confirmed School request no longer matches accepted evidence.';
  end if;

  if not exists (
    select 1
    from public.cash_requests
    where id = '37937cc5-899f-45a7-bb02-36448117a68c'::uuid
      and expense_record_id = 'dfad10db-36a3-49bb-90d0-4d9f09e22536'::uuid
      and status = 'cash_rejected'
      and external_cash_request_id::text =
        '6212b91e-af6c-43f7-99a7-2b1fc86f5235'
      and external_cash_transaction_id is null
  ) then
    raise exception 'Rejected School request no longer matches accepted evidence.';
  end if;

  if not exists (
    select 1
    from public.income_records
    where id = 'e560d734-64ab-4b6f-8669-d512aad846bc'::uuid
      and memo = v_marker
      and cash_status = 'cash_confirmed'
  ) or not exists (
    select 1
    from public.expense_records
    where id = 'dfad10db-36a3-49bb-90d0-4d9f09e22536'::uuid
      and memo = v_marker
      and cash_status = 'cash_rejected'
  ) then
    raise exception 'School source records no longer match accepted evidence.';
  end if;

  if exists (
    select 1
    from public.account_transactions
    where income_record_id = 'e560d734-64ab-4b6f-8669-d512aad846bc'::uuid
       or expense_record_id = 'dfad10db-36a3-49bb-90d0-4d9f09e22536'::uuid
  ) then
    raise exception 'Accepted School source records gained account transactions.';
  end if;
end
$$;

delete from public.audit_events
where target_id in (
  'e560d734-64ab-4b6f-8669-d512aad846bc',
  'dfad10db-36a3-49bb-90d0-4d9f09e22536',
  '4d8063af-b404-4bef-a0a4-f99315fd8e4b',
  '37937cc5-899f-45a7-bb02-36448117a68c',
  '37de2a9c-ba0b-4f59-a98b-4e32fe831113',
  '6212b91e-af6c-43f7-99a7-2b1fc86f5235',
  '7a942033-8bd7-40f6-8804-a8e75bbdfcb9'
);

delete from public.home_external_transaction_requests
where id in (
  '37de2a9c-ba0b-4f59-a98b-4e32fe831113'::uuid,
  '6212b91e-af6c-43f7-99a7-2b1fc86f5235'::uuid
)
  and note = 'STAGING-E2E-CROSS-1784380703210';

delete from public.cash_requests
where id in (
  '4d8063af-b404-4bef-a0a4-f99315fd8e4b'::uuid,
  '37937cc5-899f-45a7-bb02-36448117a68c'::uuid
);

delete from public.home_jpy_transactions
where id = '7a942033-8bd7-40f6-8804-a8e75bbdfcb9'::uuid;

delete from public.income_records
where id = 'e560d734-64ab-4b6f-8669-d512aad846bc'::uuid
  and memo = 'STAGING-E2E-CROSS-1784380703210';

delete from public.expense_records
where id = 'dfad10db-36a3-49bb-90d0-4d9f09e22536'::uuid
  and memo = 'STAGING-E2E-CROSS-1784380703210';

do $$
begin
  if exists (
    select 1
    from public.income_records
    where memo = 'STAGING-E2E-CROSS-1784380703210'
    union all
    select 1
    from public.expense_records
    where memo = 'STAGING-E2E-CROSS-1784380703210'
    union all
    select 1
    from public.home_external_transaction_requests
    where note = 'STAGING-E2E-CROSS-1784380703210'
    union all
    select 1
    from public.cash_requests
    where id in (
      '4d8063af-b404-4bef-a0a4-f99315fd8e4b'::uuid,
      '37937cc5-899f-45a7-bb02-36448117a68c'::uuid
    )
    union all
    select 1
    from public.home_jpy_transactions
    where id = '7a942033-8bd7-40f6-8804-a8e75bbdfcb9'::uuid
  ) then
    raise exception 'Finalized callback cleanup left residual rows.';
  end if;
end
$$;

commit;

select 0 as residual_rows;
