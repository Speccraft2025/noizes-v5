-- Noizes multi-track releases — Phase 1
-- Apply after backend/supabase_schema.sql in Supabase Dashboard → SQL Editor.
-- Idempotent and safe to re-run. Existing releases are normalized as Singles.

begin;

-- ── Release identity ────────────────────────────────────────────────────────

alter table public.releases add column if not exists release_type text not null default 'single';
alter table public.releases add column if not exists featured_artists text[] not null default '{}';
alter table public.releases add column if not exists compilation_artists text[] not null default '{}';
alter table public.releases add column if not exists release_date date;
alter table public.releases add column if not exists genres text[] not null default '{}';
alter table public.releases add column if not exists catalogue_number text;
alter table public.releases add column if not exists label text;
alter table public.releases add column if not exists track_count integer not null default 0;
alter table public.releases add column if not exists disc_count integer not null default 1;
alter table public.releases add column if not exists total_duration_ms bigint not null default 0;
alter table public.releases add column if not exists explicit boolean not null default false;
alter table public.releases add column if not exists package_size bigint not null default 0;
alter table public.releases add column if not exists curator text;
alter table public.releases add column if not exists compiler text;
alter table public.releases add column if not exists venue text;
alter table public.releases add column if not exists event_name text;
alter table public.releases add column if not exists recording_date date;
alter table public.releases add column if not exists release_metadata jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.releases'::regclass
      and conname = 'releases_release_type_check'
  ) then
    alter table public.releases add constraint releases_release_type_check check (
      release_type in ('single', 'ep', 'album', 'mixtape', 'compilation', 'live_release', 'soundtrack', 'dj_mix', 'other')
    );
  end if;
end $$;

update public.releases
set genres = case
  when cardinality(genres) > 0 then genres
  when nullif(trim(genre), '') is not null then array[trim(genre)]
  else '{}'::text[]
end;

-- ── Track, version, and physical audio asset are separate records ───────────

create table if not exists public.tracks (
  id uuid default gen_random_uuid() primary key,
  release_id uuid references public.releases(id) on delete cascade not null,
  position integer not null default 1 check (position > 0),
  disc_number integer not null default 1 check (disc_number > 0),
  track_number integer not null default 1 check (track_number > 0),
  title text not null default '',
  subtitle text,
  primary_artist text not null default '',
  featured_artists text[] not null default '{}',
  producers text[] not null default '{}',
  writers text[] not null default '{}',
  isrc text,
  explicit boolean not null default false,
  bonus boolean not null default false,
  hidden boolean not null default false,
  description text,
  release_date date,
  source_release text,
  recording_date date,
  recording_location text,
  artwork_ref text,
  primary_version_id uuid,
  primary_audio_asset_id uuid,
  lyrics_ref text,
  credits_ref text,
  rights_ref text,
  appears_in_journey boolean not null default true,
  appears_in_archive boolean not null default true,
  inherit_release_artist boolean not null default true,
  inherit_release_credits boolean not null default true,
  inherit_release_rights boolean not null default true,
  lyrics jsonb not null default '{}'::jsonb,
  credits jsonb not null default '{}'::jsonb,
  rights jsonb not null default '{}'::jsonb,
  track_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (release_id, id)
);

alter table public.tracks add column if not exists release_date date;
alter table public.tracks add column if not exists source_release text;
alter table public.tracks add column if not exists recording_date date;
alter table public.tracks add column if not exists recording_location text;

create table if not exists public.audio_versions (
  id uuid default gen_random_uuid() primary key,
  release_id uuid not null,
  track_id uuid not null,
  role text not null default 'alternate' check (length(trim(role)) > 0),
  title text not null default '',
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (release_id, track_id, id),
  constraint audio_versions_track_fk foreign key (release_id, track_id)
    references public.tracks(release_id, id) on delete cascade
);

create table if not exists public.audio_assets (
  id uuid default gen_random_uuid() primary key,
  release_id uuid references public.releases(id) on delete cascade not null,
  track_id uuid,
  version_id uuid,
  scope text not null check (scope in ('release', 'track')),
  asset_type text not null default 'audio' check (asset_type = 'audio'),
  role text not null check (length(trim(role)) > 0),
  title text,
  filename text,
  storage_path text,
  mime text,
  duration_ms bigint not null default 0 check (duration_ms >= 0),
  sample_rate integer not null default 0 check (sample_rate >= 0),
  bit_depth integer not null default 0 check (bit_depth >= 0),
  channels integer not null default 0 check (channels >= 0),
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  sha256 text,
  technical jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (release_id, track_id, id),
  constraint audio_assets_scope_membership_check check (
    (scope = 'release' and track_id is null and version_id is null)
    or (scope = 'track' and track_id is not null)
  ),
  constraint audio_assets_track_fk foreign key (release_id, track_id)
    references public.tracks(release_id, id) on delete cascade,
  constraint audio_assets_version_track_fk foreign key (release_id, track_id, version_id)
    references public.audio_versions(release_id, track_id, id) on delete cascade
);

