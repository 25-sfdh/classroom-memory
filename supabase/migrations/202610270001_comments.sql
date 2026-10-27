-- Apply only after reviewing supabase/comments-preflight.sql on the target project.
-- Existing incompatible schemas or unmanaged policies abort the whole transaction.
begin;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id text not null,
  name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

do $$
declare
  expected record;
  actual_type text;
begin
  for expected in select * from (values
    ('id', 'uuid'), ('target_type', 'text'), ('target_id', 'text'),
    ('name', 'text'), ('content', 'text'), ('created_at', 'timestamp with time zone')
  ) as columns(name, type)
  loop
    select format_type(a.atttypid, a.atttypmod) into actual_type
      from pg_attribute a where a.attrelid = 'public.comments'::regclass
      and a.attname = expected.name and a.attnum > 0 and not a.attisdropped;
    if actual_type is distinct from expected.type then
      raise exception 'comments.% has type %, expected %. Review the existing schema; no data was converted.',
        expected.name, actual_type, expected.type;
    end if;
  end loop;
  if (select count(*) from pg_attribute where attrelid = 'public.comments'::regclass
      and attnum > 0 and not attisdropped) <> 6 then
    raise exception 'Existing comments table has additional columns; review before applying this migration.';
  end if;
  if not exists (
    select 1 from pg_constraint c join pg_attribute a
      on a.attrelid = c.conrelid and a.attname = 'id'
    where c.conrelid = 'public.comments'::regclass and c.contype = 'p'
      and c.conkey = array[a.attnum]
  ) then
    raise exception 'comments.id must be the primary key; review the existing schema.';
  end if;
  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'comments'
      and policyname not in ('comments_read', 'comments_create', 'comments_admin_delete')
  ) then
    raise exception 'Unmanaged comments policies exist. Review them first; permissive policies combine with OR.';
  end if;
end $$;

alter table public.comments
  alter column id set default gen_random_uuid(),
  alter column target_type set not null,
  alter column target_id set not null,
  alter column name set not null,
  alter column content set not null,
  alter column created_at set not null,
  alter column created_at set default now();

-- Bad legacy rows cause rollback instead of being silently edited or deleted.
alter table public.comments drop constraint if exists comments_target_valid;
alter table public.comments add constraint comments_target_valid
  check (target_type in ('photo', 'memory') and char_length(btrim(target_id)) between 1 and 128);
alter table public.comments drop constraint if exists comments_name_valid;
alter table public.comments add constraint comments_name_valid
  check (char_length(btrim(name)) between 1 and 80);
alter table public.comments drop constraint if exists comments_content_valid;
alter table public.comments add constraint comments_content_valid
  check (char_length(btrim(content)) between 1 and 2000);

create index if not exists comments_target_created_idx
  on public.comments (target_type, target_id, created_at, id);

alter table public.comments enable row level security;
revoke all on public.comments from public, anon, authenticated;
revoke all (id, target_type, target_id, name, content, created_at)
  on public.comments from public, anon, authenticated;
grant select on public.comments to anon, authenticated;
grant insert (target_type, target_id, name, content) on public.comments to anon, authenticated;
grant delete on public.comments to authenticated;

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to anon, authenticated using (true);
drop policy if exists comments_create on public.comments;
create policy comments_create on public.comments for insert to anon, authenticated with check (true);
drop policy if exists comments_admin_delete on public.comments;
create policy comments_admin_delete on public.comments for delete to authenticated
  using ((select auth.uid()) is not null
    and (select auth.jwt()) -> 'app_metadata' -> 'comments_admin' = 'true'::jsonb);

notify pgrst, 'reload schema';
commit;
