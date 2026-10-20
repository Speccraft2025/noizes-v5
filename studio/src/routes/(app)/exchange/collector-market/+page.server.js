import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export async function load({ url }) {
  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const sort = url.searchParams.get('sort') || 'recent';
  let query = admin.from('acquisitions').select('id, edition_number, price_paid, currency, acquired_at, releases(id, artist_name, title, edition_type, edition_name, edition_size, cover_path, slug, artist_slug)').eq('accepting_offers', true);
  query = sort === 'price' ? query.order('price_paid', { ascending: true }) : query.order('acquired_at', { ascending: false });
  const { data, error } = await query.limit(48);
  const listings = (data ?? []).map((copy) => ({ ...copy, release: copy.releases, cover_url: copy.releases?.cover_path ? admin.storage.from('releases').getPublicUrl(copy.releases.cover_path).data?.publicUrl ?? null : null }));
  return { listings, sort, error: error?.message ?? null };
}
