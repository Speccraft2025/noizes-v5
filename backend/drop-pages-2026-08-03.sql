-- ══════════════════════════════════════════════════════════════════════════
-- DROP PAGES  (publishing → Exchange → Drop Page → shareable .nz)
-- ══════════════════════════════════════════════════════════════════════════
-- A Drop Page is the permanent public destination for one published release.
-- This script adds only what routing, purchase logic and Exchange queries
-- genuinely need in the database. manifest.json inside the .nz remains the
-- source of truth for the object itself; everything here is the ecosystem's
-- publication and indexing layer.
--
-- Deliberately NOT created:
--   * a `packages` table replacing releases.nz_path — the release row already
--     carries the live package pointer, and acquisitions/collection/download
--     all resolve through it. `release_packages` below is the *version
--     history* beside it, so a re-publish never overwrites what a collector
--     already holds.
--   * an `editions` table — an edition is the release's edition_* columns plus
--     the acquisitions rows that claim numbers from it. Splitting that would
--     fork the sellout logic in $lib/server/acquire.js for no gain.
--
-- Idempotent: safe to re-run.
-- ══════════════════════════════════════════════════════════════════════════

-- ── Routing, publication state and availability on releases ───────────────
-- slug/artist_slug are the canonical Drop Page address. They are assigned at
-- publish and never recycled: release_slugs (below) keeps every slug a release
-- has ever answered to so a shared link cannot rot.
alter table public.releases add column if not exists slug text;
alter table public.releases add column if not exists artist_slug text;
alter table public.releases add column if not exists published_at timestamptz;
alter table public.releases add column if not exists withdrawn_at timestamptz;

-- Visibility is separate from status: an unlisted release is published and
-- reachable by its link, but is kept off the Exchange shelves.
alter table public.releases add column if not exists visibility text not null default 'public';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'releases_visibility_check') then
    alter table public.releases add constraint releases_visibility_check
      check (visibility in ('public', 'unlisted'));
  end if;
end $$;

-- Drop Page presentation + rights the page is allowed to claim. Defaults are
-- the conservative reading: nothing is claimed that the creator has not set.
alter table public.releases add column if not exists drop_description text;
alter table public.releases add column if not exists allow_public_download boolean not null default false;
alter table public.releases add column if not exists transferable boolean not null default true;
alter table public.releases add column if not exists resale_enabled boolean not null default true;
alter table public.releases add column if not exists offers_enabled boolean not null default true;
alter table public.releases add column if not exists rights_summary text;
alter table public.releases add column if not exists territory text;
alter table public.releases add column if not exists upc text;

-- The live package pointer, denormalized for the Drop Page and Exchange so
-- neither has to open the .nz to render. Every value here is re-derived from
-- the package at publish; none of it is client-supplied.
alter table public.releases add column if not exists package_id uuid;
alter table public.releases add column if not exists experience_entry text not null default 'experience.html';

-- 'withdrawn' keeps the Drop Page alive as an archive record while disabling
-- acquisition. 'archived' already existed and is retained.
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'releases_status_check') then
    alter table public.releases drop constraint releases_status_check;
  end if;
  alter table public.releases add constraint releases_status_check
    check (status in ('draft', 'published', 'archived', 'withdrawn'));
end $$;

-- One canonical address per release; one release per address.
create unique index if not exists releases_artist_slug_slug_key
  on public.releases (artist_slug, slug) where slug is not null;
create index if not exists releases_published_idx
  on public.releases (status, visibility, published_at desc);

-- ── Slug history (never break a shared link) ──────────────────────────────
-- Every address a release has ever answered to. The canonical row matches
-- releases.artist_slug/slug; older rows resolve with a 301 to the canonical
-- Drop Page. Reserving the address here is also the collision guard at
-- publish: the unique primary key is what makes generateDropSlug's retry loop
-- correct under concurrency rather than merely optimistic.
create table if not exists public.release_slugs (
  artist_slug text not null,
  slug text not null,
  release_id uuid references public.releases(id) on delete cascade not null,
  is_canonical boolean not null default true,
  created_at timestamptz default now(),
  primary key (artist_slug, slug)
);

create index if not exists release_slugs_release_idx on public.release_slugs (release_id);

alter table public.release_slugs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='release_slugs' and policyname='Slugs resolve publicly') then
    -- Resolving a shared link must work for a logged-out visitor. The row
    -- carries no information the Drop Page does not already publish.
    create policy "Slugs resolve publicly" on public.release_slugs for select using (true);
  end if;
  -- No write policies: slugs are reserved by the service role at publish.
end $$;

