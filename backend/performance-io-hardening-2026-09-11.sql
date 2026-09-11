-- Noizes v5: RLS planner and foreign-key I/O hardening.
-- Idempotent: safe to re-run. No data is rewritten or removed.

-- Foreign keys need a leading-column index on the referencing side so parent
-- updates/deletes and ownership joins do not scan entire child tables.
create index if not exists acquisitions_owner_id_idx on public.acquisitions (owner_id);
create index if not exists acquisitions_previous_owner_id_idx on public.acquisitions (previous_owner_id);
create index if not exists audio_assets_version_track_fk_idx on public.audio_assets (release_id, track_id, version_id);
create index if not exists collector_notes_author_id_idx on public.collector_notes (author_id);
create index if not exists invites_invited_by_idx on public.invites (invited_by);
create index if not exists kyc_submissions_reviewer_id_idx on public.kyc_submissions (reviewer_id);
create index if not exists kyc_submissions_user_id_idx on public.kyc_submissions (user_id);
create index if not exists offers_offerer_id_idx on public.offers (offerer_id);
create index if not exists offers_release_id_idx on public.offers (release_id);
create index if not exists payment_intents_acquisition_id_idx on public.payment_intents (acquisition_id);
create index if not exists payment_intents_buyer_id_idx on public.payment_intents (buyer_id);
create index if not exists payment_intents_offer_id_idx on public.payment_intents (offer_id);
create index if not exists payment_intents_release_id_idx on public.payment_intents (release_id);
create index if not exists payment_intents_seller_id_idx on public.payment_intents (seller_id);
create index if not exists profiles_kyc_reviewer_id_idx on public.profiles (kyc_reviewer_id);
create index if not exists provenance_events_acquisition_id_idx on public.provenance_events (acquisition_id);
create index if not exists provenance_events_from_owner_id_idx on public.provenance_events (from_owner_id);
create index if not exists provenance_events_to_owner_id_idx on public.provenance_events (to_owner_id);
create index if not exists releases_artist_id_idx on public.releases (artist_id);

-- KYC: authenticated owners see only their rows; administrators see all rows.
-- Combining the two SELECT predicates removes overlapping permissive policies
-- without broadening either side. Admin UPDATE keeps USING and WITH CHECK.
drop policy if exists "Users can read own kyc submissions" on public.kyc_submissions;
drop policy if exists "Admins can read all kyc submissions" on public.kyc_submissions;
create policy "Owners and admins read kyc submissions"
  on public.kyc_submissions for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

drop policy if exists "Users can insert own kyc submissions" on public.kyc_submissions;
create policy "Users can insert own kyc submissions"
  on public.kyc_submissions for insert to authenticated
  with check (
    user_id = (select auth.uid()) and status = 'pending'
    and reviewer_id is null and reviewed_at is null
  );

drop policy if exists "Admins can update kyc submissions" on public.kyc_submissions;
create policy "Admins can update kyc submissions"
  on public.kyc_submissions for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));

drop policy if exists "Published releases are public" on public.releases;
create policy "Published releases are public" on public.releases for select to anon, authenticated
  using (status = 'published' or artist_id = (select auth.uid()));
drop policy if exists "Creators can insert releases" on public.releases;
create policy "Creators can insert releases" on public.releases for insert to authenticated
  with check (artist_id = (select auth.uid()));
drop policy if exists "Creators can update own releases" on public.releases;
create policy "Creators can update own releases" on public.releases for update to authenticated
  using (artist_id = (select auth.uid())) with check (artist_id = (select auth.uid()));

drop policy if exists "Users can read own acquisitions" on public.acquisitions;
create policy "Users can read own acquisitions" on public.acquisitions for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists "Buyers can read own intents" on public.payment_intents;
create policy "Buyers can read own intents" on public.payment_intents for select to authenticated
  using (buyer_id = (select auth.uid()));
drop policy if exists "Admins can read invites" on public.invites;
create policy "Admins can read invites" on public.invites for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true));

drop policy if exists "Visible notes are public" on public.collector_notes;
create policy "Visible notes are public" on public.collector_notes for select to anon, authenticated
  using (status = 'visible' or author_id = (select auth.uid()));
drop policy if exists "Owners write their own stewardship note" on public.collector_notes;
create policy "Owners write their own stewardship note" on public.collector_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.acquisitions a where a.id = acquisition_id and a.owner_id = (select auth.uid())
  ));
drop policy if exists "Authors edit their own note" on public.collector_notes;
create policy "Authors edit their own note" on public.collector_notes for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

drop policy if exists "Owner and offerer read offers" on public.offers;
create policy "Owner and offerer read offers" on public.offers for select to authenticated
  using (offerer_id = (select auth.uid()) or exists (
    select 1 from public.acquisitions a where a.id = acquisition_id and a.owner_id = (select auth.uid())
  ));
drop policy if exists "Users make their own offers" on public.offers;
create policy "Users make their own offers" on public.offers for insert to authenticated
  with check (offerer_id = (select auth.uid()));
drop policy if exists "Offerers withdraw own offers" on public.offers;
create policy "Offerers withdraw own offers" on public.offers for update to authenticated
  using (offerer_id = (select auth.uid())) with check (offerer_id = (select auth.uid()));

-- Public visitors see only enabled links on published records. Authenticated
-- creators additionally see every link belonging to their own release.
drop policy if exists "Enabled links of published releases are public" on public.release_links;
drop policy if exists "Creators read own links" on public.release_links;
create policy "Anonymous users read enabled published links" on public.release_links for select to anon
  using (enabled and exists (
    select 1 from public.releases r where r.id = release_id and r.status in ('published','withdrawn','archived')
  ));
create policy "Authenticated users read allowed links" on public.release_links for select to authenticated
  using (
    (enabled and exists (select 1 from public.releases r where r.id = release_id and r.status in ('published','withdrawn','archived')))
    or exists (select 1 from public.releases r where r.id = release_id and r.artist_id = (select auth.uid()))
  );

-- Remaining creator-sensitive public reads: init-plan auth lookup and explicit roles.
drop policy if exists "Packages of published releases are public" on public.release_packages;
create policy "Packages of published releases are public" on public.release_packages for select to anon, authenticated
  using (exists (select 1 from public.releases r where r.id = release_id
    and (r.status in ('published','withdrawn','archived') or r.artist_id = (select auth.uid()))));
drop policy if exists "Authenticity is public" on public.release_authenticity;
create policy "Authenticity is public" on public.release_authenticity for select to anon, authenticated
  using (exists (select 1 from public.releases r where r.id = release_id
    and (r.status in ('published','withdrawn','archived') or r.artist_id = (select auth.uid()))));
drop policy if exists "Creators read own drop analytics" on public.drop_analytics;
create policy "Creators read own drop analytics" on public.drop_analytics for select to authenticated
  using (exists (select 1 from public.releases r where r.id = release_id and r.artist_id = (select auth.uid())));

create table if not exists public.schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
grant select, insert, update on public.schema_migrations to service_role;
insert into public.schema_migrations (filename)
values ('performance-io-hardening-2026-09-11.sql')
on conflict (filename) do update set applied_at = now();
