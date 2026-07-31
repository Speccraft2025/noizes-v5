import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export async function load({ locals }) {
  const sb = locals.supabase;

  const { data: releases } = await sb
    .from('releases')
    .select('id, artist_name, title, genre, year, location, edition_type, edition_size, price, currency, acquired_count, votes, cover_path, status')
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
    .select('id, edition_number, currency, releases(id, artist_name, title, edition_type, edition_size, cover_path)')
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
    edition_type: row.releases?.edition_type ?? '',
    edition_size: row.releases?.edition_size ?? null,
  }));

  return { featured, feed: all, resale };
}
