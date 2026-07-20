-- KYC artist-centric fields (2026-07-20) — run once in Supabase SQL editor.
alter table public.kyc_submissions add column if not exists artist_name text;
alter table public.kyc_submissions add column if not exists social_links jsonb not null default '[]'::jsonb;
alter table public.kyc_submissions add column if not exists music_links jsonb not null default '[]'::jsonb;
alter table public.kyc_submissions add column if not exists years_active text;
