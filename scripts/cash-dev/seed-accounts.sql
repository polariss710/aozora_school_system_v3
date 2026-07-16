\set ON_ERROR_STOP on

\if :{?cash_user_id}
\else
  \echo 'ERROR: pass the Cash dev Supabase Auth user UUID with -v cash_user_id=<uuid>'
  \quit 3
\endif

begin;

select set_config('cash_dev.user_id', :'cash_user_id', true);

do $$
declare
  v_user_id uuid := current_setting('cash_dev.user_id')::uuid;
begin
  if not exists (select 1 from auth.users where id = v_user_id) then
    raise exception 'Cash dev Auth user % does not exist in auth.users', v_user_id;
  end if;

  if exists (
    select 1
    from public.home_accounts
    where id in (
      'ca500000-0000-4000-8000-000000000001'::uuid,
      'ca500000-0000-4000-8000-000000000002'::uuid,
      'ca500000-0000-4000-8000-000000000003'::uuid,
      'ca500000-0000-4000-8000-000000000004'::uuid
    )
      and user_id <> v_user_id
  ) then
    raise exception 'A deterministic Cash dev account UUID already belongs to another user';
  end if;
end
$$;

insert into public.home_accounts (
  id,
  user_id,
  currency,
  name,
  account_type,
  opening_balance,
  is_active,
  sort_order,
  allow_school_requests
)
values
  (
    'ca500000-0000-4000-8000-000000000001',
    current_setting('cash_dev.user_id')::uuid,
    'JPY',
    'DEV Cash 日元现金',
    'cash',
    100000,
    true,
    10,
    true
  ),
  (
    'ca500000-0000-4000-8000-000000000002',
    current_setting('cash_dev.user_id')::uuid,
    'JPY',
    'DEV Cash 日元银行',
    'bank',
    200000,
    true,
    20,
    true
  ),
  (
    'ca500000-0000-4000-8000-000000000003',
    current_setting('cash_dev.user_id')::uuid,
    'CNY',
    'DEV Cash 人民币钱包',
    'wallet',
    10000,
    true,
    30,
    true
  ),
  (
    'ca500000-0000-4000-8000-000000000004',
    current_setting('cash_dev.user_id')::uuid,
    'JPY',
    'DEV Cash 禁止 School 请求',
    'wallet',
    0,
    true,
    40,
    false
  )
on conflict (id) do update
set
  currency = excluded.currency,
  name = excluded.name,
  account_type = excluded.account_type,
  opening_balance = excluded.opening_balance,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  allow_school_requests = excluded.allow_school_requests
where public.home_accounts.user_id = excluded.user_id;

commit;
