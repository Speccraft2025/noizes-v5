import { json, error } from '@sveltejs/kit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Offerer withdraws their own active offer. RLS restricts the update to the
// offerer's own rows.
export async function POST({ request, locals }) {
  if (!locals.user) throw error(401, 'Log in');
  let body;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Request body must be JSON');
  }
  const offerId = body?.offer_id;
  if (!UUID_RE.test(offerId || '')) throw error(400, 'offer_id must be a uuid');

  const { data, error: upErr } = await locals.supabase
    .from('offers')
    .update({ status: 'withdrawn' })
    .eq('id', offerId)
    .eq('offerer_id', locals.user.id)
    .eq('status', 'active')
    .select('id')
    .maybeSingle();
  if (upErr) throw error(500, 'Could not withdraw');
  if (!data) throw error(409, 'Offer is no longer active');
  return json({ ok: true });
}
