-- Launch security hardening. Idempotent and safe to run after supabase_schema.sql
-- and provenance-resale-2026-07-26.sql.

-- Profiles contain email and KYC fields. RLS is row-based, so a public SELECT
-- policy exposes every column; only the owner may read their profile directly.
drop policy if exists "Profiles are publicly readable" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select
  to authenticated using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert
  to authenticated with check ((select auth.uid()) = id);

-- Auth metadata is user-editable. Assign authorization roles exclusively from
-- the service-managed invite table.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce((select i.role from public.invites i where i.email = lower(new.email)), 'collector')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Waitlist addresses are administrative data, never an authenticated-user list.
drop policy if exists "Authenticated users can read waitlist" on public.waitlist;

-- Prevent callers from changing server-controlled offer fields through the
-- otherwise legitimate amount/withdraw update policy.
create or replace function public.protect_offer_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and (select auth.jwt()->>'role') <> 'service_role' then
    new.acquisition_id := old.acquisition_id;
    new.release_id := old.release_id;
    new.offerer_id := old.offerer_id;
    new.currency := old.currency;
    if old.status <> 'active' or new.status not in ('active', 'withdrawn') then
      raise exception 'offer status transition is not allowed';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_offer_columns() from public, anon, authenticated;
drop trigger if exists protect_offer_columns on public.offers;
create trigger protect_offer_columns before update on public.offers
  for each row execute function public.protect_offer_columns();

-- Authors may edit note text, but cannot move a note to another acquisition,
-- impersonate an author, or self-moderate its visibility state.
create or replace function public.protect_collector_note_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and (select auth.jwt()->>'role') <> 'service_role' then
    new.acquisition_id := old.acquisition_id;
    new.author_id := old.author_id;
    new.status := old.status;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_collector_note_columns() from public, anon, authenticated;
drop trigger if exists protect_collector_note_columns on public.collector_notes;
create trigger protect_collector_note_columns before update on public.collector_notes
  for each row execute function public.protect_collector_note_columns();

-- Fast operational queue for same-day payment reconciliation.
create index if not exists payment_intents_reconciliation_idx
  on public.payment_intents (status, created_at)
  where status in ('pending', 'needs_reconciliation');

-- Explicitly remove accidental table privileges. The service role bypasses RLS;
-- authenticated clients retain only the operations backed by policies.
revoke select on public.waitlist from authenticated;
