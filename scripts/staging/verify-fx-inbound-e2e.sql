begin;

do $$
declare
  v_income public.income_records%rowtype;
  v_school_request public.cash_requests%rowtype;
  v_external_request public.home_external_transaction_requests%rowtype;
  v_fx_cny public.home_cny_transactions%rowtype;
  v_fx_jpy public.home_jpy_transactions%rowtype;
  v_sync public.home_school_fx_syncs%rowtype;
  v_event public.cash_inbound_events%rowtype;
  v_account_transaction public.account_transactions%rowtype;
  v_guard_message text;
begin
  select * into v_income
  from public.income_records
  where memo like 'STAGING-E2E-FX-%'
  order by created_at desc
  limit 1;
  if v_income.id is null then raise exception 'No retained staging FX income was found.'; end if;

  select * into strict v_school_request
  from public.cash_requests
  where income_record_id = v_income.id;
  select * into strict v_external_request
  from public.home_external_transaction_requests
  where id::text = v_school_request.external_cash_request_id;
  select * into strict v_fx_cny
  from public.home_cny_transactions
  where transaction_type = 'fx_out' and note = v_income.memo;
  select * into strict v_fx_jpy
  from public.home_jpy_transactions
  where id = v_fx_cny.linked_jpy_transaction_id;
  select * into strict v_sync
  from public.home_school_fx_syncs
  where cny_transaction_id = v_fx_cny.id;
  select * into strict v_event
  from public.cash_inbound_events
  where id = v_sync.school_inbound_event_id;
  select * into strict v_account_transaction
  from public.account_transactions
  where id = v_sync.school_account_transaction_id;

  if v_income.original_currency <> 'CNY'
    or v_income.original_amount_cny <> 88
    or v_income.record_status <> 'cash_confirmed'
    or v_income.cash_status <> 'account_transaction_created'
    or v_school_request.status <> 'cash_confirmed'
    or v_school_request.requested_currency <> 'CNY'
    or v_school_request.requested_amount_cny <> 88
    or v_external_request.status <> 'approved'
    or v_external_request.created_transaction_id::text <> v_school_request.external_cash_transaction_id then
    raise exception 'FX source income reconciliation failed.';
  end if;

  if v_fx_cny.currency <> 'CNY' or v_fx_cny.transaction_type <> 'fx_out'
    or v_fx_cny.amount <> 88 or v_fx_cny.transacted_at <> date '2099-06-01'
    or v_fx_jpy.currency <> 'JPY' or v_fx_jpy.transaction_type <> 'fx_in'
    or v_fx_jpy.amount <> 1800 or v_fx_jpy.transacted_at <> v_fx_cny.transacted_at
    or v_fx_jpy.linked_cny_transaction_id <> v_fx_cny.id then
    raise exception 'Cash FX pair reconciliation failed.';
  end if;

  if v_event.external_cash_event_id <> v_fx_cny.id::text
    or v_event.source_currency <> 'CNY' or v_event.source_amount_cny <> 88
    or v_event.target_currency <> 'JPY' or v_event.target_amount_jpy <> 1800
    or v_event.status <> 'account_transaction_created'
    or v_event.linked_income_record_ids <> array[v_income.id::text]
    or v_event.account_transaction_id <> v_account_transaction.id
    or v_account_transaction.direction <> 'in'
    or v_account_transaction.currency <> 'JPY'
    or v_account_transaction.amount_jpy <> 1800
    or v_account_transaction.status <> 'active'
    or v_account_transaction.external_event_id <> v_fx_cny.id::text then
    raise exception 'School FX inbound event reconciliation failed.';
  end if;

  if (select count(*) from public.account_transactions where external_event_id = v_fx_cny.id::text) <> 1
    or (select count(*) from public.cash_inbound_events where external_cash_event_id = v_fx_cny.id::text) <> 1
    or (select count(*) from public.audit_events where action = 'cash_inbound_event.create' and target_id = v_event.id::text) <> 1 then
    raise exception 'FX inbound idempotency or audit count failed.';
  end if;

  begin
    update public.home_cny_transactions set note = note where id = v_fx_cny.id;
    raise exception 'CNY FX mutation guard did not reject update.';
  exception when others then
    get stacked diagnostics v_guard_message = message_text;
    if v_guard_message <> '已回写 School 的人民币购汇流水不可编辑或删除。' then raise; end if;
  end;
  begin
    delete from public.home_cny_transactions where id = v_fx_cny.id;
    raise exception 'CNY FX mutation guard did not reject delete.';
  exception when others then
    get stacked diagnostics v_guard_message = message_text;
    if v_guard_message <> '已回写 School 的人民币购汇流水不可编辑或删除。' then raise; end if;
  end;
  begin
    update public.home_jpy_transactions set note = note where id = v_fx_jpy.id;
    raise exception 'JPY FX mutation guard did not reject update.';
  exception when others then
    get stacked diagnostics v_guard_message = message_text;
    if v_guard_message <> '已回写 School 的日元入金流水不可编辑或删除。' then raise; end if;
  end;
  begin
    delete from public.home_jpy_transactions where id = v_fx_jpy.id;
    raise exception 'JPY FX mutation guard did not reject delete.';
  exception when others then
    get stacked diagnostics v_guard_message = message_text;
    if v_guard_message <> '已回写 School 的日元入金流水不可编辑或删除。' then raise; end if;
  end;

  raise notice 'Retained staging FX verified: marker %, CNY FX %, JPY FX %, School event %, account transaction %',
    v_income.memo, v_fx_cny.id, v_fx_jpy.id, v_event.id, v_account_transaction.id;
end
$$;

rollback;
