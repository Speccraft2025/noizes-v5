import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY, PAYSTACK_SECRET_KEY } from '$env/static/private';
import { makeReference, toSubunits, initializeTransaction, SUPPORTED_CURRENCIES } from '$lib/server/paystack.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Starts an acquisition: records a payment_intents row, initializes a
// Paystack transaction, and hands the browser the checkout URL. Fulfillment
// happens in ./webhook (source of truth) and ./confirm (immediate UX).
export async function POST({ request, locals, url }) {
  if (!locals.user) throw error(401, 'Log in to acquire');

  let body;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Request body must be JSON');
  }
  const releaseId = body?.release_id;
  if (!UUID_RE.test(releaseId || '')) throw error(400, 'release_id must be a uuid');

  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: release, error: relErr } = await sb
    .from('releases')
    .select('id, title, price, currency, edition_size, acquired_count, status')
    .eq('id', releaseId)
    .eq('status', 'published')
    .maybeSingle();
  if (relErr) throw error(500, `Release lookup failed: ${relErr.message}`);
  if (!release) throw error(404, 'Release not found');

  // Pre-check only — the authoritative sellout handling is in fulfillment,
  // which re-reads counts and retries edition numbers.
  if (release.edition_size != null && release.acquired_count >= release.edition_size) {
    throw error(409, 'Sold out');
  }

  if (!SUPPORTED_CURRENCIES.includes(release.currency)) {
    throw error(400, `Payments in ${release.currency} are not supported yet`);
  }
  const amount = toSubunits(release.price, release.currency);
  if (amount === 0) throw error(400, 'This release is not purchasable');

  const reference = makeReference();

  const { error: intentErr } = await sb.from('payment_intents').insert({
    reference,
    release_id: release.id,
    buyer_id: locals.user.id,
    amount_subunits: amount,
    currency: release.currency,
  });
  if (intentErr) throw error(500, `Could not start payment: ${intentErr.message}`);

  let tx;
  try {
    tx = await initializeTransaction(PAYSTACK_SECRET_KEY, {
      email: locals.user.email,
      amount,
      currency: release.currency,
      reference,
      callback_url: `${url.origin}/exchange/acquire/confirm`,
      metadata: { release_id: release.id, buyer_id: locals.user.id, release_title: release.title },
    });
  } catch (e) {
    await sb.from('payment_intents').update({ status: 'failed' }).eq('reference', reference);
    console.error(`[acquire] Paystack init failed for ${reference}: ${e.message}`);
    throw error(502, 'Payment provider unavailable — try again shortly');
  }

  return json({ authorization_url: tx.authorization_url, reference });
}
