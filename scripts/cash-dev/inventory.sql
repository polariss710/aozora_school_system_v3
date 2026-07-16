\pset pager off
\pset tuples_only on
\pset format unaligned

select 'tables=' || count(*)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname like 'home\_%' escape '\';

select 'views=' || count(*)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('v', 'm')
  and c.relname like 'home\_%' escape '\';

select 'functions=' || count(*)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'home\_%' escape '\';

select 'policies=' || count(*)
from pg_policies
where schemaname = 'public'
  and tablename like 'home\_%' escape '\';

select 'triggers=' || count(*)
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table like 'home\_%' escape '\';

select 'non_home_tables=' || coalesce(string_agg(c.relname, ',' order by c.relname), '')
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname not like 'home\_%' escape '\'
  and c.relname not like '\_%' escape '\';
