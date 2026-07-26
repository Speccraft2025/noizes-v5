// Idempotent fulfillment of a paid acquisition. Called by BOTH the webhook
// (source of truth) and the confirm page (immediate UX) — whichever runs
// second finds the existing row by payment_reference and no-ops.
//
// Never touches releases.acquired_count: the on_acquisition_created DB
// trigger increments it on insert.

// How many consecutive edition numbers to try before giving up. Bounds the
// unique-constraint retry loop when concurrent buyers race for numbers.
export const MAX_EDITION_ATTEMPTS = 5;

// Emits the first two links of an edition's provenance chain on primary sale:
// seq 0 'created' (minted by the artist) and seq 1 'acquired' (to the buyer).
// Called only after a winning insert, so duplicate webhooks never double-emit.
async function openProvenanceChain(sb, { release, acquisition, intent }) {
  const { appendEvent } = await import('./provenance.js');
  const editionNumber = acquisition.edition_number;
  await appendEvent(sb, {
    releaseId: release.id,
    editionNumber,
    kind: 'created',
    toOwnerId: release.artist_id ?? null,
    acquisitionId: acquisition.id,
  });
  await appendEvent(sb, {
    releaseId: release.id,
    editionNumber,
    kind: 'acquired',
    fromOwnerId: release.artist_id ?? null,
    toOwnerId: intent.buyer_id,
    acquisitionId: acquisition.id,
    price: acquisition.price_paid,
    currency: acquisition.currency,
  });
}

// Candidate edition numbers to attempt, in order.
// Open edition (editionSize null/undefined): unnumbered → [null].
// Limited edition: next numbers after acquiredCount, capped at editionSize
// and MAX_EDITION_ATTEMPTS. Sold out → [].
export function editionCandidates(acquiredCount, editionSize) {
  if (editionSize == null) return [null];
  const count = acquiredCount ?? 0;
  if (count >= editionSize) return [];
  const out = [];
  for (let n = count + 1; n <= editionSize && out.length < MAX_EDITION_ATTEMPTS; n++) {
    out.push(n);
  }
  return out;
}

// Classify a Postgres unique-violation from the acquisitions insert by
// constraint name so the caller knows whether it lost the idempotency race
// (reference) or an edition-number race (edition).
export function classifyInsertConflict(pgError) {
  const msg = `${pgError?.message || ''} ${pgError?.details || ''}`;
  if (msg.includes('acquisitions_payment_reference_key')) return 'reference';
  if (msg.includes('acquisitions_release_id_edition_number_key')) return 'edition';
  return 'other';
}

async function setIntentStatus(sb, reference, status, extra = {}) {
  const { error: err } = await sb
    .from('payment_intents')
    .update({ status, ...extra })
    .eq('reference', reference);
  if (err) console.error(`[acquire] failed to set intent ${reference} → ${status}: ${err.message}`);
}

// intent: a payment_intents row whose payment has been CONFIRMED by the
// caller (webhook signature + amount check, or Verify API).
// sb: service-role client.
// Returns { acquisition } on success (or prior success), { soldOut: true }
// when a paid buyer lost the sellout race (manual refund per TODOS.md policy).
export async function fulfillAcquisition(sb, intent) {
  // Already fulfilled (duplicate webhook, or the other path won the race).
  const { data: existing } = await sb
    .from('acquisitions')
    .select('*')
    .eq('payment_reference', intent.reference)
    .maybeSingle();
  if (existing) return { acquisition: existing };

  // The intent's release can have been deleted between payment and
  // fulfillment (FK is on delete set null). That's a permanent condition —
  // flag for manual refund rather than 500-looping the webhook.
  if (!intent.release_id) {
    console.error(`[acquire] PAID BUT RELEASE GONE — reference=${intent.reference} buyer=${intent.buyer_id}. Needs manual refund.`);
    await setIntentStatus(sb, intent.reference, 'needs_reconciliation');
    return { orphaned: true };
  }

  // Allocation loop: each attempt re-reads the release so concurrent
  // fulfillments see fresh acquired_count (the insert trigger bumps it on
  // every win). Without the re-read, N racing buyers all compute the same
  // candidate window and the losers get falsely flagged sold-out.
  for (let attempt = 0; attempt < MAX_EDITION_ATTEMPTS; attempt++) {
    const { data: release, error: relErr } = await sb
      .from('releases')
      .select('id, artist_id, edition_size, acquired_count')
      .eq('id', intent.release_id)
      .maybeSingle();
    if (relErr) throw new Error(`release lookup failed: ${relErr.message}`);
    if (!release) {
      console.error(`[acquire] PAID BUT RELEASE GONE — reference=${intent.reference} release=${intent.release_id}. Needs manual refund.`);
      await setIntentStatus(sb, intent.reference, 'needs_reconciliation');
      return { orphaned: true };
    }

    const candidates = editionCandidates(release.acquired_count, release.edition_size);
    if (candidates.length === 0) break; // genuinely sold out

    const { data: acquisition, error: insErr } = await sb
      .from('acquisitions')
      .insert({
        release_id: intent.release_id,
        owner_id: intent.buyer_id,
        edition_number: candidates[0],
        price_paid: intent.amount_subunits / 100,
        currency: intent.currency,
        payment_reference: intent.reference,
      })
      .select()
      .single();

    if (!insErr) {
      await setIntentStatus(sb, intent.reference, 'succeeded');
      // Open the provenance chain for this edition: genesis ('created' by the
      // artist) then 'acquired' by the buyer. Best-effort — a provenance
      // failure must never fail a paid, fulfilled acquisition, so we log and
      // move on rather than throw.
      try {
        await openProvenanceChain(sb, { release, acquisition, intent });
      } catch (e) {
        console.error(`[acquire] provenance emit failed for ${intent.reference}: ${e.message}`);
      }
      return { acquisition };
    }

    const kind = classifyInsertConflict(insErr);
    if (kind === 'reference') {
      // Lost the idempotency race — the other path inserted it. Success.
      const { data: winner } = await sb
        .from('acquisitions')
        .select('*')
        .eq('payment_reference', intent.reference)
        .maybeSingle();
      if (winner) return { acquisition: winner };
      throw new Error(`reference conflict but no row found for ${intent.reference}`);
    }
    if (kind === 'edition') continue; // another buyer took this number — re-read and retry
    throw new Error(`acquisition insert failed: ${insErr.message}`);
  }

  // Paid but no edition allocated: genuinely sold out, or we lost
  // MAX_EDITION_ATTEMPTS consecutive allocation races. Flag for manual
  // refund/reconciliation — never silently drop a confirmed payment.
  console.error(
    `[acquire] PAID BUT SOLD OUT — reference=${intent.reference} release=${intent.release_id} buyer=${intent.buyer_id}. Needs manual refund.`
  );
  await setIntentStatus(sb, intent.reference, 'needs_reconciliation');
  return { soldOut: true };
}
