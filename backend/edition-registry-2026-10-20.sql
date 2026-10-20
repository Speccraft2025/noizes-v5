-- NOIZES EDITION REGISTRY HARDENING (v0.3.0.0)
--
-- Existing `acquisitions` rows already represent the single, transferable
-- authenticated copy of a release. This migration makes that fact explicit;
-- it does not introduce a second ownership table or rewrite historic rows.
-- Run after provenance-resale-2026-07-26.sql.

-- Edition declaration fields live with the existing release/edition record.
alter table public.releases
  add column if not exists issuer_public_key text,
  add column if not exists issuance_open boolean not null default true,
  add column if not exists edition_declaration_hash text,
  add column if not exists edition_signature text,
  add column if not exists published_at timestamptz,
  add column if not exists corrected_at timestamptz,
  add column if not exists resale_artist_bps integer not null default 1000
    check (resale_artist_bps between 0 and 10000);

-- A release is the current compatible representation of an edition. Never
-- allow impossible supply declarations in either newly-created or historic UI.
alter table public.releases drop constraint if exists releases_edition_supply_check;
alter table public.releases add constraint releases_edition_supply_check check (
  (edition_size is null and lower(edition_type) like '%open%')
  or (edition_size is not null and edition_size > 0 and lower(edition_type) not like '%open%')
);

-- `id` remains the globally unique copy id. The certificate columns provide a
-- stable, offline-verifiable copy declaration without duplicating the row.
alter table public.acquisitions
  add column if not exists issued_at timestamptz,
  add column if not exists certificate_hash text,
  add column if not exists issuer_signature text,
  add column if not exists registry_verified_at timestamptz,
  add column if not exists public_custodian_label text,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'revoked', 'superseded'));

update public.acquisitions
set issued_at = coalesce(issued_at, acquired_at)
where issued_at is null;

alter table public.acquisitions alter column issued_at set default now();
alter table public.acquisitions alter column issued_at set not null;
alter table public.acquisitions drop constraint if exists acquisitions_serial_range;
alter table public.acquisitions add constraint acquisitions_serial_range check (edition_number is null or edition_number >= 1);

-- The serial is immutable. A custody transfer may change current owner only;
-- it must never renumber, reissue, or move a copy to another edition.
create or replace function public.guard_authenticated_copy_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.release_id is distinct from old.release_id
     or new.edition_number is distinct from old.edition_number
     or new.issued_at is distinct from old.issued_at
     or new.certificate_hash is distinct from old.certificate_hash
     or new.issuer_signature is distinct from old.issuer_signature then
    raise exception 'authenticated copy identity is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists acquisitions_copy_identity_immutable on public.acquisitions;
create trigger acquisitions_copy_identity_immutable
  before update on public.acquisitions
  for each row execute function public.guard_authenticated_copy_immutability();

-- A release declaration becomes immutable as soon as a numbered copy exists.
-- Corrections are historical events, not silent edits.
create or replace function public.guard_edition_declaration()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  issued_count integer;
  highest_serial integer;
begin
  select count(*), max(edition_number)
    into issued_count, highest_serial
    from public.acquisitions
   where release_id = old.id;

  if issued_count > 0 and (
    new.edition_type is distinct from old.edition_type
    or new.edition_size is distinct from old.edition_size
    or new.issuer_public_key is distinct from old.issuer_public_key
    or new.edition_declaration_hash is distinct from old.edition_declaration_hash
  ) then
    raise exception 'published edition declaration is immutable after issuance';
  end if;

  if new.edition_size is not null and highest_serial is not null and new.edition_size < highest_serial then
    raise exception 'edition size cannot be below the highest issued serial';
  end if;
  return new;
end;
$$;

drop trigger if exists releases_edition_declaration_guard on public.releases;
create trigger releases_edition_declaration_guard
  before update on public.releases
  for each row execute function public.guard_edition_declaration();

-- Public provenance needs the copy identity but never private payment or
-- participant data. Expand types append-only for corrections and stewardship.
alter table public.provenance_events add column if not exists event_id text;
alter table public.provenance_events add column if not exists supersedes_event_id uuid references public.provenance_events(id) on delete restrict;
alter table public.provenance_events add column if not exists recorded_at timestamptz not null default now();
alter table public.provenance_events drop constraint if exists provenance_events_kind_check;
alter table public.provenance_events add constraint provenance_events_kind_check check (kind in (
  'created', 'published', 'issued', 'acquired', 'listing_opened', 'offer_accepted',
  'transferred', 'gifted', 'inherited', 'donated', 'archived', 'preserved',
  'exhibited', 'verified', 'royalty_paid', 'custodian_note', 'corrected'
));

-- Listing state belongs on the existing authenticated copy. `accepting_offers`
-- remains supported for compatibility and is kept in sync by the API.
alter table public.acquisitions
  add column if not exists listing_state text not null default 'not_listed'
    check (listing_state in ('not_listed', 'offers_open', 'buy_now', 'paused', 'sold')),
  add column if not exists asking_price numeric,
  add column if not exists listed_at timestamptz;

alter table public.offers drop constraint if exists offers_status_check;
alter table public.offers add constraint offers_status_check check (
  status in ('draft', 'active', 'accepted', 'declined', 'withdrawn', 'expired', 'superseded', 'completed', 'cancelled')
);

-- The function is intentionally server/service-role only. It atomically
-- accepts exactly one currently-active offer for a still-owned active listing,
-- then supersedes all competitors. Payment and custody transfer retain their
-- existing trusted server flow.
create or replace function public.accept_copy_offer(p_offer_id uuid, p_seller_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected public.offers;
  copy_row public.acquisitions;
begin
  select * into selected from public.offers where id = p_offer_id for update;
  if not found or selected.status <> 'active' then
    raise exception 'offer is not active';
  end if;
  select * into copy_row from public.acquisitions where id = selected.acquisition_id for update;
  if not found or copy_row.owner_id <> p_seller_id then
    raise exception 'seller no longer owns this authenticated copy';
  end if;
  if copy_row.listing_state not in ('offers_open', 'buy_now') or not copy_row.accepting_offers then
    raise exception 'listing is not active';
  end if;
  update public.offers set status = 'superseded', updated_at = now()
    where acquisition_id = selected.acquisition_id and status = 'active' and id <> selected.id;
  update public.offers set status = 'accepted', updated_at = now() where id = selected.id
    returning * into selected;
  return selected;
end;
$$;

revoke execute on function public.accept_copy_offer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_copy_offer(uuid, uuid) to service_role;

insert into public.schema_migrations (filename) values ('edition-registry-2026-10-20.sql')
  on conflict (filename) do update set applied_at = now();
