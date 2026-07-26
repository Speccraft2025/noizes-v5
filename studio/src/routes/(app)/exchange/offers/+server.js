import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { SUPPORTED_CURRENCIES } from '$lib/server/paystack.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Place a resale offer on a specific edition. No money moves here — an offer is
// a non-binding bid the current custodian may accept. Payment happens only
// after acceptance, via /exchange/offers/pay.
export async function POST({ request, locals }) {
  if (!locals.user) throw error(401, 'Log in to make an offer');

  let body;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Request body must be JSON');
  }
  const acquisitionId = body?.acquisition_id;
  const amount = Number(body?.amount);
  if (!UUID_RE.test(acquisitionId || '')) throw error(400, 'acquisition_id must be a uuid');
  if (!Number.isFinite(amount) || amount <= 0) throw error(400, 'amount must be a positive number');

  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: acq } = await admin
    .from('acquisitions')
    .select('id, owner_id, release_id, accepting_offers, currency')
    .eq('id', acquisitionId)
    .maybeSingle();
  if (!acq) throw error(404, 'Edition not found');
  if (acq.owner_id === locals.user.id) throw error(400, 'You already hold this edition');
  if (!acq.accepting_offers) throw error(409, 'This edition is not accepting offers');
  if (!SUPPORTED_CURRENCIES.includes(acq.currency)) throw error(400, `Offers in ${acq.currency} are not supported yet`);

  // Write under the caller's session so RLS binds offerer_id = auth.uid().
  // Re-offering updates the existing active bid (the partial unique index only
  // permits one active offer per offerer per edition).
  const sb = locals.supabase;
  const { data: existing } = await sb
    .from('offers')
    .select('id')
    .eq('acquisition_id', acquisitionId)
    .eq('offerer_id', locals.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) {
    const { error: updErr } = await sb.from('offers').update({ amount }).eq('id', existing.id);
    if (updErr) throw error(500, `Could not update offer: ${updErr.message}`);
  } else {
    const { error: insErr } = await sb.from('offers').insert({
      acquisition_id: acquisitionId,
      release_id: acq.release_id,
      offerer_id: locals.user.id,
      amount,
      currency: acq.currency,
      status: 'active',
    });
    if (insErr) throw error(500, `Could not place offer: ${insErr.message}`);
  }

  return json({ ok: true });
}
