\set ON_ERROR_STOP on
\pset pager off

\if :{?cash_user_id}
\else
  \echo 'ERROR: pass the Cash dev Supabase Auth user UUID with -v cash_user_id=<uuid>'
  \quit 3
\endif

select count(*) = 1 as cash_dev_auth_user_exists
from auth.users
where id = :'cash_user_id'::uuid;

select count(*) = 4 as has_expected_dev_accounts
from public.home_accounts
where user_id = :'cash_user_id'::uuid
  and id in (
    'ca500000-0000-4000-8000-000000000001'::uuid,
    'ca500000-0000-4000-8000-000000000002'::uuid,
    'ca500000-0000-4000-8000-000000000003'::uuid,
    'ca500000-0000-4000-8000-000000000004'::uuid
  )
  and name like 'DEV Cash %';

select count(*) = 3 as has_expected_school_eligible_accounts
from public.home_accounts
where user_id = :'cash_user_id'::uuid
  and is_active
  and allow_school_requests;
