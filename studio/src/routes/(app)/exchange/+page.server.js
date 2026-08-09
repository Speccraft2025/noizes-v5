import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

import { firstLoadError } from '$lib/domain/load-errors.js';

export async function load({ locals }) {
  const sb = locals.supabase;

  const { data: releases, error: releasesError } = await sb
    .from('releases')
    .select(`
      id, artist_name, title, genre, year, location,
      release_type, track_count, disc_count, total_duration_ms,
      featured_artists, compilation_artists, explicit, package_size,
      edition_type, edition_name, edition_size, price, currency,
      acquired_count, votes, cover_path, status, slug, artist_slug, visibility,
      tracks (id, position, disc_number, track_number, title, primary_artist, featured_artists, explicit, hidden)
    `)
    .eq('status', 'published')
    // Unlisted releases are published and reachable by their link; keeping
    // them off the shelves is the whole meaning of the setting.
    .eq('visibility', 'public')
    .order('votes', { ascending: false });

  // A swallowed error here rendered as "No releases yet", which is a lie the
  // page told confidently: the releases exist, the query just failed.
  if (releasesError) console.error('[exchange] release listing failed:', releasesError);

  const all = releases ?? [];
  const featured = all.slice(0, 8).map((release) => ({
    ...release,
    cover_url: release.cover_path
      ? sb.storage.from('releases').getPublicUrl(release.cover_path).data?.publicUrl ?? null
      : null,
  }));

  // Discovery is intentionally assembled server-side with a service client:
  // acquisitions remain private under RLS and only these safe listing fields
  // are serialized to buyers.
  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: resaleRows, error: resaleError } = await admin
    .from('acquisitions')
    .select('id, edition_number, currency, releases(id, artist_name, title, release_type, track_count, disc_count, edition_type, edition_name, edition_size, cover_path, slug, artist_slug)')
    .eq('accepting_offers', true)
    .order('acquired_at', { ascending: false })
    .limit(50);
  const resale = (resaleRows ?? []).map((row) => ({
    acquisition_id: row.id,
    edition_number: row.edition_number,
    currency: row.currency,
    release_id: row.releases?.id,
    artist_name: row.releases?.artist_name ?? '',
    title: row.releases?.title ?? '',
    release_type: row.releases?.release_type ?? 'single',
    track_count: row.releases?.track_count ?? 0,
    disc_count: row.releases?.disc_count ?? 1,
    edition_type: row.releases?.edition_type ?? '',
    edition_name: row.releases?.edition_name ?? '',
    edition_size: row.releases?.edition_size ?? null,
    drop_path: row.releases?.artist_slug && row.releases?.slug
      ? `/drop/${row.releases.artist_slug}/${row.releases.slug}`
      : null,
  }));

  if (resaleError) console.error('[exchange] resale listing failed:', resaleError);

  // The main listing is what the page is for, so its failure is reported
  // first; resale is a secondary shelf but must not fail silently either.
  return {
    featured,
    feed: all,
    resale,
    loadError: firstLoadError([releasesError, resaleError], { subject: 'catalogue' }),
  };
}
