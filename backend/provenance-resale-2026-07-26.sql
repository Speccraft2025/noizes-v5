-- ══════════════════════════════════════════════════════════════════════════
-- PROVENANCE + RESALE LAYER  (v0.2.0.0)
-- ══════════════════════════════════════════════════════════════════════════
-- The "record now, market later" foundation, plus self-serve transfer and a
-- resale offer book. Four moving parts:
--
--   registry_signing_key   one platform-level Ed25519 key that attests CUSTODY
--                          (distinct from creator_signing_keys, which attest
--                          AUTHORSHIP of the .nz content_hash).
--   provenance_events      append-only, hash-chained, signed ledger of every
--                          custody event per (release, edition). The portable
--                          provenance.json is built from this.
--   collector_notes        one note per stewardship (period an owner holds an
--                          edition). Folded into the transfer receipt on the
--                          next custody change so it travels with the object.
--   offers                 resale offer book against a specific edition.
--
-- Every write here goes through the service-role client. RLS grants READ only.
-- Idempotent: safe to re-run.
-- ══════════════════════════════════════════════════════════════════════════

-- ── Registry signing key (custody attestation root) ───────────────────────
-- Single-row table. The private key is encrypted at rest with SIGNING_KEK,
-- exactly like creator_signing_keys. public_key is published so any verifier
-- can check the provenance chain offline.
create table if not exists public.registry_signing_key (
  id integer primary key default 1 check (id = 1),
  public_key text not null,
  private_key_encrypted text not null,
  created_at timestamptz default now()
);

alter table public.registry_signing_key enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='registry_signing_key' and policyname='Registry public key is world-readable') then
    -- Only the public_key column matters for verification; the encrypted
    -- private key is never selected by anon/authenticated roles because RLS
    -- plus column privileges below restrict it. We expose the row for select
    -- but revoke the private column from non-service roles.
    create policy "Registry public key is world-readable" on public.registry_signing_key for select using (true);
  end if;
end $$;

revoke select (private_key_encrypted) on public.registry_signing_key from anon, authenticated;

-- ── Accepting-offers flag on acquisitions ─────────────────────────────────
alter table public.acquisitions add column if not exists accepting_offers boolean not null default false;

-- ── Provenance events (signed, hash-chained ledger) ───────────────────────
-- One chain per (release_id, edition_number). `seq` is 0-based position;
-- seq 0 is always the genesis ('created') event. `prev_hash` links to the
-- previous event's content_hash, so any insertion/reorder/tamper breaks the
-- chain. content_hash covers the canonical serialization of the event fields
-- INCLUDING prev_hash; signature is Ed25519(content_hash) by the registry key.
create table if not exists public.provenance_events (
  id uuid default gen_random_uuid() primary key,
  release_id uuid references public.releases(id) on delete cascade not null,
  edition_number integer,
  seq integer not null,
  kind text not null check (kind in ('created', 'acquired', 'transferred', 'note', 'verified')),
  from_owner_id uuid references public.profiles(id) on delete set null,
  to_owner_id uuid references public.profiles(id) on delete set null,
  acquisition_id uuid references public.acquisitions(id) on delete set null,
  price numeric,
  currency text,
  note text,
  occurred_at timestamptz not null default now(),
  prev_hash text,
  content_hash text not null,
  signature text not null,
  signer_public_key text not null,
  -- one event per position in a chain; also the concurrency guard for appends
  unique (release_id, edition_number, seq)
);

create index if not exists provenance_events_chain_idx
  on public.provenance_events (release_id, edition_number, seq);

alter table public.provenance_events enable row level security;

do $$ begin
  -- Provenance is public: the whole point is that history is verifiable by
  -- anyone. No PII beyond user ids (display names are resolved separately).
  if not exists (select 1 from pg_policies where tablename='provenance_events' and policyname='Provenance is public') then
    create policy "Provenance is public" on public.provenance_events for select using (true);
  end if;
  -- No insert/update/delete policies: append-only via service role only.
end $$;

