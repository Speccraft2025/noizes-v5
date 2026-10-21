import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export async function load({ url }) {
  const filter = url.searchParams.get('filter') || 'all';
  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let request = admin.from('provenance_events').select('id, release_id, edition_number, acquisition_id, kind, occurred_at, recorded_at, content_hash, signature, releases(title, artist_name, edition_name, edition_size, cover_path)').order('occurred_at', { ascending: false }).limit(80);
  if (filter === 'transfers') request = request.in('kind', ['transferred', 'gifted', 'inherited', 'donated']);
  if (filter === 'issuance') request = request.in('kind', ['created', 'published', 'issued', 'acquired']);
  if (filter === 'market') request = request.in('kind', ['listing_opened', 'offer_accepted']);
  if (filter === 'verification') request = request.eq('kind', 'verified');
  const { data, error } = await request;
  return { events: data ?? [], filter, error: error?.message ?? null };
}
