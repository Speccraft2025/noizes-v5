-- Keep covering indexes for release foreign keys. They also support future
-- release-level analytics and are used by retention and cascade operations.
create index if not exists exchange_rotation_impressions_release_time_idx
  on public.exchange_rotation_impressions (release_id, created_at);
create index if not exists exchange_analytics_release_idx
  on public.exchange_analytics (release_id);

insert into public.schema_migrations (filename)
values ('exchange-rotation-index-coverage-2026-10-24.sql')
on conflict (filename) do update set applied_at = now();
