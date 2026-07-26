import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY, PAYSTACK_SECRET_KEY } from '$env/static/private';
import { verifyPaystackSignature } from '$lib/server/paystack.js';
import { fulfillAcquisition } from '$lib/server/acquire.js';
import { fulfillResale } from '$lib/server/resale.js';

// Paystack webhook — the source of truth for payment success. Unauthenticated
// (no session): trust comes from the HMAC signature over the raw body.
// Response codes matter: 2xx acknowledges; 5xx makes Paystack retry (safe —
// fulfillment is idempotent on payment_reference); never 4xx a reference we
// simply don't recognize or Paystack retries it forever.
export async function POST({ request }) {
  // Signature is over the raw bytes — read text BEFORE parsing.
  const raw = await request.text();
  const signature = request.headers.get('x-paystack-signature');
  if (!verifyPaystackSignature(raw, signature, PAYSTACK_SECRET_KEY)) {
    console.error('[webhook] invalid Paystack signature');
    return json({ error: 'invalid signature' }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: 'malformed body' }, { status: 400 });
  }

  if (event?.event !== 'charge.success') {
    return json({ received: true });
  }

  const data = event.data || {};
  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: intent } = await sb
    .from('payment_intents')
    .select('*')
    .eq('reference', data.reference || '')
    .maybeSingle();
  if (!intent) {
    console.error(`[webhook] charge.success for unknown reference ${data.reference}`);
    return json({ received: true });
  }

  // Defense against replay/tamper even with a valid signature envelope:
  // the charge must match what we quoted at init.
  if (data.amount !== intent.amount_subunits || data.currency !== intent.currency) {
    console.error(
      `[webhook] amount/currency mismatch for ${intent.reference}: got ${data.amount} ${data.currency}, expected ${intent.amount_subunits} ${intent.currency}`
    );
    await sb
      .from('payment_intents')
      .update({ status: 'needs_reconciliation', paystack_data: { amount: data.amount, currency: data.currency, status: data.status } })
      .eq('reference', intent.reference);
    return json({ received: true });
  }

  try {
    // Primary sale vs resale share the same webhook and idempotency contract.
    if (intent.kind === 'resale') {
      await fulfillResale(sb, intent);
    } else {
      await fulfillAcquisition(sb, intent);
      await sb
        .from('payment_intents')
        .update({ paystack_data: { status: data.status, channel: data.channel, paid_at: data.paid_at, amount: data.amount, currency: data.currency } })
        .eq('reference', intent.reference);
    }
  } catch (e) {
    // 5xx → Paystack retries → idempotent re-fulfillment. This is the
    // "insert fails after payment confirmed" retry path from TODOS.md.
    console.error(`[webhook] fulfillment failed for ${intent.reference}: ${e.message}`);
    return json({ error: 'fulfillment failed' }, { status: 500 });
  }

  return json({ received: true });
}
