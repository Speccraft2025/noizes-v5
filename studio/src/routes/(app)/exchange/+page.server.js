import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export async function load({ locals }) {
  const sb = locals.supabase;

  const { data: releases } = await sb
    .from('releases')
    .select(`
      id, artist_name, title, genre, year, location,
      release_type, track_count, disc_count, total_duration_ms,
      featured_artists, compilation_artists, explicit, package_size,
      edition_type, edition_name, edition_size, price, currency,
      acquired_count, votes, cover_path, status,
      tracks (id, position, disc_number, track_number, title, primary_artist, featured_artists, explicit, hidden)
    `)
    .eq('status', 'published')
    .order('votes', { ascending: false });

  const all = releases ?? [];
  const featured = all.slice(0, 3);

  // Discovery is intentionally assembled server-side with a service client:
  // acquisitions remain private under RLS and only these safe listing fields
  // are serialized to buyers.
  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: resaleRows } = await admin
    .from('acquisitions')
    .select('id, edition_number, currency, releases(id, artist_name, title, release_type, track_count, disc_count, edition_type, edition_name, edition_size, cover_path)')
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
  }));

  return { featured, feed: all, resale };
}
