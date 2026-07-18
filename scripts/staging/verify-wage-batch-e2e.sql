begin;

do $$
declare
  v_batch public.home_external_transaction_batches%rowtype;
  v_marker text;
  v_cash_item_count integer;
  v_cash_item_total numeric(14,2);
  v_school_batch_count integer;
  v_school_item_count integer;
  v_school_item_total numeric(14,2);
  v_confirmed_expense_count integer;
  v_confirm_audit_count integer;
  v_guard_message text;
begin
  select b.* into v_batch
  from public.home_external_transaction_batches b
  join public.home_external_transaction_batch_items bi on bi.batch_id = b.id
  join public.expense_records e on e.id = bi.external_reference_id
  where e.memo like 'STAGING-E2E-WAGE-BATCH-%'
  group by b.id
  having count(*) = 2
  order by b.approved_at desc
  limit 1;

  if v_batch.id is null then
    raise exception 'No retained staging wage batch was found.';
  end if;

  select min(e.memo), count(*), sum(bi.amount)
  into v_marker, v_cash_item_count, v_cash_item_total
  from public.home_external_transaction_batch_items bi
  join public.expense_records e on e.id = bi.external_reference_id
  where bi.batch_id = v_batch.id;

  if v_cash_item_count <> 2 or v_cash_item_total <> 3900
    or v_batch.request_count <> 2 or v_batch.total_amount <> 3900
    or v_batch.currency <> 'JPY' or v_batch.status <> 'approved'
    or v_batch.school_payment_batch_id is null or v_batch.school_synced_at is null then
    raise exception 'Cash wage batch header/items are inconsistent.';
  end if;

  if exists (
    select 1
    from public.home_external_transaction_batch_items bi
    join public.home_external_transaction_requests r on r.id = bi.request_id
    where bi.batch_id = v_batch.id
      and (r.status <> 'approved' or r.created_transaction_id <> v_batch.created_transaction_id)
  ) then
    raise exception 'Cash requests do not share the approved aggregate transaction.';
  end if;

  if not exists (
    select 1 from public.home_jpy_transactions t
    where t.id = v_batch.created_transaction_id
      and t.transaction_type = 'expense'
      and t.currency = 'JPY'
      and t.amount = 3900
      and t.external_source = 'aozora_school'
      and t.external_source_id = v_batch.id
      and t.external_event_type = 'teacher_wage_batch_paid'
      and t.external_reference_type = 'school_expense_batches'
      and t.external_reference_id = v_batch.id
      and t.created_by_external = true
  ) then
    raise exception 'Aggregate JPY transaction is inconsistent.';
  end if;

  select count(*) into v_school_batch_count
  from public.cash_payment_batches pb
  where pb.id = v_batch.school_payment_batch_id
    and pb.external_cash_batch_id = v_batch.id
    and pb.external_cash_transaction_id = v_batch.created_transaction_id
    and pb.total_amount_jpy = 3900
    and pb.status = 'cash_confirmed';

  select count(*), sum(pi.amount_jpy)
  into v_school_item_count, v_school_item_total
  from public.cash_payment_batch_items pi
  where pi.batch_id = v_batch.school_payment_batch_id;

  select count(*) into v_confirmed_expense_count
  from public.expense_records e
  where e.memo = v_marker
    and e.source_type = 'teacher_wage_snapshot'
    and e.record_status = 'cash_confirmed'
    and e.cash_status = 'cash_confirmed';

  select count(*) into v_confirm_audit_count
  from public.audit_events a
  join public.cash_payment_batch_items pi on pi.cash_request_id::text = a.target_id
  where pi.batch_id = v_batch.school_payment_batch_id
    and a.action = 'cash_request.external_batch_confirm';

  if v_school_batch_count <> 1 or v_school_item_count <> 2
    or v_school_item_total <> 3900 or v_confirmed_expense_count <> 2
    or v_confirm_audit_count <> 2 then
    raise exception 'School wage batch callback reconciliation failed.';
  end if;

  begin
    update public.home_jpy_transactions
    set note = note
    where id = v_batch.created_transaction_id;
    raise exception 'Aggregate transaction mutation guard did not reject update.';
  exception
    when others then
      get stacked diagnostics v_guard_message = message_text;
      if v_guard_message <> '老师工资聚合 Cash 流水不可编辑或删除。' then
        raise;
      end if;
  end;

  raise notice 'Retained staging wage batch verified: marker %, Cash batch %, School batch %, transaction %',
    v_marker, v_batch.id, v_batch.school_payment_batch_id, v_batch.created_transaction_id;
end
$$;

rollback;
