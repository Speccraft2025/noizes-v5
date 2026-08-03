-- Backfill the migration ledger for scripts applied before it existed.
--
-- Run this ONCE, then never again — from then on each script records itself
-- via the footer it now carries.
--
-- Every insert is conditional on the object that script actually creates, so
-- this records evidence rather than assumption. A script whose objects are
-- absent is deliberately NOT recorded: the ledger should say "not applied"
-- and the drift check should fail, which is the entire point.
--
-- Context: the multi-track migration sat unapplied for three days while the
-- Exchange showed an empty catalogue, because nothing anywhere could answer
-- "has this been run?".

begin;

create table if not exists public.schema_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now()
);
-- No policies: RLS on with none defined means only the service role reads it.
alter table public.schema_migrations enable row level security;

-- Base schema — the releases table is its foundation.
insert into public.schema_migrations (filename)
select 'supabase_schema.sql'
where to_regclass('public.releases') is not null
on conflict (filename) do nothing;

-- Provenance and resale — brought payment_intents and provenance_events.
insert into public.schema_migrations (filename)
select 'provenance-resale-2026-07-26.sql'
where to_regclass('public.provenance_events') is not null
  and to_regclass('public.payment_intents') is not null
on conflict (filename) do nothing;

-- KYC artist fields — added artist_name to kyc_submissions.
insert into public.schema_migrations (filename)
select 'kyc-artist-fields-2026-07-20.sql'
where exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'kyc_submissions' and column_name = 'artist_name'
)
on conflict (filename) do nothing;

-- Security hardening — installed the privileged-column guard.
insert into public.schema_migrations (filename)
select 'security-hardening-2026-07-19.sql'
where to_regprocedure('public.protect_privileged_profile_columns()') is not null
on conflict (filename) do nothing;

-- Launch hardening — installed the offer-column guard.
insert into public.schema_migrations (filename)
select 'launch-hardening-2026-07-31.sql'
where to_regprocedure('public.protect_offer_columns()') is not null
on conflict (filename) do nothing;

-- Multi-track phase 1 — created the normalized track tables.
insert into public.schema_migrations (filename)
select 'multi-track-phase-1-2026-07-31.sql'
where to_regclass('public.tracks') is not null
  and to_regclass('public.audio_versions') is not null
  and to_regclass('public.audio_assets') is not null
on conflict (filename) do nothing;

commit;

-- What the ledger now believes:
--   select filename, applied_at from public.schema_migrations order by filename;
notify pgrst, 'reload schema';


-- ── Migration ledger ─────────────────────────────────────────────────────
-- Records that this script ran. Without this, "has the migration been
-- applied?" was answerable only by querying for a column and seeing whether
-- it errored — which is how a missing multi-track migration went unnoticed
-- for three days while the Exchange showed an empty catalogue.
--
-- The table is created here rather than in a separate bootstrap script so
-- that any script establishes the ledger whatever order they are pasted in.
create table if not exists public.schema_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now()
);
-- No policies: RLS on with none defined means only the service role reads it.
alter table public.schema_migrations enable row level security;

insert into public.schema_migrations (filename) values ('000-backfill-migration-ledger.sql')
  on conflict (filename) do update set applied_at = now();