create unique index if not exists audio_versions_one_primary_per_track
  on public.audio_versions(track_id) where is_primary;
create unique index if not exists audio_assets_one_primary_master_per_track
  on public.audio_assets(track_id) where scope = 'track' and role = 'primary_master';
create unique index if not exists audio_assets_one_continuous_master_per_release
  on public.audio_assets(release_id) where scope = 'release' and role = 'continuous_master';
create index if not exists tracks_release_order_idx
  on public.tracks(release_id, disc_number, track_number, position);
create index if not exists audio_versions_track_idx on public.audio_versions(track_id);
create index if not exists audio_assets_release_idx on public.audio_assets(release_id);
create index if not exists audio_assets_track_idx on public.audio_assets(track_id) where track_id is not null;

-- ── Legacy release normalization ────────────────────────────────────────────

insert into public.tracks (
  release_id, position, disc_number, track_number, title, primary_artist,
  inherit_release_artist, appears_in_journey, appears_in_archive
)
select
  release.id, 1, 1, 1, release.title, release.artist_name,
  true, true, true
from public.releases as release
where not exists (
  select 1 from public.tracks as track where track.release_id = release.id
);

insert into public.audio_versions (release_id, track_id, role, title, is_primary)
select release.id, track.id, 'primary_master', 'Primary master', true
from public.releases as release
join public.tracks as track on track.release_id = release.id and track.position = 1
where release.audio_path is not null
  and not exists (
    select 1 from public.audio_versions as version
    where version.track_id = track.id and version.is_primary
  );

insert into public.audio_assets (
  release_id, track_id, version_id, scope, role, title, filename, storage_path
)
select
  release.id,
  track.id,
  version.id,
  'track',
  'primary_master',
  track.title,
  regexp_replace(release.audio_path, '^.*/', ''),
  release.audio_path
from public.releases as release
join public.tracks as track on track.release_id = release.id and track.position = 1
join public.audio_versions as version on version.track_id = track.id and version.is_primary
where release.audio_path is not null
  and not exists (
    select 1 from public.audio_assets as asset
    where asset.track_id = track.id and asset.role = 'primary_master'
  );

update public.tracks as track
set
  primary_version_id = version.id,
  primary_audio_asset_id = asset.id
from public.audio_versions as version
join public.audio_assets as asset on asset.version_id = version.id
where version.track_id = track.id
  and version.is_primary
  and (track.primary_version_id is null or track.primary_audio_asset_id is null);

update public.releases as release
set
  track_count = summary.track_count,
  disc_count = greatest(summary.disc_count, 1),
  total_duration_ms = summary.total_duration_ms
from (
  select
    track.release_id,
    count(*)::integer as track_count,
    coalesce(max(track.disc_number), 1)::integer as disc_count,
    coalesce(sum(primary_asset.duration_ms), 0)::bigint as total_duration_ms
  from public.tracks as track
  left join public.audio_assets as primary_asset
    on primary_asset.id = track.primary_audio_asset_id
  group by track.release_id
) as summary
where summary.release_id = release.id;

-- Keep Exchange summary fields in sync without making them the source of truth.
create or replace function public.sync_release_track_summary()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_release_id uuid;
begin
  if tg_op = 'DELETE' then
    target_release_id := old.release_id;
  else
    target_release_id := new.release_id;
  end if;

  update public.releases as release
  set
    track_count = summary.track_count,
    disc_count = greatest(summary.disc_count, 1),
    total_duration_ms = summary.total_duration_ms
  from (
    select
      count(track.id)::integer as track_count,
      coalesce(max(track.disc_number), 1)::integer as disc_count,
      coalesce(sum(primary_asset.duration_ms), 0)::bigint as total_duration_ms
    from public.tracks as track
    left join public.audio_assets as primary_asset
      on primary_asset.id = track.primary_audio_asset_id
    where track.release_id = target_release_id
  ) as summary
  where release.id = target_release_id;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists tracks_sync_release_summary on public.tracks;
create trigger tracks_sync_release_summary
  after insert or update or delete on public.tracks
  for each row execute procedure public.sync_release_track_summary();

drop trigger if exists audio_assets_sync_release_summary on public.audio_assets;
create trigger audio_assets_sync_release_summary
  after insert or update or delete on public.audio_assets
  for each row execute procedure public.sync_release_track_summary();

drop trigger if exists tracks_updated_at on public.tracks;
create trigger tracks_updated_at
  before update on public.tracks
  for each row execute procedure public.set_updated_at();

drop trigger if exists audio_versions_updated_at on public.audio_versions;
create trigger audio_versions_updated_at
  before update on public.audio_versions
  for each row execute procedure public.set_updated_at();

drop trigger if exists audio_assets_updated_at on public.audio_assets;
create trigger audio_assets_updated_at
  before update on public.audio_assets
  for each row execute procedure public.set_updated_at();

-- ── Data API grants and RLS ─────────────────────────────────────────────────

