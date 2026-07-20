-- Run this in: Supabase Dashboard → SQL Editor
-- Fully idempotent: safe to re-run on an existing database

-- ══════════════════════════════════════════════
-- PROFILES
-- ══════════════════════════════════════════════

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  display_name text,
  avatar_url text,
  role text not null default 'collector' check (role in ('creator', 'collector')),
  is_admin boolean default false,
  bio text,
  location text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='Profiles are publicly readable') then
    create policy "Profiles are publicly readable" on public.profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='Users can update own profile') then
    create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='Users can insert own profile') then
    create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'collector')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ══════════════════════════════════════════════
-- KYC + AUTHENTICITY (profiles extensions)
-- ══════════════════════════════════════════════

alter table public.profiles add column if not exists kyc_status text not null default 'unverified' check (kyc_status in ('unverified', 'pending', 'approved', 'rejected'));
alter table public.profiles add column if not exists kyc_full_name text;
alter table public.profiles add column if not exists kyc_country text;
alter table public.profiles add column if not exists kyc_id_type text;
alter table public.profiles add column if not exists kyc_id_number text;
alter table public.profiles add column if not exists kyc_id_document_path text;
alter table public.profiles add column if not exists kyc_selfie_path text;
alter table public.profiles add column if not exists kyc_submitted_at timestamptz;
alter table public.profiles add column if not exists kyc_reviewed_at timestamptz;
alter table public.profiles add column if not exists kyc_reviewer_id uuid references public.profiles(id);
alter table public.profiles add column if not exists kyc_reject_reason text;
alter table public.profiles add column if not exists signing_public_key text;

create table if not exists public.kyc_submissions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  full_name text not null,
  country text not null,
  id_type text not null,
  id_number text not null,
  id_document_path text,
  selfie_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references public.profiles(id),
  reject_reason text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz
);

alter table public.kyc_submissions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='kyc_submissions' and policyname='Users can read own kyc submissions') then
    create policy "Users can read own kyc submissions" on public.kyc_submissions for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='kyc_submissions' and policyname='Users can insert own kyc submissions') then
    create policy "Users can insert own kyc submissions" on public.kyc_submissions for insert with check (
      user_id = auth.uid()
      and status = 'pending'
      and reviewer_id is null
      and reviewed_at is null
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='kyc_submissions' and policyname='Admins can read all kyc submissions') then
    create policy "Admins can read all kyc submissions" on public.kyc_submissions for select using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
  end if;
  if not exists (select 1 from pg_policies where tablename='kyc_submissions' and policyname='Admins can update kyc submissions') then
    create policy "Admins can update kyc submissions" on public.kyc_submissions for update using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
  end if;
end $$;

-- Artist-centric KYC fields (2026-07-20): verification on a music platform is
-- about the artist identity as much as the legal one. Links are jsonb arrays
-- of https URLs, validated server-side in $lib/server/kyc.js.
alter table public.kyc_submissions add column if not exists artist_name text;
alter table public.kyc_submissions add column if not exists social_links jsonb not null default '[]'::jsonb;
alter table public.kyc_submissions add column if not exists music_links jsonb not null default '[]'::jsonb;
alter table public.kyc_submissions add column if not exists years_active text;

-- Custodial Ed25519 signing keys — service-role only, intentionally has no
-- client-facing RLS policies so it is unreachable except via the service role.
create table if not exists public.creator_signing_keys (
  id uuid references public.profiles(id) on delete cascade primary key,
  public_key text not null,
  private_key_encrypted text not null,
  created_at timestamptz default now()
);

alter table public.creator_signing_keys enable row level security;

insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

-- "Users can update own profile" (above) is a row-level policy only — it does not
-- restrict which columns a user can change on their own row. Without this trigger,
-- any authenticated user could set their own kyc_status to 'approved', point
-- signing_public_key at a key they control, or grant themselves is_admin, all via a
-- plain client-side update() call, bypassing KYC review and admin gating entirely.
create or replace function public.protect_privileged_profile_columns()
returns trigger as $$
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    new.is_admin := old.is_admin;
    -- role gates /studio access and is assigned from the invite at signup —
    -- never self-escalatable from the client.
    new.role := old.role;
    new.kyc_status := old.kyc_status;
    new.kyc_reviewed_at := old.kyc_reviewed_at;
    new.kyc_reviewer_id := old.kyc_reviewer_id;
    new.kyc_reject_reason := old.kyc_reject_reason;
    new.signing_public_key := old.signing_public_key;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_privileged_profile_columns on public.profiles;
create trigger protect_privileged_profile_columns
  before update on public.profiles
  for each row execute procedure public.protect_privileged_profile_columns();

-- ══════════════════════════════════════════════
-- WAITLIST
-- ══════════════════════════════════════════════

