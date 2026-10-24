-- Make the server-only access boundary explicit for the Exchange's internal
-- rotation and aggregate tables. Client roles retain no table privileges.

drop policy if exists "Service role manages Exchange rotation snapshots"
  on public.exchange_rotation_snapshots;
create policy "Service role manages Exchange rotation snapshots"
  on public.exchange_rotation_snapshots for all to service_role
  using (true) with check (true);

drop policy if exists "Service role manages Exchange rotation impressions"
  on public.exchange_rotation_impressions;
create policy "Service role manages Exchange rotation impressions"
  on public.exchange_rotation_impressions for all to service_role
  using (true) with check (true);

drop policy if exists "Service role manages Exchange analytics"
  on public.exchange_analytics;
create policy "Service role manages Exchange analytics"
  on public.exchange_analytics for all to service_role
  using (true) with check (true);

insert into public.schema_migrations (filename)
values ('exchange-rotation-service-policies-2026-10-24.sql')
on conflict (filename) do update set applied_at = now();
