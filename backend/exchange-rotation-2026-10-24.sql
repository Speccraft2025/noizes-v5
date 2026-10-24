-- Noizes Exchange Rotation, private appreciation state, and aggregate analytics.
-- Additive migration: it leaves releases, ownership, resale listings, and
-- existing provenance records intact.

create schema if not exists exchange_internal;
revoke all on schema exchange_internal from public, anon, authenticated;

-- Appreciation is a per-user state on the existing release. It never stores
-- or accepts a client-supplied aggregate count.
create table if not exists public.release_appreciations (
  user_id uuid not null references auth.users(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  appreciated boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, release_id)
);

create index if not exists release_appreciations_release_state_idx
  on public.release_appreciations (release_id, appreciated);

alter table public.release_appreciations enable row level security;
revoke all on table public.release_appreciations from anon, authenticated;
grant select, insert, update on table public.release_appreciations to authenticated;
grant all on table public.release_appreciations to service_role;

drop policy if exists "Users read their own release appreciations" on public.release_appreciations;
create policy "Users read their own release appreciations"
  on public.release_appreciations for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users appreciate eligible public releases" on public.release_appreciations;
create policy "Users appreciate eligible public releases"
  on public.release_appreciations for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and appreciated = true
    and exists (
      select 1 from public.releases r
      where r.id = release_id
        and r.status = 'published'
        and r.visibility = 'public'
        and r.withdrawn_at is null
        and r.slug is not null
        and r.artist_slug is not null
    )
  );

drop policy if exists "Users update their own release appreciations" on public.release_appreciations;
create policy "Users update their own release appreciations"
  on public.release_appreciations for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and (
      appreciated = false
      or exists (
        select 1 from public.releases r
        where r.id = release_id
          and r.status = 'published'
          and r.visibility = 'public'
          and r.withdrawn_at is null
          and r.slug is not null
          and r.artist_slug is not null
      )
    )
  );

create or replace function exchange_internal.guard_release_appreciation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  acting_user uuid := (select auth.uid());
  changed_at timestamptz := clock_timestamp();
begin
  if acting_user is null or acting_user is distinct from new.user_id then
    raise exception 'appreciation must belong to the authenticated user'
      using errcode = '42501';
  end if;

  if (tg_op = 'INSERT' or new.appreciated is distinct from false) and not exists (
    select 1 from public.releases r
    where r.id = new.release_id
      and r.status = 'published'
      and r.visibility = 'public'
      and r.withdrawn_at is null
      and r.slug is not null
      and r.artist_slug is not null
  ) then
    raise exception 'release is not eligible for appreciation'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if new.appreciated is distinct from true then
      raise exception 'new appreciation state must be active'
        using errcode = '23514';
    end if;
    new.created_at := changed_at;
    new.updated_at := changed_at;
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.release_id is distinct from old.release_id
     or new.created_at is distinct from old.created_at then
    raise exception 'appreciation identity is immutable'
      using errcode = '42501';
  end if;

  if new.appreciated is distinct from old.appreciated then
    if old.updated_at > changed_at - interval '750 milliseconds' then
      raise exception 'please wait before changing appreciation again'
        using errcode = 'P0001';
    end if;
    new.updated_at := changed_at;
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

revoke all on function exchange_internal.guard_release_appreciation() from public, anon, authenticated;
drop trigger if exists guard_release_appreciation on public.release_appreciations;
create trigger guard_release_appreciation
  before insert or update on public.release_appreciations
  for each row execute function exchange_internal.guard_release_appreciation();