create table if not exists public.waitlist (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  role text default 'collector' check (role in ('creator', 'collector')),
  source text default 'landing',
  created_at timestamptz default now()
);

alter table public.waitlist enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='waitlist' and policyname='Anyone can join waitlist') then
    create policy "Anyone can join waitlist" on public.waitlist for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='waitlist' and policyname='Authenticated users can read waitlist') then
    create policy "Authenticated users can read waitlist" on public.waitlist for select using (auth.role() = 'authenticated');
  end if;
end $$;

-- ══════════════════════════════════════════════
-- RELEASES
-- ══════════════════════════════════════════════

create table if not exists public.releases (
  id uuid default gen_random_uuid() primary key,
  artist_id uuid references public.profiles(id) on delete set null,
  artist_name text not null,
  title text not null,
  genre text,
  year text,
  location text,
  description text,
  edition_type text not null default 'Open Edition',
  edition_name text,
  edition_size integer,
  price numeric not null default 0,
  currency text not null default 'KES',
  cover_path text,
  audio_path text,
  nz_path text,
  acquired_count integer not null default 0,
  votes integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.releases enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='releases' and policyname='Published releases are public') then
    create policy "Published releases are public" on public.releases for select using (status = 'published' or artist_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='releases' and policyname='Creators can insert releases') then
    create policy "Creators can insert releases" on public.releases for insert with check (artist_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='releases' and policyname='Creators can update own releases') then
    create policy "Creators can update own releases" on public.releases for update using (artist_id = auth.uid());
  end if;
end $$;

drop trigger if exists releases_updated_at on public.releases;
create trigger releases_updated_at
  before update on public.releases
  for each row execute procedure public.set_updated_at();

-- ══════════════════════════════════════════════
-- ACQUISITIONS
-- ══════════════════════════════════════════════

create table if not exists public.acquisitions (
  id uuid default gen_random_uuid() primary key,
  release_id uuid references public.releases(id) on delete cascade not null,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  edition_number integer,
  price_paid numeric not null default 0,
  currency text not null default 'KES',
  previous_owner_id uuid references public.profiles(id) on delete set null,
  transferred_from_acquisition_id uuid,
  acquired_at timestamptz default now(),
  unique(release_id, edition_number)
);

alter table public.acquisitions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='acquisitions' and policyname='Users can read own acquisitions') then
    create policy "Users can read own acquisitions" on public.acquisitions for select using (owner_id = auth.uid());
  end if;
end $$;

-- Acquisitions are paid objects: every legitimate write goes through the
-- service role (Paystack fulfillment in the acquire flow). The old client
-- insert/update policies let any logged-in user mint free acquisitions or
-- rewrite price/edition/owner via the REST API — drop them.
drop policy if exists "Authenticated users can acquire" on public.acquisitions;
drop policy if exists "Owners can update own acquisitions" on public.acquisitions;

create or replace function public.handle_acquisition_insert()
returns trigger as $$
begin
  update public.releases
  set acquired_count = acquired_count + 1
  where id = new.release_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_acquisition_created on public.acquisitions;
create trigger on_acquisition_created
  after insert on public.acquisitions
  for each row execute procedure public.handle_acquisition_insert();

-- ══════════════════════════════════════════════
-- PAYMENTS (Paystack acquire flow)
-- ══════════════════════════════════════════════

-- payment_reference: the Paystack transaction reference (nz_<uuid>, generated
-- server-side at init). The partial unique index is the idempotency key —
-- webhook and callback can both attempt fulfillment; only one insert wins.
alter table public.acquisitions add column if not exists payment_reference text;

create unique index if not exists acquisitions_payment_reference_key
  on public.acquisitions (payment_reference) where payment_reference is not null;

-- Local ledger of every attempted charge. Written service-role-only.
-- Reconciliation queries: abandoned = status 'pending' older than ~1h;
-- paid-but-unfulfilled (e.g. sellout race) = 'needs_reconciliation'.
create table if not exists public.payment_intents (
  id uuid default gen_random_uuid() primary key,
  reference text not null unique,
  release_id uuid references public.releases(id) on delete set null,
  buyer_id uuid references public.profiles(id) on delete set null,
  amount_subunits integer not null,
  currency text not null,
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed', 'needs_reconciliation')),
  paystack_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.payment_intents enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='payment_intents' and policyname='Buyers can read own intents') then
    create policy "Buyers can read own intents" on public.payment_intents for select using (buyer_id = auth.uid());
  end if;
  -- no insert/update policies: writes go through the service-role client only
end $$;

drop trigger if exists payment_intents_updated_at on public.payment_intents;
create trigger payment_intents_updated_at
  before update on public.payment_intents
  for each row execute procedure public.set_updated_at();

