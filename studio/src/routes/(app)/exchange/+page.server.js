import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { firstLoadError } from '$lib/domain/load-errors.js';

function publicCover(sb, release) {
  return release?.cover_path
    ? sb.storage.from('releases').getPublicUrl(release.cover_path).data?.publicUrl ?? null
    : null;
}

export async function load({ locals, url }) {
  const sb = locals.supabase;
  const query = String(url.searchParams.get('q') || '').trim().toLowerCase();
  const selectedFilter = url.searchParams.get('filter') || 'new';
  const { data: releases, error: releasesError } = await sb
    .from('releases')
    .select('id, artist_name, title, description, genre, year, location, release_type, track_count, total_duration_ms, edition_type, edition_name, edition_size, price, currency, acquired_count, cover_path, slug, artist_slug, visibility, status, created_at')
    .eq('status', 'published').eq('visibility', 'public').order('created_at', { ascending: false });

  if (releasesError) console.error('[exchange] release listing failed:', releasesError);
  let catalogue = (releases ?? []).map((release) => ({ ...release, cover_url: publicCover(sb, release) }));
  if (query) catalogue = catalogue.filter((r) => `${r.title} ${r.artist_name} ${r.edition_name ?? ''}`.toLowerCase().includes(query));
  if (selectedFilter === 'limited') catalogue = catalogue.filter((r) => r.edition_size != null);
  if (selectedFilter === 'open') catalogue = catalogue.filter((r) => r.edition_size == null);
  if (selectedFilter === 'kenya') catalogue = catalogue.filter((r) => /kenya/i.test(r.location ?? ''));

  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: resaleRows, error: resaleError } = await admin
    .from('acquisitions')
    .select('id, edition_number, price_paid, currency, acquired_at, releases(id, artist_name, title, edition_type, edition_name, edition_size, cover_path, slug, artist_slug)')
    .eq('accepting_offers', true).order('acquired_at', { ascending: false }).limit(12);
  const market = (resaleRows ?? []).map((copy) => {
    const release = copy.releases ?? {};
    return { copy_id: copy.id, serial: copy.edition_number, ask: copy.price_paid, currency: copy.currency, listed_at: copy.acquired_at, ...release, cover_url: publicCover(sb, release), href: `/exchange/copy/${copy.id}` };
  });

  const { data: events, error: eventsError } = await admin
    .from('provenance_events')
    .select('id, release_id, edition_number, kind, occurred_at, acquisition_id, releases(title, artist_name, cover_path)')
    .order('occurred_at', { ascending: false }).limit(6);
  const activity = (events ?? []).map((event) => ({ ...event, title: event.releases?.title ?? 'Authenticated edition', artist: event.releases?.artist_name ?? 'Noizes artist', cover_url: publicCover(sb, event.releases) }));

  return { catalogue, featured: catalogue[0] ?? null, market, activity, query, selectedFilter, loadError: firstLoadError([releasesError, resaleError, eventsError], { subject: 'Exchange' }) };
}