-- ── Package versions (integrity history) ──────────────────────────────────
-- One row per published build of a release's .nz. `version` increments; the
-- highest version is the live package and is mirrored onto releases.package_id.
-- Superseded rows stay forever: an edition somebody already holds must remain
-- describable, byte-for-byte, after the creator publishes a revision.
create table if not exists public.release_packages (
  id uuid default gen_random_uuid() primary key,
  release_id uuid references public.releases(id) on delete cascade not null,
  version integer not null default 1,
  storage_path text not null,
  filename text,
  file_size bigint not null default 0,
  manifest_json jsonb not null default '{}'::jsonb,
  manifest_hash text,
  package_hash text,
  package_version text,
  experience_entry text not null default 'experience.html',
  -- A handful of booleans summarizing experience.json, computed at publish.
  -- The Drop Page must be able to say "this release has an opening sequence"
  -- without opening a package that may be hundreds of megabytes.
  experience_summary jsonb not null default '{}'::jsonb,
  validation_status text not null default 'unvalidated'
    check (validation_status in ('unvalidated', 'valid', 'invalid')),
  validated_at timestamptz,
  created_at timestamptz default now(),
  unique (release_id, version)
);

create index if not exists release_packages_release_idx
  on public.release_packages (release_id, version desc);

alter table public.release_packages enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='release_packages' and policyname='Packages of published releases are public') then
    -- The Drop Page publishes hashes and validation status; hiding them would
    -- defeat the point of an object anyone can verify. storage_path is a path
    -- in an already-public bucket, not a secret.
    create policy "Packages of published releases are public" on public.release_packages for select
      using (exists (
        select 1 from public.releases r
        where r.id = release_id and (r.status in ('published', 'withdrawn', 'archived') or r.artist_id = auth.uid())
      ));
  end if;
  -- No write policies: written by the publish boundary (service role).
end $$;

-- ── Authenticity records ──────────────────────────────────────────────────
-- The creator's Ed25519 attestation over the package's component inventory,
-- lifted out of the .nz so the Drop Page can show certificate state without
-- downloading megabytes. Never a claim of copyright — see docs.
create table if not exists public.release_authenticity (
  id uuid default gen_random_uuid() primary key,
  release_id uuid references public.releases(id) on delete cascade not null,
  package_id uuid references public.release_packages(id) on delete cascade not null,
  signature_type text not null default 'ed25519',
  method text not null default 'sha256-component-inventory',
  content_hash text not null,
  signature text,
  signer_public_key text,
  certificate jsonb not null default '{}'::jsonb,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified', 'failed')),
  verified_at timestamptz,
  created_at timestamptz default now(),
  unique (package_id)
);

create index if not exists release_authenticity_release_idx
  on public.release_authenticity (release_id);

alter table public.release_authenticity enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='release_authenticity' and policyname='Authenticity is public') then
    create policy "Authenticity is public" on public.release_authenticity for select
      using (exists (
        select 1 from public.releases r
        where r.id = release_id and (r.status in ('published', 'withdrawn', 'archived') or r.artist_id = auth.uid())
      ));
  end if;
end $$;

-- ── Creator links ─────────────────────────────────────────────────────────
-- Secondary, understated. The Drop Page is not a link tree: the object is the
-- point, and these sit below it. https-only is enforced in the application and
-- again here, because an http:// or javascript: URL rendered into an anchor on
-- a page built for sharing is a hole worth closing twice.
create table if not exists public.release_links (
  id uuid default gen_random_uuid() primary key,
  release_id uuid references public.releases(id) on delete cascade not null,
  label text not null check (char_length(label) between 1 and 60),
  url text not null check (url ~* '^https://'),
  link_type text not null default 'other',
  position integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz default now()
);

create index if not exists release_links_release_idx
  on public.release_links (release_id, position);

alter table public.release_links enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='release_links' and policyname='Enabled links of published releases are public') then
    create policy "Enabled links of published releases are public" on public.release_links for select
      using (enabled and exists (
        select 1 from public.releases r
        where r.id = release_id and r.status in ('published', 'withdrawn', 'archived')
      ));
  end if;
  if not exists (select 1 from pg_policies where tablename='release_links' and policyname='Creators read own links') then
    create policy "Creators read own links" on public.release_links for select
      using (exists (select 1 from public.releases r where r.id = release_id and r.artist_id = auth.uid()));
  end if;
  -- Writes go through the creator-controls endpoint (service role) so that
  -- URL validation and ownership are checked in one place.
end $$;

