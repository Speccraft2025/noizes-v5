-- Keep the indexes used by appreciation counts and recent exposure scans. The
-- row/time composite and analytics lookup indexes have no current read path.
drop index if exists public.exchange_rotation_impressions_release_time_idx;
drop index if exists public.exchange_analytics_release_idx;

insert into public.schema_migrations (filename)
values ('exchange-rotation-index-tuning-2026-10-24.sql')
on conflict (filename) do update set applied_at = now();
