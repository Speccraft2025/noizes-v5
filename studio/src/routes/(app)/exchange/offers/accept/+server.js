import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Current custodian accepts an offer. This does NOT move money or custody — it
// marks the offer 'accepted' so the offerer can complete payment. Custody flips
// only on confirmed payment (resale webhook). Owner writes to acquisitions/
// offers go through the service client after an ownership guard.
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

  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: offer } = await sb
    .from('offers')
    .select('id, status, acquisition_id, acquisitions ( owner_id )')
    .eq('id', offerId)
    .maybeSingle();
  if (!offer) throw error(404, 'Offer not found');
  if (offer.acquisitions?.owner_id !== locals.user.id) throw error(403, 'You do not own this edition');
  if (offer.status !== 'active') throw error(409, 'Offer is no longer active');

  // The registry migration performs the ownership, active-listing and
  // competing-offer checks under one row-locking transaction. A conditional
  // UPDATE here used to leave two offers accepted when requests raced.
  const { error: acceptErr } = await sb.rpc('accept_copy_offer', {
    p_offer_id: offerId,
    p_seller_id: locals.user.id,
  });
  if (acceptErr) {
    if (/not active|no longer owns|not found/i.test(acceptErr.message || '')) {
      throw error(409, 'This offer or listing is no longer active');
    }
    console.error(`[offers] atomic accept failed: ${acceptErr.message}`);
    throw error(500, 'Could not accept offer');
  }

  return json({ ok: true });
}
