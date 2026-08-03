-- KYC artist-centric fields (2026-07-20) — run once in Supabase SQL editor.
alter table public.kyc_submissions add column if not exists artist_name text;
alter table public.kyc_submissions add column if not exists social_links jsonb not null default '[]'::jsonb;
alter table public.kyc_submissions add column if not exists music_links jsonb not null default '[]'::jsonb;
alter table public.kyc_submissions add column if not exists years_active text;


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

insert into public.schema_migrations (filename) values ('kyc-artist-fields-2026-07-20.sql')
  on conflict (filename) do update set applied_at = now();
