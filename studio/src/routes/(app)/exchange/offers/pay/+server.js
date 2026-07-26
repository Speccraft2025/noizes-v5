import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY, PAYSTACK_SECRET_KEY } from '$env/static/private';
import { makeReference, toSubunits, initializeTransaction, SUPPORTED_CURRENCIES } from '$lib/server/paystack.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Offerer completes payment on an ACCEPTED offer. Records a resale
// payment_intent and returns a Paystack checkout URL. Custody flips only when
// the webhook confirms payment (fulfillResale) — the source of truth, exactly
// like a primary sale.
export async function POST({ request, locals, url }) {
  if (!locals.user) throw error(401, 'Log in to pay');
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
    .select('id, status, amount, currency, offerer_id, acquisition_id, release_id, acquisitions ( owner_id )')
    .eq('id', offerId)
    .maybeSingle();
  if (!offer) throw error(404, 'Offer not found');
  if (offer.offerer_id !== locals.user.id) throw error(403, 'This is not your offer');
  if (offer.status !== 'accepted') throw error(409, 'Offer has not been accepted');

  const sellerId = offer.acquisitions?.owner_id;
  if (!sellerId || sellerId === locals.user.id) throw error(409, 'This edition is no longer available to you');
  if (!SUPPORTED_CURRENCIES.includes(offer.currency)) throw error(400, `Payments in ${offer.currency} are not supported yet`);

  const amount = toSubunits(offer.amount, offer.currency);
  if (amount === 0) throw error(400, 'Invalid offer amount');

  const reference = makeReference();
  const { error: intentErr } = await sb.from('payment_intents').insert({
    reference,
    kind: 'resale',
    release_id: offer.release_id,
    acquisition_id: offer.acquisition_id,
    offer_id: offer.id,
    seller_id: sellerId,
    buyer_id: locals.user.id,
    amount_subunits: amount,
    currency: offer.currency,
  });
  if (intentErr) throw error(500, `Could not start payment: ${intentErr.message}`);

  let tx;
  try {
    tx = await initializeTransaction(PAYSTACK_SECRET_KEY, {
      email: locals.user.email,
      amount,
      currency: offer.currency,
      reference,
      callback_url: `${url.origin}/exchange/acquire/confirm`,
      metadata: { kind: 'resale', offer_id: offer.id, acquisition_id: offer.acquisition_id },
    });
  } catch (e) {
    await sb.from('payment_intents').update({ status: 'failed' }).eq('reference', reference);
    console.error(`[resale] Paystack init failed for ${reference}: ${e.message}`);
    throw error(502, 'Payment provider unavailable — try again shortly');
  }

  return json({ authorization_url: tx.authorization_url, reference });
}
