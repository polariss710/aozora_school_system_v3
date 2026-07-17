\set ON_ERROR_STOP on

begin;

alter table public.home_jpy_transactions
  drop constraint if exists home_jpy_transactions_external_required_check,
  add constraint home_jpy_transactions_external_required_check check (
    created_by_external is not true
    or (
      external_source = 'aozora_school'
      and external_source_id is not null
      and external_idempotency_key is not null
      and external_reference_id is not null
      and currency = 'JPY'
      and amount > 0
      and transfer_account_id is null
      and linked_fixed_month_item_id is null
      and linked_cny_transaction_id is null
      and (
        (external_reference_type = 'school_income_records'
          and external_event_type in ('tuition_income_received', 'income_received')
          and transaction_type = 'income')
        or (external_reference_type = 'school_expense_records'
          and external_event_type = 'expense_paid'
          and transaction_type = 'expense')
        or (external_reference_type = 'school_expense_batches'
          and external_event_type = 'teacher_wage_batch_paid'
          and transaction_type = 'expense')
      )
    )
  );

alter table public.home_cny_transactions
  drop constraint if exists home_cny_transactions_external_required_check,
  add constraint home_cny_transactions_external_required_check check (
    created_by_external is not true
    or (
      external_source = 'aozora_school'
      and external_source_id is not null
      and external_idempotency_key is not null
      and external_reference_id is not null
      and currency = 'CNY'
      and amount > 0
      and transfer_account_id is null
      and linked_fixed_month_item_id is null
      and linked_jpy_transaction_id is null
      and (
        (external_reference_type = 'school_income_records'
          and external_event_type in ('tuition_income_received', 'income_received')
          and transaction_type = 'income')
        or (external_reference_type = 'school_expense_records'
          and external_event_type = 'expense_paid'
          and transaction_type = 'expense')
        or (external_reference_type = 'school_expense_batches'
          and external_event_type = 'teacher_wage_batch_paid'
          and transaction_type = 'expense')
      )
    )
  );

create table if not exists public.home_external_transaction_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_type text not null check (batch_type = 'teacher_wage_payment'),
  batch_key text not null unique,
  currency text not null check (currency in ('JPY', 'CNY')),
  account_id uuid not null references public.home_accounts(id) on delete restrict,
  transacted_at date not null,
  total_amount numeric(14,2) not null check (total_amount > 0),
  status text not null check (status = 'approved'),
  created_transaction_id uuid not null unique,
  teacher_id uuid not null,
  teacher_name text not null check (btrim(teacher_name) <> ''),
  year_month text not null check (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  request_count integer not null check (request_count >= 2),
  school_payment_batch_id uuid unique,
  school_synced_at timestamptz,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint home_external_transaction_batches_school_sync_check check (
    (school_payment_batch_id is null and school_synced_at is null)
    or (school_payment_batch_id is not null and school_synced_at is not null)
  )
);

create table if not exists public.home_external_transaction_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null
    references public.home_external_transaction_batches(id) on delete restrict,
  request_id uuid not null unique
    references public.home_external_transaction_requests(id) on delete restrict,
  external_reference_id uuid not null unique,
  amount numeric(14,2) not null check (amount > 0),
  item_order integer not null check (item_order > 0),
  created_at timestamptz not null default now(),
  unique (batch_id, item_order)
);

create index if not exists home_external_transaction_batches_user_approved_at_idx
  on public.home_external_transaction_batches(user_id, approved_at desc);
create index if not exists home_external_transaction_batch_items_batch_id_idx
  on public.home_external_transaction_batch_items(batch_id);

alter table public.home_external_transaction_batches enable row level security;
alter table public.home_external_transaction_batch_items enable row level security;

drop policy if exists home_external_transaction_batches_user_select
  on public.home_external_transaction_batches;
create policy home_external_transaction_batches_user_select
  on public.home_external_transaction_batches
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists home_external_transaction_batch_items_user_select
  on public.home_external_transaction_batch_items;
create policy home_external_transaction_batch_items_user_select
  on public.home_external_transaction_batch_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.home_external_transaction_batches b
      where b.id = batch_id
        and b.user_id = auth.uid()
    )
  );

