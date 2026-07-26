// Resale fulfillment — the paid custody change that runs when a buyer completes
// payment on an accepted offer. Mirrors fulfillAcquisition's contract:
// idempotent, safe to call from both the webhook (source of truth) and the
// confirm page. Reuses transferCustody so the provenance chain and note-folding
// are identical to a gift transfer, just with a price attached.

import { transferCustody, TransferError } from './transfer.js';

// Artist royalty on resale, as a fraction. Matches the primary-sale artist
// share (85%) documented in the content strategy. v1 records the split for
// manual payout (same policy as primary sales in TODOS.md); it does not move
// money automatically.
export const RESALE_ROYALTY_RATE = 0.85;

export function royaltySplit(amount, rate = RESALE_ROYALTY_RATE) {
  const gross = Number(amount) || 0;
  const artist = Math.round(gross * rate * 100) / 100;
  const platform = Math.round((gross - artist) * 100) / 100;
  return { artist, platform };
}

// intent: a payment_intents row (kind 'resale') whose payment is CONFIRMED by
// the caller. Must carry acquisition_id, seller_id, buyer_id, offer_id.
// Returns { transferred: true } on success (or prior success / idempotent),
// { stale: true } when the edition already moved on (needs manual refund).
export async function fulfillResale(sb, intent) {
  const { data: acq } = await sb
    .from('acquisitions')
    .select('id, owner_id, release_id, edition_number')
    .eq('id', intent.acquisition_id)
    .maybeSingle();

  if (!acq) {
    console.error(`[resale] PAID BUT EDITION GONE — reference=${intent.reference}. Needs manual refund.`);
    await sb.from('payment_intents').update({ status: 'needs_reconciliation' }).eq('reference', intent.reference);
    return { stale: true };
  }

  // Idempotency: if the buyer already owns it, a prior fulfillment won.
  if (acq.owner_id === intent.buyer_id) {
    await sb.from('payment_intents').update({ status: 'succeeded' }).eq('reference', intent.reference);
    return { transferred: true };
  }

  try {
    await transferCustody(sb, {
      acquisitionId: intent.acquisition_id,
      expectedFromOwnerId: intent.seller_id,
      toOwnerId: intent.buyer_id,
      price: intent.amount_subunits / 100,
      currency: intent.currency,
    });
  } catch (e) {
    if (e instanceof TransferError && (e.code === 'not_owner' || e.code === 'not_found')) {
      // Seller sold/transferred it elsewhere between accept and pay. Paid but
      // undeliverable — flag for manual refund rather than force a transfer.
      console.error(`[resale] PAID BUT SELLER NO LONGER OWNS — reference=${intent.reference}: ${e.message}`);
      await sb.from('payment_intents').update({ status: 'needs_reconciliation' }).eq('reference', intent.reference);
      return { stale: true };
    }
    throw e; // real error → let the webhook 5xx and retry
  }

  const split = royaltySplit(intent.amount_subunits / 100);
  await sb.from('offers').update({ status: 'accepted' }).eq('id', intent.offer_id);
  await sb
    .from('payment_intents')
    .update({ status: 'succeeded', paystack_data: { royalty: split } })
    .eq('reference', intent.reference);

  console.log(`[resale] transferred ${intent.acquisition_id} → ${intent.buyer_id}; artist royalty ${split.artist} ${intent.currency} (manual payout)`);
  return { transferred: true };
}
