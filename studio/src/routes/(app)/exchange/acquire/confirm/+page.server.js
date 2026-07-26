import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY, PAYSTACK_SECRET_KEY } from '$env/static/private';
import { verifyTransaction } from '$lib/server/paystack.js';
import { fulfillAcquisition } from '$lib/server/acquire.js';
import { fulfillResale } from '$lib/server/resale.js';

const REFERENCE_RE = /^nz_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Paystack redirects here after checkout (?reference=nz_<uuid>). This page
// gives immediate UX via the Verify API; the webhook is the source of truth,
// so any doubt here resolves to 'pending' — the webhook will still fulfill.
export async function load({ url, locals }) {
  const reference = url.searchParams.get('reference') || url.searchParams.get('trxref') || '';
  if (!REFERENCE_RE.test(reference)) return { state: 'failed', release: null };

  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: intent } = await sb
    .from('payment_intents')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  // Unknown reference, or viewer isn't the buyer (also covers cookie-less
  // returns from in-app browsers): show a generic pending state, leak nothing.
  if (!intent || intent.buyer_id !== locals.user?.id) {
    return { state: 'pending', release: null };
  }

  const { data: release } = await sb
    .from('releases')
    .select('id, title, artist_name, edition_size')
    .eq('id', intent.release_id)
    .maybeSingle();

  let verified;
  try {
    verified = await verifyTransaction(PAYSTACK_SECRET_KEY, reference);
  } catch (e) {
    console.error(`[confirm] verify failed for ${reference}: ${e.message}`);
    return { state: 'pending', release };
  }

  if (verified.status === 'success') {
    // Cross-check the charge against our quote, same as the webhook.
    if (verified.amount !== intent.amount_subunits || verified.currency !== intent.currency) {
      console.error(`[confirm] amount/currency mismatch for ${reference}`);
      return { state: 'pending', release };
    }
    try {
      // Resale returns here too; custody flip is idempotent with the webhook.
      if (intent.kind === 'resale') {
        const result = await fulfillResale(sb, intent);
        if (result.stale) return { state: 'pending', release };
        return { state: 'success', release, resale: true };
      }
      const result = await fulfillAcquisition(sb, intent);
      if (result.soldOut) return { state: 'sold_out', release };
      // Release deleted after payment — flagged for manual refund; show the
      // generic processing state rather than a misleading "sold out".
      if (result.orphaned) return { state: 'pending', release };
      return {
        state: 'success',
        release,
        edition_number: result.acquisition.edition_number,
      };
    } catch (e) {
      console.error(`[confirm] fulfillment failed for ${reference}: ${e.message}`);
      return { state: 'pending', release }; // webhook will retry-fulfill
    }
  }

  if (verified.status === 'failed') {
    await sb.from('payment_intents').update({ status: 'failed' }).eq('reference', reference);
    return { state: 'failed', release };
  }

  // abandoned / ongoing / pending / anything else
  return { state: 'pending', release };
}