create or replace function public.home_approve_teacher_wage_request_batch(
  p_request_ids uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_ids uuid[];
  v_request_count integer;
  v_batch_key text;
  v_existing public.home_external_transaction_batches%rowtype;
  v_account public.home_accounts%rowtype;
  v_currency text;
  v_account_id uuid;
  v_transacted_at date;
  v_total_amount numeric(14,2);
  v_teacher_id uuid;
  v_teacher_name text;
  v_year_month text;
  v_batch_id uuid := gen_random_uuid();
  v_transaction_id uuid := gen_random_uuid();
  v_description text;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Cash 登录用户不存在。');
  end if;

  select array_agg(id order by id)
  into v_request_ids
  from (select distinct unnest(p_request_ids) as id) ids;
  v_request_count := coalesce(array_length(v_request_ids, 1), 0);
  if v_request_count < 2 then
    return jsonb_build_object('ok', false, 'message', '老师工资聚合确认至少需要两条请求。');
  end if;

  v_batch_key := 'aozora-v3:teacher-wage-batch:' || md5(array_to_string(v_request_ids, ','));
  select * into v_existing
  from public.home_external_transaction_batches
  where batch_key = v_batch_key;
  if found then
    if v_existing.user_id <> v_user_id then
      return jsonb_build_object('ok', false, 'message', '聚合批次属于其他 Cash 用户。');
    end if;
    return jsonb_build_object(
      'ok', true,
      'inserted', false,
      'batch_id', v_existing.id,
      'created_transaction_id', v_existing.created_transaction_id,
      'total_amount', v_existing.total_amount,
      'currency', v_existing.currency,
      'message', '老师工资聚合批次已存在。'
    );
  end if;

  perform 1
  from public.home_external_transaction_requests r
  where r.id = any(v_request_ids)
  order by r.id
  for update;

  select
    count(*),
    min(currency),
    min(account_id::text)::uuid,
    min(transacted_at),
    sum(amount),
    min(payload_snapshot ->> 'teacher_id')::uuid,
    min(payload_snapshot ->> 'teacher_name'),
    min(payload_snapshot ->> 'year_month')
  into
    v_request_count,
    v_currency,
    v_account_id,
    v_transacted_at,
    v_total_amount,
    v_teacher_id,
    v_teacher_name,
    v_year_month
  from public.home_external_transaction_requests
  where id = any(v_request_ids)
    and user_id = v_user_id
    and status = 'pending'
    and external_source = 'aozora_school'
    and external_reference_type = 'school_expense_records'
    and request_type = 'expense_paid'
    and transaction_type = 'expense'
    and payload_snapshot ->> 'expense_category' = 'teacher_wage'
    and payload_snapshot ->> 'teacher_id' ~ '^[0-9a-fA-F-]{36}$'
    and btrim(coalesce(payload_snapshot ->> 'teacher_name', '')) <> ''
    and payload_snapshot ->> 'year_month' ~ '^[0-9]{4}-(0[1-9]|1[0-2])$';

  if v_request_count <> array_length(v_request_ids, 1) then
    return jsonb_build_object('ok', false, 'message', '请求组包含非待确认或非老师工资项目。');
  end if;

  if (
    select count(distinct (currency, account_id, transacted_at,
      payload_snapshot ->> 'teacher_id', payload_snapshot ->> 'year_month'))
    from public.home_external_transaction_requests
    where id = any(v_request_ids)
  ) <> 1 then
    return jsonb_build_object('ok', false, 'message', '老师、月份、币种、账户或付款日期不一致，不能聚合。');
  end if;

  select * into v_account
  from public.home_accounts
  where id = v_account_id
    and user_id = v_user_id
    and currency = v_currency
    and is_active
    and allow_school_requests;
  if not found then
    return jsonb_build_object('ok', false, 'message', '聚合付款账户不可用于 School 请求。');
  end if;

  v_description := v_teacher_name || ' ' || v_year_month || ' 老师工资合计';
  if v_currency = 'JPY' then
    insert into public.home_jpy_transactions (
      id, user_id, currency, transaction_type, account_id, transacted_at, amount,
      description, note, external_source, external_source_id, external_event_type,
      external_idempotency_key, external_reference_type, external_reference_id,
      external_note, external_payload_hash, external_created_at, created_by_external
    ) values (
      v_transaction_id, v_user_id, 'JPY', 'expense', v_account_id, v_transacted_at,
      v_total_amount, v_description, 'School 老师工资聚合付款', 'aozora_school',
      v_batch_id, 'teacher_wage_batch_paid', v_batch_key,
      'school_expense_batches', v_batch_id, 'School teacher wage batch',
      md5(array_to_string(v_request_ids, ',')), now(), true
    );
  elsif v_currency = 'CNY' then
    insert into public.home_cny_transactions (
      id, user_id, currency, transaction_type, account_id, transacted_at, amount,
      description, note, external_source, external_source_id, external_event_type,
      external_idempotency_key, external_reference_type, external_reference_id,
      external_note, external_payload_hash, external_created_at, created_by_external
    ) values (
      v_transaction_id, v_user_id, 'CNY', 'expense', v_account_id, v_transacted_at,
      v_total_amount, v_description, 'School 老师工资聚合付款', 'aozora_school',
      v_batch_id, 'teacher_wage_batch_paid', v_batch_key,
      'school_expense_batches', v_batch_id, 'School teacher wage batch',
      md5(array_to_string(v_request_ids, ',')), now(), true
    );
  else
    return jsonb_build_object('ok', false, 'message', '聚合付款币种不受支持。');
  end if;

  insert into public.home_external_transaction_batches (
    id, user_id, batch_type, batch_key, currency, account_id, transacted_at,
    total_amount, status, created_transaction_id, teacher_id, teacher_name,
    year_month, request_count, approved_at
  ) values (
    v_batch_id, v_user_id, 'teacher_wage_payment', v_batch_key, v_currency,
    v_account_id, v_transacted_at, v_total_amount, 'approved', v_transaction_id,
    v_teacher_id, v_teacher_name, v_year_month, v_request_count, now()
  );

  insert into public.home_external_transaction_batch_items (
    batch_id, request_id, external_reference_id, amount, item_order
  )
  select
    v_batch_id,
    r.id,
    r.external_reference_id,
    r.amount,
    row_number() over (order by r.id)
  from public.home_external_transaction_requests r
  where r.id = any(v_request_ids)
  order by r.id;

  update public.home_external_transaction_requests
  set
    status = 'approved',
    approved_at = now(),
    created_transaction_id = v_transaction_id,
    updated_at = now()
  where id = any(v_request_ids);

  return jsonb_build_object(
    'ok', true,
    'inserted', true,
    'batch_id', v_batch_id,
    'created_transaction_id', v_transaction_id,
    'total_amount', v_total_amount,
    'currency', v_currency,
    'request_count', v_request_count,
    'message', '老师工资已生成一笔聚合 Cash 流水。'
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'message', '请求或聚合身份已被其他批次使用。');
end;
$$;

create or replace function public.home_mark_teacher_wage_batch_school_synced(
  p_batch_id uuid,
  p_school_payment_batch_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_batch public.home_external_transaction_batches%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Cash 登录用户不存在。');
  end if;
  if p_batch_id is null or p_school_payment_batch_id is null then
    return jsonb_build_object('ok', false, 'message', 'School 聚合回写身份不完整。');
  end if;

  select * into v_batch
  from public.home_external_transaction_batches
  where id = p_batch_id
    and user_id = v_user_id
    and status = 'approved';
  if not found then
    return jsonb_build_object('ok', false, 'message', '没有找到已确认的老师工资聚合批次。');
  end if;

  if v_batch.school_payment_batch_id is not null then
    if v_batch.school_payment_batch_id = p_school_payment_batch_id then
      return jsonb_build_object('ok', true, 'inserted', false, 'batch_id', v_batch.id,
        'message', '老师工资聚合批次已存在相同 School 同步标记。');
    end if;
    return jsonb_build_object('ok', false, 'message', '老师工资聚合批次已绑定其他 School 身份。');
  end if;

  update public.home_external_transaction_batches
  set school_payment_batch_id = p_school_payment_batch_id,
      school_synced_at = now()
  where id = v_batch.id;

  return jsonb_build_object('ok', true, 'inserted', true, 'batch_id', v_batch.id,
    'message', '老师工资聚合批次已标记为 School 同步。');
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'message', 'School 聚合身份已被其他 Cash 批次使用。');
end;
$$;

create or replace function public.home_guard_teacher_wage_batch_transaction_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.home_external_transaction_batches b
    where b.created_transaction_id = old.id
  ) then
    raise exception '老师工资聚合 Cash 流水不可编辑或删除。';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists home_jpy_transactions_teacher_wage_batch_guard
  on public.home_jpy_transactions;
