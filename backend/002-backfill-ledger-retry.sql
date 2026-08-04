-- Backfill the ledger, and say out loud what it found.
--
-- The first attempt recorded nothing. Either it never ran, or its
-- `to_regclass` conditions all evaluated false — and guessing between those
-- is exactly the kind of blind diagnosis the ledger exists to end.
--
-- This version uses information_schema, which does not depend on search_path,
-- and returns a row showing what it detected so the result is self-evident.
-- Idempotent and safe to re-run.

begin;

create table if not exists public.schema_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
grant select, insert, update on public.schema_migrations to service_role;

with detected as (
  select
    exists (select 1 from information_schema.tables
            where table_schema='public' and table_name='releases')            as base_schema,
    exists (select 1 from information_schema.tables
            where table_schema='public' and table_name='provenance_events')   as provenance,
    exists (select 1 from information_schema.columns
            where table_schema='public' and table_name='kyc_submissions'
              and column_name='artist_name')                                  as kyc_fields,
    exists (select 1 from information_schema.routines
            where routine_schema='public'
              and routine_name='protect_privileged_profile_columns')          as security_hardening,
    exists (select 1 from information_schema.routines
            where routine_schema='public'
              and routine_name='protect_offer_columns')                       as launch_hardening,
    exists (select 1 from information_schema.tables
            where table_schema='public' and table_name='tracks')              as multi_track
),
rows_to_add as (
  select 'supabase_schema.sql'                as filename from detected where base_schema
  union all
  select 'provenance-resale-2026-07-26.sql'          from detected where provenance
  union all
  select 'kyc-artist-fields-2026-07-20.sql'          from detected where kyc_fields
  union all
  select 'security-hardening-2026-07-19.sql'         from detected where security_hardening
  union all
  select 'launch-hardening-2026-07-31.sql'           from detected where launch_hardening
  union all
  select 'multi-track-phase-1-2026-07-31.sql'        from detected where multi_track
  union all
  select '002-backfill-ledger-retry.sql'
)
insert into public.schema_migrations (filename)
select filename from rows_to_add
on conflict (filename) do nothing;

commit;

notify pgrst, 'reload schema';

-- What was detected, and what the ledger now holds:
select * from (
  select
    exists (select 1 from information_schema.tables where table_schema='public' and table_name='releases')          as base_schema,
    exists (select 1 from information_schema.tables where table_schema='public' and table_name='provenance_events') as provenance,
    exists (select 1 from information_schema.routines where routine_schema='public' and routine_name='protect_offer_columns') as launch_hardening,
    exists (select 1 from information_schema.tables where table_schema='public' and table_name='tracks')            as multi_track,
    (select count(*) from public.schema_migrations)                                                                 as ledger_rows
) d;
