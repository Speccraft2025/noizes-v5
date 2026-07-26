// Custody transfer: the one place ownership of an edition changes hands.
// Used by BOTH the self-serve transfer endpoint (non-monetary hand-off) and
// resale fulfillment (paid, via the offer book). Keeping it in one function
// means the provenance chain and the note-folding rule are identical on both
// paths.
//
// Model note: there is exactly one acquisitions row per edition (unique on
// release_id + edition_number), so a transfer MUTATES owner_id on that row
// rather than inserting a second row. The real history lives in
// provenance_events; acquisitions holds only the CURRENT custodian.
//
// Note-folding rule: a collector_notes row is the CURRENT steward's single
// note. On transfer its body is copied verbatim into the signed 'transferred'
// event (so it becomes tamper-evident, portable history) and the draft row is
// cleared so the new custodian starts fresh — "one note per stewardship".

import { appendEvent } from './provenance.js';

export class TransferError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'not_owner' | 'same_owner' | 'not_found' | 'db'
  }
}

/**
 * Transfers an edition from its current owner to `toOwnerId`.
 * sb: service-role client.
 * kind: 'transferred' (both gift and resale use this event kind).
 * price/currency: set for resale, null for a gift.
 * Returns { acquisition, event }.
 */
export async function transferCustody(sb, {
  acquisitionId,
  expectedFromOwnerId, // guard: the caller's view of who owns it now
  toOwnerId,
  price = null,
  currency = null,
}) {
  const { data: acq, error: acqErr } = await sb
    .from('acquisitions')
    .select('id, release_id, edition_number, owner_id')
    .eq('id', acquisitionId)
    .maybeSingle();
  if (acqErr) throw new TransferError('db', `acquisition lookup failed: ${acqErr.message}`);
  if (!acq) throw new TransferError('not_found', 'Acquisition not found');
  if (expectedFromOwnerId && acq.owner_id !== expectedFromOwnerId) {
    throw new TransferError('not_owner', 'You no longer own this edition');
  }
  if (acq.owner_id === toOwnerId) {
    throw new TransferError('same_owner', 'Cannot transfer to the current owner');
  }

  const fromOwnerId = acq.owner_id;

  // Pull the outgoing steward's note (if any) to fold into the event.
  const { data: note } = await sb
    .from('collector_notes')
    .select('id, body, status')
    .eq('acquisition_id', acquisitionId)
    .maybeSingle();
  const foldedNote = note && note.status === 'visible' ? note.body : null;

  // Flip custody. Conditioned on owner_id so a concurrent transfer can't
  // double-spend the edition (the second update matches zero rows).
  const { data: updated, error: updErr } = await sb
    .from('acquisitions')
    .update({
      owner_id: toOwnerId,
      previous_owner_id: fromOwnerId,
      transferred_from_acquisition_id: acquisitionId,
    })
    .eq('id', acquisitionId)
    .eq('owner_id', fromOwnerId)
    .select()
    .maybeSingle();
  if (updErr) throw new TransferError('db', `transfer update failed: ${updErr.message}`);
  if (!updated) throw new TransferError('not_owner', 'Ownership changed before transfer completed');

  // Append the signed 'transferred' event, folding the outgoing note.
  const event = await appendEvent(sb, {
    releaseId: acq.release_id,
    editionNumber: acq.edition_number,
    kind: 'transferred',
    fromOwnerId,
    toOwnerId,
    acquisitionId,
    price,
    currency,
    note: foldedNote,
  });

  // Clear the draft note so the new custodian starts fresh. The folded copy
  // now lives immutably in the signed event.
  if (note) {
    await sb.from('collector_notes').delete().eq('id', note.id);
  }

  // Any offers on this edition are stale now — the owner changed. Expire them.
  await sb
    .from('offers')
    .update({ status: 'expired' })
    .eq('acquisition_id', acquisitionId)
    .eq('status', 'active');

  return { acquisition: updated, event };
}