alter table public.tracks enable row level security;
alter table public.audio_versions enable row level security;
alter table public.audio_assets enable row level security;

revoke all on public.tracks from anon, authenticated;
revoke all on public.audio_versions from anon, authenticated;
revoke all on public.audio_assets from anon, authenticated;
grant select on public.tracks, public.audio_versions, public.audio_assets to anon;
grant select, insert, update, delete on public.tracks, public.audio_versions, public.audio_assets to authenticated;

drop policy if exists "Published tracks are public" on public.tracks;
create policy "Published tracks are public" on public.tracks for select
  to anon, authenticated
  using (exists (
    select 1 from public.releases as release
    where release.id = tracks.release_id
      and (release.status = 'published' or release.artist_id = (select auth.uid()))
  ));

drop policy if exists "Creators insert tracks on own releases" on public.tracks;
create policy "Creators insert tracks on own releases" on public.tracks for insert
  to authenticated
  with check (exists (
    select 1 from public.releases as release
    where release.id = tracks.release_id
      and release.artist_id = (select auth.uid())
  ));

drop policy if exists "Creators update tracks on own releases" on public.tracks;
create policy "Creators update tracks on own releases" on public.tracks for update
  to authenticated
  using (exists (
    select 1 from public.releases as release
    where release.id = tracks.release_id
      and release.artist_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.releases as release
    where release.id = tracks.release_id
      and release.artist_id = (select auth.uid())
  ));

drop policy if exists "Creators delete tracks on own releases" on public.tracks;
create policy "Creators delete tracks on own releases" on public.tracks for delete
  to authenticated
  using (exists (
    select 1 from public.releases as release
    where release.id = tracks.release_id
      and release.artist_id = (select auth.uid())
  ));

drop policy if exists "Published audio versions are public" on public.audio_versions;
create policy "Published audio versions are public" on public.audio_versions for select
  to anon, authenticated
  using (exists (
    select 1 from public.releases as release
    where release.id = audio_versions.release_id
      and (release.status = 'published' or release.artist_id = (select auth.uid()))
  ));

drop policy if exists "Creators insert audio versions on own releases" on public.audio_versions;
create policy "Creators insert audio versions on own releases" on public.audio_versions for insert
  to authenticated
  with check (exists (
    select 1 from public.releases as release
    where release.id = audio_versions.release_id
      and release.artist_id = (select auth.uid())
  ));

drop policy if exists "Creators update audio versions on own releases" on public.audio_versions;
create policy "Creators update audio versions on own releases" on public.audio_versions for update
  to authenticated
  using (exists (
    select 1 from public.releases as release
    where release.id = audio_versions.release_id
      and release.artist_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.releases as release
    where release.id = audio_versions.release_id
      and release.artist_id = (select auth.uid())
  ));

drop policy if exists "Creators delete audio versions on own releases" on public.audio_versions;
create policy "Creators delete audio versions on own releases" on public.audio_versions for delete
  to authenticated
  using (exists (
    select 1 from public.releases as release
    where release.id = audio_versions.release_id
      and release.artist_id = (select auth.uid())
  ));

drop policy if exists "Published audio assets are public" on public.audio_assets;
create policy "Published audio assets are public" on public.audio_assets for select
  to anon, authenticated
  using (exists (
    select 1 from public.releases as release
    where release.id = audio_assets.release_id
      and (release.status = 'published' or release.artist_id = (select auth.uid()))
  ));

drop policy if exists "Creators insert audio assets on own releases" on public.audio_assets;
create policy "Creators insert audio assets on own releases" on public.audio_assets for insert
  to authenticated
  with check (exists (
    select 1 from public.releases as release
    where release.id = audio_assets.release_id
      and release.artist_id = (select auth.uid())
  ));

drop policy if exists "Creators update audio assets on own releases" on public.audio_assets;
create policy "Creators update audio assets on own releases" on public.audio_assets for update
  to authenticated
  using (exists (
    select 1 from public.releases as release
    where release.id = audio_assets.release_id
      and release.artist_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.releases as release
    where release.id = audio_assets.release_id
      and release.artist_id = (select auth.uid())
  ));

drop policy if exists "Creators delete audio assets on own releases" on public.audio_assets;
create policy "Creators delete audio assets on own releases" on public.audio_assets for delete
  to authenticated
  using (exists (
    select 1 from public.releases as release
    where release.id = audio_assets.release_id
      and release.artist_id = (select auth.uid())
  ));

-- Existing release UPDATE policy lacked WITH CHECK. Recreate it so a creator
-- cannot change artist_id while updating normalized release metadata.
drop policy if exists "Creators can update own releases" on public.releases;
create policy "Creators can update own releases" on public.releases for update
  to authenticated
  using ((select auth.uid()) = artist_id)
  with check ((select auth.uid()) = artist_id);

commit;

-- PostgREST normally receives DDL notifications automatically. Explicitly
-- reload the API schema as well so a freshly deployed migration cannot leave
-- publishing on a stale `catalogue_number` cache entry.
notify pgrst, 'reload schema';
