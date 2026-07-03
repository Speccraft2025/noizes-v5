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
  if not exists (select 1 from pg_policies where tablename='acquisitions' and policyname='Authenticated users can acquire') then
    create policy "Authenticated users can acquire" on public.acquisitions for insert with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='acquisitions' and policyname='Owners can update own acquisitions') then
    create policy "Owners can update own acquisitions" on public.acquisitions for update using (owner_id = auth.uid());
  end if;
end $$;

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
-- STORAGE BUCKET
-- ══════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('releases', 'releases', true)
on conflict (id) do nothing;

-- ══════════════════════════════════════════════
-- ADMIN — set your account
-- ══════════════════════════════════════════════
update public.profiles set is_admin = true where email = 'jayzelisaac@gmail.com';