-- Rotation snapshots contain only public release IDs. Only the trusted app
-- server can read or write the snapshot table.
create table if not exists public.exchange_rotation_snapshots (
  window_id text primary key,
  catalogue_version text not null,
  release_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exchange_rotation_snapshots enable row level security;
revoke all on table public.exchange_rotation_snapshots from anon, authenticated;
grant all on table public.exchange_rotation_snapshots to service_role;

-- A short-lived pseudonymous session hash deduplicates meaningful viewport
-- impressions inside one rotation window. The raw browser token is not stored.
create table if not exists public.exchange_rotation_impressions (
  window_id text not null,
  release_id uuid not null references public.releases(id) on delete cascade,
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (window_id, release_id, visitor_hash)
);

create index if not exists exchange_rotation_impressions_release_time_idx
  on public.exchange_rotation_impressions (release_id, created_at);
create index if not exists exchange_rotation_impressions_time_idx
  on public.exchange_rotation_impressions (created_at);

alter table public.exchange_rotation_impressions enable row level security;
revoke all on table public.exchange_rotation_impressions from anon, authenticated;
grant all on table public.exchange_rotation_impressions to service_role;

-- Exchange metrics are daily aggregates only. No user, email, query string,
-- ownership, or payment fields are stored.
create table if not exists public.exchange_analytics (
  event_day date not null default current_date,
  event_key text not null,
  event text not null check (event in (
    'exchange_viewed', 'rotation_window_viewed', 'release_impression',
    'appreciation_added', 'appreciation_removed', 'search_performed',
    'search_result_opened', 'release_explored', 'collector_market_opened',
    'collector_market_closed', 'collector_listing_viewed'
  )),
  release_id uuid references public.releases(id) on delete set null,
  event_count bigint not null default 1 check (event_count >= 1),
  updated_at timestamptz not null default now(),
  primary key (event_day, event_key)
);

create index if not exists exchange_analytics_release_idx
  on public.exchange_analytics (release_id);

alter table public.exchange_analytics enable row level security;
revoke all on table public.exchange_analytics from anon, authenticated;
grant all on table public.exchange_analytics to service_role;

-- Service-only aggregate readers; SECURITY INVOKER keeps the caller's table
-- grants and RLS in force. The app server invokes these using service_role.
create or replace function public.exchange_appreciation_counts(p_release_ids uuid[])
returns table (release_id uuid, appreciation_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select requested.release_id, count(a.user_id)::bigint
  from unnest(coalesce(p_release_ids, array[]::uuid[])) as requested(release_id)
  left join public.release_appreciations a
    on a.release_id = requested.release_id and a.appreciated = true
  group by requested.release_id;
$$;

revoke all on function public.exchange_appreciation_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.exchange_appreciation_counts(uuid[]) to service_role;

create or replace function public.exchange_recent_impression_counts(
  p_since timestamptz,
  p_before timestamptz
)
returns table (release_id uuid, impression_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.release_id, count(*)::bigint
  from public.exchange_rotation_impressions i
  where i.created_at >= p_since and i.created_at < p_before
  group by i.release_id;
$$;

revoke all on function public.exchange_recent_impression_counts(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.exchange_recent_impression_counts(timestamptz, timestamptz) to service_role;

create or replace function public.record_exchange_impressions(
  p_window_id text,
  p_visitor_hash text,
  p_release_ids uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_ids uuid[];
  inserted_count integer;
  release uuid;
  today date := current_date;
begin
  if p_window_id is null
     or p_visitor_hash is null
     or p_release_ids is null
     or p_window_id !~ '^[0-9]+-[0-9]{17}$'
     or p_visitor_hash !~ '^[0-9a-f]{64}$'
     or coalesce(cardinality(p_release_ids), 0) > 20 then
    raise exception 'invalid Exchange impression batch' using errcode = '22023';
  end if;

  with inserted as (
    insert into public.exchange_rotation_impressions (window_id, release_id, visitor_hash)
    select p_window_id, candidate.release_id, p_visitor_hash
    from (select distinct unnest(coalesce(p_release_ids, array[]::uuid[])) as release_id) candidate
    join public.releases r on r.id = candidate.release_id
    where r.status = 'published'
      and r.visibility = 'public'
      and r.withdrawn_at is null
      and r.slug is not null
      and r.artist_slug is not null
    on conflict (window_id, release_id, visitor_hash) do nothing
    returning release_id
  )
  select coalesce(array_agg(inserted.release_id), array[]::uuid[]), count(*)::integer
    into inserted_ids, inserted_count
  from inserted;

  foreach release in array inserted_ids loop
    insert into public.exchange_analytics (event_day, event_key, event, release_id, event_count)
    values (today, 'release_impression:' || release::text, 'release_impression', release, 1)
    on conflict (event_day, event_key) do update
      set event_count = public.exchange_analytics.event_count + 1,
          updated_at = now();
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.record_exchange_impressions(text, text, uuid[]) from public, anon, authenticated;
grant execute on function public.record_exchange_impressions(text, text, uuid[]) to service_role;

create or replace function public.record_exchange_analytics(p_events jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  event_name text;
  release uuid;
  event_key_value text;
  written integer := 0;
  today date := current_date;
begin
  if jsonb_typeof(p_events) is distinct from 'array' then
    raise exception 'invalid Exchange analytics batch' using errcode = '22023';
  end if;
  if jsonb_array_length(p_events) > 40 then
    raise exception 'invalid Exchange analytics batch' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_events) as entries(value) loop
    event_name := item ->> 'event';
    if event_name is null or event_name not in (
      'exchange_viewed', 'rotation_window_viewed', 'release_impression',
      'appreciation_added', 'appreciation_removed', 'search_performed',
      'search_result_opened', 'release_explored', 'collector_market_opened',
      'collector_market_closed', 'collector_listing_viewed'
    ) then
      continue;
    end if;

    release := null;
    if coalesce(item ->> 'release_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      release := (item ->> 'release_id')::uuid;
      if not exists (
        select 1 from public.releases r
        where r.id = release
          and r.status = 'published'
          and r.visibility = 'public'
          and r.withdrawn_at is null
      ) then
        continue;
      end if;
    end if;

    event_key_value := event_name || ':' || coalesce(release::text, 'global');
    insert into public.exchange_analytics (event_day, event_key, event, release_id, event_count)
    values (today, event_key_value, event_name, release, 1)
    on conflict (event_day, event_key) do update
      set event_count = public.exchange_analytics.event_count + 1,
          updated_at = now();
    written := written + 1;
  end loop;

  return written;
end;
$$;

revoke all on function public.record_exchange_analytics(jsonb) from public, anon, authenticated;
grant execute on function public.record_exchange_analytics(jsonb) to service_role;

-- Migration ledger footer follows the repository's reviewed SQL convention.
create table if not exists public.schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
grant select, insert, update on public.schema_migrations to service_role;
insert into public.schema_migrations (filename)
values ('exchange-rotation-2026-10-24.sql')
on conflict (filename) do nothing;