-- ══════════════════════════════════════════════
-- STORAGE BUCKET
-- ══════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('releases', 'releases', true)
on conflict (id) do nothing;

-- ══════════════════════════════════════════════
-- ADMIN — set your account
-- ══════════════════════════════════════════════
update public.profiles set is_admin = true where email = 'jayzelisaac@gmail.com';

-- ══════════════════════════════════════════════
-- BEATSUNLIMITED — BEAT CATALOG
-- ══════════════════════════════════════════════

create extension if not exists pgcrypto;

create table if not exists public.beat_catalog (
  id uuid default gen_random_uuid() primary key,
  video_id text unique not null,
  title text not null,
  producer text not null,
  producer_url text,
  genre text,
  tags text[] not null default '{}',
  tempo text,
  license text,
  thumb text,
  watch_url text,
  source text not null default 'seed' check (source in ('seed', 'youtube_api', 'manual')),
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.beat_catalog enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='beat_catalog' and policyname='Active beats are publicly readable') then
    create policy "Active beats are publicly readable" on public.beat_catalog for select using (is_active = true);
  end if;
end $$;
-- No client-facing insert/update/delete policies — catalog writes go through
-- the ingestion script (service role) only.

drop trigger if exists beat_catalog_updated_at on public.beat_catalog;
create trigger beat_catalog_updated_at
  before update on public.beat_catalog
  for each row execute procedure public.set_updated_at();

-- ══════════════════════════════════════════════
-- BEATSUNLIMITED — DEALS (split sheets)
-- ══════════════════════════════════════════════