-- ── Collector notes (one per stewardship) ─────────────────────────────────
-- A stewardship = one acquisition row (a period an owner holds an edition).
-- unique(acquisition_id) enforces "one note per stewardship". status lets an
-- operator hide abusive content WITHOUT deleting the provenance event it was
-- folded into (moderation is a display concern; the signed chain is immutable,
-- so hiding here suppresses on-platform display only — see docs).
create table if not exists public.collector_notes (
  id uuid default gen_random_uuid() primary key,
  acquisition_id uuid references public.acquisitions(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete set null not null,
  body text not null check (char_length(body) between 1 and 280),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (acquisition_id)
);

alter table public.collector_notes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='collector_notes' and policyname='Visible notes are public') then
    create policy "Visible notes are public" on public.collector_notes for select
      using (status = 'visible' or author_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='collector_notes' and policyname='Owners write their own stewardship note') then
    -- The author must currently own the acquisition the note attaches to.
    create policy "Owners write their own stewardship note" on public.collector_notes for insert
      with check (
        author_id = auth.uid()
        and exists (
          select 1 from public.acquisitions a
          where a.id = acquisition_id and a.owner_id = auth.uid()
        )
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='collector_notes' and policyname='Authors edit their own note') then
    create policy "Authors edit their own note" on public.collector_notes for update
      using (author_id = auth.uid())
      with check (author_id = auth.uid());
  end if;
end $$;

drop trigger if exists collector_notes_updated_at on public.collector_notes;
create trigger collector_notes_updated_at
  before update on public.collector_notes
  for each row execute procedure public.set_updated_at();

-- ── Resale offers (offer book) ────────────────────────────────────────────
-- An offer targets a specific edition (acquisition_id). Only 'active' offers
-- show in the book. Accepting an offer routes through payment_intents (kind
-- 'resale') and, on payment success, transfers custody + records provenance.
create table if not exists public.offers (
  id uuid default gen_random_uuid() primary key,
  acquisition_id uuid references public.acquisitions(id) on delete cascade not null,
  release_id uuid references public.releases(id) on delete cascade not null,
  offerer_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric not null check (amount > 0),
  currency text not null default 'KES',
  status text not null default 'active'
    check (status in ('active', 'withdrawn', 'accepted', 'declined', 'expired')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists offers_book_idx
  on public.offers (acquisition_id, status);

-- A user may hold at most one active offer per edition (re-offering updates).
create unique index if not exists offers_one_active_per_offerer
  on public.offers (acquisition_id, offerer_id) where status = 'active';

alter table public.offers enable row level security;

do $$ begin
  -- The book is visible to the current owner (to decide) and to the offerer
  -- (to track their bid). Not fully public in v1 to avoid bid-signalling games.
  if not exists (select 1 from pg_policies where tablename='offers' and policyname='Owner and offerer read offers') then
    create policy "Owner and offerer read offers" on public.offers for select
      using (
        offerer_id = auth.uid()
        or exists (
          select 1 from public.acquisitions a
          where a.id = acquisition_id and a.owner_id = auth.uid()
        )
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='offers' and policyname='Users make their own offers') then
    create policy "Users make their own offers" on public.offers for insert
      with check (offerer_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='offers' and policyname='Offerers withdraw own offers') then
    -- Offerer can withdraw; acceptance/decline by owner goes through service role.
    create policy "Offerers withdraw own offers" on public.offers for update
      using (offerer_id = auth.uid())
      with check (offerer_id = auth.uid());
  end if;
end $$;

drop trigger if exists offers_updated_at on public.offers;
create trigger offers_updated_at
  before update on public.offers
  for each row execute procedure public.set_updated_at();

-- ── payment_intents: support resale ───────────────────────────────────────
-- Reuse the existing ledger for resale charges. `kind` distinguishes primary
-- acquisition from resale; `offer_id` links a resale charge to the offer.
alter table public.payment_intents add column if not exists kind text not null default 'primary'
  check (kind in ('primary', 'resale'));
alter table public.payment_intents add column if not exists offer_id uuid references public.offers(id) on delete set null;
alter table public.payment_intents add column if not exists acquisition_id uuid references public.acquisitions(id) on delete set null;
alter table public.payment_intents add column if not exists seller_id uuid references public.profiles(id) on delete set null;
