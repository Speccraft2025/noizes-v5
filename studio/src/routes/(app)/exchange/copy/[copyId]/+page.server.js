import { error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function load({ params }) {
  if (!UUID_RE.test(params.copyId || '')) throw error(400, 'Invalid copy identifier');
  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: copy, error: copyError } = await admin
    .from('acquisitions')
    .select('id, edition_number, price_paid, currency, acquired_at, accepting_offers, releases(id, artist_name, title, description, edition_type, edition_name, edition_size, cover_path, artist_slug, slug)')
    .eq('id', params.copyId).maybeSingle();
  if (copyError) throw error(500, 'Could not load this authenticated copy');
  if (!copy) throw error(404, 'Authenticated copy not found');
  const { data: events } = await admin.from('provenance_events').select('id, kind, occurred_at, seq, content_hash, signature, price, currency').eq('acquisition_id', copy.id).order('seq', { ascending: true });
  return { copy: { ...copy, cover_url: copy.releases?.cover_path ? admin.storage.from('releases').getPublicUrl(copy.releases.cover_path).data?.publicUrl ?? null : null }, events: events ?? [] };
}
