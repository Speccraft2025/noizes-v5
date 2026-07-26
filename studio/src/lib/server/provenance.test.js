import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  canonicalizeEvent,
  hashEvent,
  verifyChain,
  buildProvenanceDocument,
} from './provenance.js';

// Mint a throwaway registry key and a helper that signs an event core the same
// way the server does, so we can build valid chains in tests.
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUB_B64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

function signedEvent(core) {
  const content_hash = hashEvent(core);
  const signature = crypto
    .sign(null, Buffer.from(content_hash, 'hex'), privateKey)
    .toString('base64');
  return { ...core, content_hash, signature, signer_public_key: PUB_B64 };
}

function buildChain() {
  const genesis = signedEvent({
    release_id: 'rel-1', edition_number: 7, seq: 0, kind: 'created',
    from_owner_id: null, to_owner_id: 'artist', price: null, currency: null,
    note: null, occurred_at: '2026-07-26T00:00:00.000Z', prev_hash: null,
  });
  const acquired = signedEvent({
    release_id: 'rel-1', edition_number: 7, seq: 1, kind: 'acquired',
    from_owner_id: 'artist', to_owner_id: 'alice', price: 500, currency: 'KES',
    note: null, occurred_at: '2026-07-27T00:00:00.000Z', prev_hash: genesis.content_hash,
  });
  const transferred = signedEvent({
    release_id: 'rel-1', edition_number: 7, seq: 2, kind: 'transferred',
    from_owner_id: 'alice', to_owner_id: 'bob', price: 78000, currency: 'KES',
    note: 'This song got me through university.', occurred_at: '2026-08-01T00:00:00.000Z',
    prev_hash: acquired.content_hash,
  });
  return [genesis, acquired, transferred];
}

describe('canonicalizeEvent', () => {
  it('is deterministic regardless of input key order', () => {
    const a = canonicalizeEvent({ seq: 0, kind: 'created', release_id: 'r' });
    const b = canonicalizeEvent({ release_id: 'r', kind: 'created', seq: 0 });
    expect(a).toBe(b);
  });

  it('treats undefined and missing fields as null', () => {
    const a = canonicalizeEvent({ release_id: 'r', note: undefined });
    const b = canonicalizeEvent({ release_id: 'r' });
    expect(a).toBe(b);
    expect(a).toContain('"note":null');
  });
});

describe('hashEvent', () => {
  it('changes when any attested field changes', () => {
    const base = { release_id: 'r', seq: 0, kind: 'created', note: 'x' };
    expect(hashEvent(base)).not.toBe(hashEvent({ ...base, note: 'y' }));
  });
});

describe('verifyChain', () => {
  it('accepts a well-formed signed chain', () => {
    const res = verifyChain(buildChain());
    expect(res).toEqual({ valid: true, errors: [] });
  });

  it('accepts events given out of order (sorts by seq)', () => {
    const chain = buildChain();
    const res = verifyChain([chain[2], chain[0], chain[1]]);
    expect(res.valid).toBe(true);
  });

  it('rejects an empty chain', () => {
    expect(verifyChain([]).valid).toBe(false);
    expect(verifyChain(null).valid).toBe(false);
  });

  it('detects a tampered note (content_hash mismatch)', () => {
    const chain = buildChain();
    chain[2] = { ...chain[2], note: 'forged sentiment' };
    const res = verifyChain(chain);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('content_hash mismatch'))).toBe(true);
  });

  it('detects a broken chain link', () => {
    const chain = buildChain();
    chain[2] = signedEvent({ ...stripSigned(chain[2]), prev_hash: 'deadbeef' });
    const res = verifyChain(chain);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('broken link'))).toBe(true);
  });

  it('detects an invalid signature', () => {
    const chain = buildChain();
    chain[1] = { ...chain[1], signature: Buffer.from('nope').toString('base64') };
    const res = verifyChain(chain);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('invalid signature'))).toBe(true);
  });

  it('detects a seq gap', () => {
    const chain = buildChain();
    const res = verifyChain([chain[0], chain[2]]);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('seq gap'))).toBe(true);
  });

  it('rejects a genesis that is not kind created', () => {
    const bad = signedEvent({
      release_id: 'r', edition_number: 1, seq: 0, kind: 'acquired',
      from_owner_id: null, to_owner_id: 'x', price: null, currency: null,
      note: null, occurred_at: '2026-07-26T00:00:00.000Z', prev_hash: null,
    });
    const res = verifyChain([bad]);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("kind 'created'"))).toBe(true);
  });

  it('rejects a genesis with a non-null prev_hash', () => {
    const bad = signedEvent({
      release_id: 'r', edition_number: 1, seq: 0, kind: 'created',
      from_owner_id: null, to_owner_id: 'x', price: null, currency: null,
      note: null, occurred_at: '2026-07-26T00:00:00.000Z', prev_hash: 'abc',
    });
    const res = verifyChain([bad]);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('null prev_hash'))).toBe(true);
  });
});

describe('buildProvenanceDocument', () => {
  it('produces a portable document that re-verifies', () => {
    const events = buildChain();
    const doc = buildProvenanceDocument({
      release: { id: 'rel-1', title: 'Retrospect', artist_name: 'Jazel', edition_size: 100 },
      editionNumber: 7,
      events,
      registryPublicKey: PUB_B64,
    });
    expect(doc.kind).toBe('noizes-provenance');
    expect(doc.edition_number).toBe(7);
    expect(doc.registry_public_key).toBe(PUB_B64);
    expect(doc.events).toHaveLength(3);
    // The exported events must still verify as a chain.
    expect(verifyChain(doc.events).valid).toBe(true);
  });
});

// Helper: strip the signed/derived fields so an event core can be re-signed.
function stripSigned(ev) {
  const { content_hash, signature, signer_public_key, ...core } = ev;
  return core;
}
