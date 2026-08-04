-- Make the migration ledger visible to the API.
--
-- The ledger was created without grants. PostgREST does not expose a table
-- whose roles hold no privileges on it, so `schema_migrations` existed but
-- every read returned PGRST205 "not found in the schema cache" — a ledger
-- nobody could check, which defeats the point of having one.
--
-- Safe to run whether or not the backfill completed: everything here is
-- idempotent, and the table is created if it is somehow absent.

begin;

create table if not exists public.schema_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now()
);

alter table public.schema_migrations enable row level security;

-- Operational metadata. Collectors and creators have no business reading
-- deployment history, so only the service role sees it.
revoke all on public.schema_migrations from anon, authenticated;
grant select, insert, update on public.schema_migrations to service_role;

insert into public.schema_migrations (filename) values ('001-fix-ledger-grants.sql')
  on conflict (filename) do update set applied_at = now();

commit;

notify pgrst, 'reload schema';

-- Then:  select filename, applied_at from public.schema_migrations order by filename;
