// Signed, hash-chained provenance for Noizes objects.
//
// Each edition of a release has its own chain of events (created → acquired →
// transferred → …). Each event carries:
//   - prev_hash:     the content_hash of the previous event (null for genesis)
//   - content_hash:  sha256 over the canonical serialization of the event
//                    (which INCLUDES prev_hash), so any edit or reorder breaks
//                    the link
//   - signature:     Ed25519(content_hash) by the platform registry key
//
// The portable provenance.json a collector exports is just the ordered list of
// these events plus the registry public key. Anyone can recompute the hashes
// and verify the signatures offline, with no Noizes server involved. That is
// what makes "this object's history survives us" true rather than marketing.
//
// This module is split into PURE functions (canonical serialization, hashing,
// chain verification — unit-tested, no I/O) and DB functions (append, load).

import crypto from 'node:crypto';
import { verifySignature } from './crypto-verify.js';

// The exact fields, in a fixed set, that define an event's identity. Anything
// outside this set (db id, created timestamps we don't attest, etc.) is NOT
// part of the hash. Keep this list stable across versions — changing it
// changes every hash.
const EVENT_FIELDS = [
  'release_id',
  'edition_number',
  'seq',
  'kind',
  'from_owner_id',
  'to_owner_id',
  'price',
  'currency',
  'note',
  'occurred_at',
  'prev_hash',
];

/**
 * Canonical serialization: JSON with keys in a FIXED order (EVENT_FIELDS),
 * null for absent values, no insignificant whitespace. Reproducible across
 * implementations — a verifier in any language sorts the same way.
 */
export function canonicalizeEvent(event) {
  const ordered = {};
  for (const key of EVENT_FIELDS) {
    ordered[key] = event[key] === undefined ? null : event[key];
  }
  return JSON.stringify(ordered);
}

/** Hex sha256 of the canonical serialization of an event. */
export function hashEvent(event) {
  return crypto.createHash('sha256').update(canonicalizeEvent(event), 'utf8').digest('hex');
}

/**
 * Verifies a full chain of events (ordered by seq). Returns
 * { valid: boolean, errors: string[] }. Checks:
 *   1. seq is 0-based and contiguous
 *   2. genesis (seq 0) has prev_hash === null and kind 'created'
 *   3. each event's prev_hash === previous event's content_hash
 *   4. each event's content_hash === recomputed hash
 *   5. each signature verifies against its signer_public_key
 * Pure: no I/O, safe to run in the offline verifier.
 */
