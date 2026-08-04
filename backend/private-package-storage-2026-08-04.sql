-- ══════════════════════════════════════════════════════════════════════════
-- PRIVATE PACKAGE STORAGE
-- ══════════════════════════════════════════════════════════════════════════
-- .nz packages were stored in the public `releases` bucket. Every entitlement
-- check in the application — the owner-only collection download, the Drop Page
-- download gate, the paid-acquisition flow — sat in front of bytes that were
-- already reachable without any of them:
--
--   GET /storage/v1/object/public/releases/<artist_id>/<release_id>/package.nz
--     → 200, 9.5 MB, no authentication
--
-- The path is two UUIDs, and the release id is printed on the public Drop Page
-- as "Noizes Release ID". A 403 in front of a public URL is decoration.
--
-- The fix is a boundary, not a flag: promotional artwork and the paid good are
-- different things and belong in different buckets.
--
--   releases          stays PUBLIC — cover artwork only. og:image is fetched by
--                     WhatsApp/X crawlers long after any signed URL expires, so
--                     making covers private would break every shared link.
--   release-packages  PRIVATE — .nz packages. Reachable only through a signed
--                     URL minted by an endpoint that checked entitlement first.
--
-- Objects are moved by scripts/migrate-package-storage.mjs, which verifies a
-- sha256 match before deleting anything. Run this script FIRST so the bucket
-- exists.
--
-- Idempotent: safe to re-run.
-- ══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('release-packages', 'release-packages', false)
on conflict (id) do update set public = false;

-- No storage.objects policies are created for this bucket, and that is
-- deliberate. Every read goes through the service role, which bypasses RLS, in
-- an endpoint that has already established the caller is entitled. Granting
-- authenticated users a direct SELECT here would recreate the hole one layer
-- down: any logged-in account could then fetch any package.
--
-- Uploads use signed upload URLs minted server-side (see
-- /studio/publish/upload-urls), so creators never need a policy either.

-- Belt and braces: if a policy was ever added by hand, this removes the
-- obvious mistake of a blanket public read on the new bucket.
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Public read release-packages'
  ) then
    drop policy "Public read release-packages" on storage.objects;
  end if;
end $$;

-- ── Migration ledger ─────────────────────────────────────────────────────
create table if not exists public.schema_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
grant select, insert, update on public.schema_migrations to service_role;

insert into public.schema_migrations (filename) values ('private-package-storage-2026-08-04.sql')
  on conflict (filename) do update set applied_at = now();
