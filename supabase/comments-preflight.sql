-- Read only. Run in the target project's SQL editor before applying the migration.
select table_schema, table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in ('comments', 'photos', 'memories')
order by table_name, ordinal_position;

select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'comments';

select policyname, roles, cmd, permissive, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'comments';

select grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and table_name = 'comments';

select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'comments';