export function verifyChain(events) {
  const errors = [];
  if (!Array.isArray(events) || events.length === 0) {
    return { valid: false, errors: ['chain is empty'] };
  }

  const sorted = [...events].sort((a, b) => a.seq - b.seq);

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];

    if (ev.seq !== i) {
      errors.push(`seq gap at index ${i}: expected ${i}, got ${ev.seq}`);
    }

    if (i === 0) {
      if (ev.prev_hash != null) errors.push('genesis event must have null prev_hash');
      if (ev.kind !== 'created') errors.push(`genesis event must be kind 'created', got '${ev.kind}'`);
    } else {
      const prev = sorted[i - 1];
      if (ev.prev_hash !== prev.content_hash) {
        errors.push(`broken link at seq ${ev.seq}: prev_hash does not match previous content_hash`);
      }
    }

    const recomputed = hashEvent(ev);
    if (recomputed !== ev.content_hash) {
      errors.push(`content_hash mismatch at seq ${ev.seq}: event has been altered`);
    }

    const sigOk = verifySignature({
      hash: ev.content_hash,
      signature: ev.signature,
      publicKey: ev.signer_public_key,
    });
    if (!sigOk) errors.push(`invalid signature at seq ${ev.seq}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Builds the portable provenance document from a verified chain. This is the
 * shape written to provenance.json for a collector to export and keep.
 */
export function buildProvenanceDocument({ release, editionNumber, events, registryPublicKey }) {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  return {
    schema_version: '1.0.0',
    kind: 'noizes-provenance',
    release_id: release.id,
    title: release.title,
    artist: release.artist_name,
    edition_number: editionNumber,
    edition_size: release.edition_size ?? null,
    registry_public_key: registryPublicKey,
    exported_at: new Date().toISOString(),
    events: sorted.map((e) => ({
      // Attested fields (part of content_hash) must travel verbatim so the
      // exported chain re-verifies offline.
      release_id: e.release_id,
      edition_number: e.edition_number ?? null,
      seq: e.seq,
      kind: e.kind,
      from_owner_id: e.from_owner_id ?? null,
      to_owner_id: e.to_owner_id ?? null,
      price: e.price ?? null,
      currency: e.currency ?? null,
      note: e.note ?? null,
      occurred_at: e.occurred_at,
      prev_hash: e.prev_hash ?? null,
      content_hash: e.content_hash,
      signature: e.signature,
      signer_public_key: e.signer_public_key,
    })),
  };
}

// ── DB functions ──────────────────────────────────────────────────────────

/**
 * Loads the full chain for one edition, ordered by seq.
 * sb: any client (service or RLS — provenance is public-readable).
 */
export async function loadChain(sb, releaseId, editionNumber) {
  let q = sb
    .from('provenance_events')
    .select('*')
    .eq('release_id', releaseId)
    .order('seq', { ascending: true });
  // edition_number can be null (open editions). Postgres `eq` with null won't
  // match, so branch.
  q = editionNumber == null ? q.is('edition_number', null) : q.eq('edition_number', editionNumber);
  const { data, error } = await q;
  if (error) throw new Error(`loadChain failed: ${error.message}`);
  return data ?? [];
}

/**
 * Appends one event to an edition's chain. Reads the current tip, computes
 * seq + prev_hash, hashes and signs with the registry key, inserts.
 *
 * The unique(release_id, edition_number, seq) constraint is the concurrency
 * guard: if two appends race, the loser hits a unique violation and should
 * retry (caller decides). Returns the inserted row.
 *
 * sb: service-role client (append is service-role only).
 */
export async function appendEvent(sb, {
  releaseId,
  editionNumber,
  kind,
  fromOwnerId = null,
  toOwnerId = null,
  acquisitionId = null,
  price = null,
  currency = null,
  note = null,
  occurredAt = null,
}) {
  const chain = await loadChain(sb, releaseId, editionNumber);
  const tip = chain.length ? chain[chain.length - 1] : null;
  const seq = tip ? tip.seq + 1 : 0;
  const prevHash = tip ? tip.content_hash : null;

  if (seq === 0 && kind !== 'created') {
    throw new Error(`first event for an edition must be 'created', got '${kind}'`);
  }

  const eventCore = {
    release_id: releaseId,
    edition_number: editionNumber ?? null,
    seq,
    kind,
    from_owner_id: fromOwnerId,
    to_owner_id: toOwnerId,
    price,
    currency,
    note,
    occurred_at: occurredAt ?? new Date().toISOString(),
    prev_hash: prevHash,
  };

  const contentHash = hashEvent(eventCore);
  // Lazy import: signing.js pulls in $env/dynamic/private, which only resolves
  // in the SvelteKit runtime. Keeping it out of module scope lets the pure
  // functions above (and their tests / the offline verifier) import this file.
  const { signWithRegistry } = await import('./signing.js');
  const { signature, publicKey } = await signWithRegistry(sb, Buffer.from(contentHash, 'hex'));

  const { data, error } = await sb
    .from('provenance_events')
    .insert({
      ...eventCore,
      acquisition_id: acquisitionId,
      content_hash: contentHash,
      signature,
      signer_public_key: publicKey,
    })
    .select()
    .single();

  if (error) throw new Error(`appendEvent failed: ${error.message}`);
  return data;
}