create table if not exists public.beat_deals (
  id uuid default gen_random_uuid() primary key,
  deal_token text unique not null default encode(gen_random_bytes(16), 'hex'),
  beat_video_id text not null,
  beat_title text not null,
  producer_name text not null,
  producer_url text,
  deal_type text not null check (deal_type in ('points', 'hybrid', 'buyout')),
  master_split numeric not null check (master_split >= 0 and master_split <= 100),
  publishing_split numeric not null check (publishing_split >= 0 and publishing_split <= 100),
  upfront_fee numeric not null default 0 check (upfront_fee >= 0),
  artist_name text not null,
  artist_signed_at timestamptz not null default now(),
  producer_signed_name text,
  producer_signed_at timestamptz,
  decline_reason text,
  status text not null default 'proposed' check (status in ('proposed', 'countersigned', 'declined')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.beat_deals enable row level security;
-- Intentionally no client-facing policies: deals are only reachable through
-- the token-scoped security-definer RPCs below, so possessing a deal's random
-- 128-bit token is the sole capability needed (producer countersigns from a
-- link without an account) and enumeration via the table is impossible.

drop trigger if exists beat_deals_updated_at on public.beat_deals;
create trigger beat_deals_updated_at
  before update on public.beat_deals
  for each row execute procedure public.set_updated_at();

create or replace function public.bu_deal_to_json(d public.beat_deals)
returns json as $$
  select json_build_object(
    'id', d.id,
    'deal_token', d.deal_token,
    'beat_video_id', d.beat_video_id,
    'beat_title', d.beat_title,
    'producer_name', d.producer_name,
    'producer_url', d.producer_url,
    'deal_type', d.deal_type,
    'master_split', d.master_split,
    'publishing_split', d.publishing_split,
    'upfront_fee', d.upfront_fee,
    'artist_name', d.artist_name,
    'artist_signed_at', d.artist_signed_at,
    'producer_signed_name', d.producer_signed_name,
    'producer_signed_at', d.producer_signed_at,
    'decline_reason', d.decline_reason,
    'status', d.status,
    'created_at', d.created_at
  );
$$ language sql stable;

create or replace function public.bu_create_deal(
  p_beat_video_id text,
  p_beat_title text,
  p_producer_name text,
  p_producer_url text,
  p_deal_type text,
  p_master_split numeric,
  p_publishing_split numeric,
  p_upfront_fee numeric,
  p_artist_name text
) returns json as $$
declare
  d public.beat_deals;
begin
  if length(trim(p_artist_name)) < 2 then
    raise exception 'artist name required';
  end if;
  insert into public.beat_deals (
    beat_video_id, beat_title, producer_name, producer_url,
    deal_type, master_split, publishing_split, upfront_fee, artist_name
  ) values (
    p_beat_video_id, p_beat_title, p_producer_name, p_producer_url,
    p_deal_type, p_master_split, p_publishing_split, coalesce(p_upfront_fee, 0), trim(p_artist_name)
  ) returning * into d;
  return public.bu_deal_to_json(d);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.bu_get_deal(p_token text)
returns json as $$
declare
  d public.beat_deals;
begin
  select * into d from public.beat_deals where deal_token = p_token;
  if not found then return null; end if;
  return public.bu_deal_to_json(d);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.bu_countersign_deal(p_token text, p_producer_name text)
returns json as $$
declare
  d public.beat_deals;
begin
  if length(trim(p_producer_name)) < 2 then
    raise exception 'producer name required';
  end if;
  update public.beat_deals
  set status = 'countersigned',
      producer_signed_name = trim(p_producer_name),
      producer_signed_at = now()
  where deal_token = p_token and status = 'proposed'
  returning * into d;
  if not found then
    raise exception 'deal not found or already resolved';
  end if;
  return public.bu_deal_to_json(d);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.bu_decline_deal(p_token text, p_reason text default null)
returns json as $$
declare
  d public.beat_deals;
begin
  update public.beat_deals
  set status = 'declined',
      decline_reason = nullif(trim(coalesce(p_reason, '')), '')
  where deal_token = p_token and status = 'proposed'
  returning * into d;
  if not found then
    raise exception 'deal not found or already resolved';
  end if;
  return public.bu_deal_to_json(d);
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.bu_create_deal(text,text,text,text,text,numeric,numeric,numeric,text) from public;
revoke all on function public.bu_get_deal(text) from public;
revoke all on function public.bu_countersign_deal(text,text) from public;
revoke all on function public.bu_decline_deal(text,text) from public;
grant execute on function public.bu_create_deal(text,text,text,text,text,numeric,numeric,numeric,text) to anon, authenticated;
grant execute on function public.bu_get_deal(text) to anon, authenticated;
grant execute on function public.bu_countersign_deal(text,text) to anon, authenticated;
grant execute on function public.bu_decline_deal(text,text) to anon, authenticated;

-- Producer-supplied MP3s (uploaded with permission, e.g. after a deal or a
-- direct submission) live in the beat-files bucket; download_url points there
-- or to the producer's own hosted link. Never populated by ripping YouTube.
alter table public.beat_catalog add column if not exists download_url text;

insert into storage.buckets (id, name, public)
values ('beat-files', 'beat-files', true)
on conflict (id) do nothing;


-- ══════════════════════════════════════════════
-- INVITES (invite-only access gate)
-- ══════════════════════════════════════════════
--
-- Access to Noizes is invite-only. Before this table existed, "invited" and
-- "signed in with Google for the first time" were indistinguishable: Supabase
-- auto-provisions an auth.users row for any Google account that completes the
-- OAuth flow, on_auth_user_created then minted a profile, and nothing checked
-- whether the email had ever been invited. Any Gmail address could walk in.
--
-- public.invites is now the single source of truth for who is allowed an
-- account. An email must appear here BEFORE an auth.users row can be created
-- for it — enforced at the database level by require_invite_for_new_user()
-- below, so it holds regardless of which auth path (or dashboard setting) is
-- in play.
--
-- ⚠️  BACKFILL ORDER MATTERS: the backfill below grants an invite to every
-- email currently in public.profiles. Delete any uninvited accounts in
-- Authentication → Users FIRST — deleting the auth.users row cascades the
-- profiles row away, so it will not be backfilled. Run this script second.

create table if not exists public.invites (
  email text primary key,
  role text not null default 'collector' check (role in ('creator', 'collector')),
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz default now()
);

alter table public.invites enable row level security;

-- Writes are service-role only (the admin invite action). Admins get read
-- access so the waitlist screen can show who has already been invited.
do $$ begin
  if not exists (select 1 from pg_policies where tablename='invites' and policyname='Admins can read invites') then
    create policy "Admins can read invites" on public.invites for select
      using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
  end if;
end $$;

-- Backfill: every existing account keeps its access. See the ordering warning above.
insert into public.invites (email, role, invited_at)
select lower(p.email), p.role, coalesce(p.created_at, now())
from public.profiles p
where p.email is not null
on conflict (email) do nothing;

-- The gate itself. Rejects the insert outright, so no orphaned auth.users row
-- is left behind for an uninvited email and OAuth simply fails.
create or replace function public.require_invite_for_new_user()
returns trigger as $$
begin
  if not exists (select 1 from public.invites where email = lower(new.email)) then
    raise exception 'noizes_invite_required: % is not on the invite list', new.email
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists require_invite_for_new_user on auth.users;
create trigger require_invite_for_new_user
  before insert on auth.users
  for each row execute procedure public.require_invite_for_new_user();

-- Emails are matched case-insensitively everywhere; keep the table canonical.
create or replace function public.normalize_invite_email()
returns trigger as $$
begin new.email := lower(trim(new.email)); return new; end;
$$ language plpgsql;

drop trigger if exists normalize_invite_email on public.invites;
create trigger normalize_invite_email
  before insert or update on public.invites
  for each row execute procedure public.normalize_invite_email();