create trigger home_jpy_transactions_teacher_wage_batch_guard
before update or delete on public.home_jpy_transactions
for each row execute function public.home_guard_teacher_wage_batch_transaction_mutation();

drop trigger if exists home_cny_transactions_teacher_wage_batch_guard
  on public.home_cny_transactions;
create trigger home_cny_transactions_teacher_wage_batch_guard
before update or delete on public.home_cny_transactions
for each row execute function public.home_guard_teacher_wage_batch_transaction_mutation();

revoke all on table public.home_external_transaction_batches
  from public, anon, authenticated;
revoke all on table public.home_external_transaction_batch_items
  from public, anon, authenticated;
grant select on table public.home_external_transaction_batches to authenticated;
grant select on table public.home_external_transaction_batch_items to authenticated;
grant all on table public.home_external_transaction_batches to service_role;
grant all on table public.home_external_transaction_batch_items to service_role;

revoke all on function public.home_approve_teacher_wage_request_batch(uuid[])
  from public, anon;
grant execute on function public.home_approve_teacher_wage_request_batch(uuid[])
  to authenticated, service_role;
revoke all on function public.home_mark_teacher_wage_batch_school_synced(uuid, uuid)
  from public, anon;
grant execute on function public.home_mark_teacher_wage_batch_school_synced(uuid, uuid)
  to authenticated, service_role;
revoke all on function public.home_guard_teacher_wage_batch_transaction_mutation()
  from public, anon, authenticated;
grant execute on function public.home_guard_teacher_wage_batch_transaction_mutation()
  to service_role;

commit;