-- ── Drop Page analytics (aggregate only) ──────────────────────────────────
-- Counters per release, per day, per event. No visitor rows, no identifiers,
-- no fingerprints — there is deliberately nothing here to correlate. A failure
-- to write must never block the page: every call site treats this as advisory.
create table if not exists public.drop_analytics (
  release_id uuid references public.releases(id) on delete cascade not null,
  day date not null default (now() at time zone 'utc')::date,
  event text not null check (event in (
    'view', 'share', 'qr', 'experience_open', 'download', 'acquire_start', 'acquire_complete'
  )),
  count integer not null default 0,
  primary key (release_id, day, event)
);

alter table public.drop_analytics enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='drop_analytics' and policyname='Creators read own drop analytics') then
    create policy "Creators read own drop analytics" on public.drop_analytics for select
      using (exists (select 1 from public.releases r where r.id = release_id and r.artist_id = auth.uid()));
  end if;
  -- No client write policy: increments go through the security-definer RPC.
end $$;

-- Increment is a security-definer RPC rather than a table grant so an
-- anonymous visitor can be counted without being able to read, edit or delete
-- any counter — including other releases'.
create or replace function public.bump_drop_analytics(p_release_id uuid, p_event text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event not in ('view', 'share', 'qr', 'experience_open', 'download', 'acquire_start', 'acquire_complete') then
    return;
  end if;
  -- Never count a release that is not publicly published: this would otherwise
  -- confirm the existence of an unpublished id to an anonymous caller.
  if not exists (
    select 1 from public.releases r
    where r.id = p_release_id and r.status in ('published', 'withdrawn')
  ) then
    return;
  end if;
  insert into public.drop_analytics (release_id, day, event, count)
  values (p_release_id, (now() at time zone 'utc')::date, p_event, 1)
  on conflict (release_id, day, event) do update
    set count = public.drop_analytics.count + 1;
end;
$$;

revoke all on function public.bump_drop_analytics(uuid, text) from public;
grant execute on function public.bump_drop_analytics(uuid, text) to anon, authenticated, service_role;

-- ── Provenance: the release's own chain ───────────────────────────────────
-- Copy chains are keyed by edition_number (null = open edition, 1..N =
-- numbered). The release ITSELF also has a history — it was created, it was
-- published — and that history belongs to no single copy. Edition number 0 is
-- reserved for it: allocation starts at 1 (see editionCandidates), so 0 can
-- never collide with a copy, and the existing unique(release_id,
-- edition_number, seq) constraint keeps the release chain append-only and
-- race-safe exactly like every other chain.
--
-- 'published' is a new kind. The hashed field set is unchanged, so every
-- signature written before this migration still verifies.
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'provenance_events_kind_check') then
    alter table public.provenance_events drop constraint provenance_events_kind_check;
  end if;
  alter table public.provenance_events add constraint provenance_events_kind_check
    check (kind in ('created', 'published', 'acquired', 'transferred', 'note', 'verified', 'withdrawn'));
end $$;

-- ── Backfill: give existing published releases a Drop Page ────────────────
-- Without this, every release published before today has no address and would
-- 404 from the Exchange. Slugs are derived the same way the application does
-- it (lowercase, non-alphanumerics to hyphens) and de-duplicated with the
-- release id's first four hex characters, which is the same stable suffix
-- shape generateDropSlug produces.
do $$
declare
  r record;
  base_artist text;
  base_slug text;
  candidate text;
begin
  for r in select id, artist_name, title from public.releases where slug is null loop
    base_artist := nullif(regexp_replace(lower(coalesce(r.artist_name, '')), '[^a-z0-9]+', '-', 'g'), '');
    base_artist := trim(both '-' from coalesce(base_artist, 'artist'));
    if base_artist = '' then base_artist := 'artist'; end if;

    base_slug := nullif(regexp_replace(lower(coalesce(r.title, '')), '[^a-z0-9]+', '-', 'g'), '');
    base_slug := trim(both '-' from coalesce(base_slug, 'release'));
    if base_slug = '' then base_slug := 'release'; end if;

    candidate := base_slug;
    if exists (select 1 from public.release_slugs s where s.artist_slug = base_artist and s.slug = candidate) then
      candidate := base_slug || '-' || substr(replace(r.id::text, '-', ''), 1, 4);
    end if;

    update public.releases
      set artist_slug = base_artist,
          slug = candidate,
          published_at = coalesce(published_at, created_at)
      where id = r.id;

    insert into public.release_slugs (artist_slug, slug, release_id, is_canonical)
      values (base_artist, candidate, r.id, true)
      on conflict (artist_slug, slug) do nothing;
  end loop;
end $$;

-- ── Migration ledger ─────────────────────────────────────────────────────
create table if not exists public.schema_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
grant select, insert, update on public.schema_migrations to service_role;

insert into public.schema_migrations (filename) values ('drop-pages-2026-08-03.sql')
  on conflict (filename) do update set applied_at = now();
