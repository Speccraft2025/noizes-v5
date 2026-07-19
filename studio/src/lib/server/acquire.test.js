import { describe, it, expect } from 'vitest';
import { editionCandidates, classifyInsertConflict, MAX_EDITION_ATTEMPTS } from './acquire.js';

describe('editionCandidates', () => {
  it('offers all remaining numbers of a fresh limited edition', () => {
    expect(editionCandidates(0, 3)).toEqual([1, 2, 3]);
  });

  it('starts after the acquired count', () => {
    expect(editionCandidates(2, 3)).toEqual([3]);
  });

  it('returns empty when sold out', () => {
    expect(editionCandidates(3, 3)).toEqual([]);
    expect(editionCandidates(5, 3)).toEqual([]);
  });

  it('returns [null] for open editions regardless of count', () => {
    expect(editionCandidates(0, null)).toEqual([null]);
    expect(editionCandidates(5, null)).toEqual([null]);
    expect(editionCandidates(5, undefined)).toEqual([null]);
  });

  it('treats a null acquired count as zero', () => {
    expect(editionCandidates(null, 2)).toEqual([1, 2]);
  });

  it('caps attempts on large editions', () => {
    const out = editionCandidates(0, 1000);
    expect(out).toHaveLength(MAX_EDITION_ATTEMPTS);
    expect(out[0]).toBe(1);
    expect(out[out.length - 1]).toBe(MAX_EDITION_ATTEMPTS);
  });
});

describe('classifyInsertConflict', () => {
  it('detects the payment_reference idempotency conflict', () => {
    expect(classifyInsertConflict({
      message: 'duplicate key value violates unique constraint "acquisitions_payment_reference_key"',
    })).toBe('reference');
  });

  it('detects the edition-number race conflict', () => {
    expect(classifyInsertConflict({
      message: 'duplicate key value violates unique constraint "acquisitions_release_id_edition_number_key"',
    })).toBe('edition');
  });

  it('finds the constraint name in details when message is generic', () => {
    expect(classifyInsertConflict({
      message: 'duplicate key value',
      details: 'Key (release_id, edition_number) conflicts with acquisitions_release_id_edition_number_key',
    })).toBe('edition');
  });

  it('classifies unrelated errors as other', () => {
    expect(classifyInsertConflict({ message: 'connection refused' })).toBe('other');
    expect(classifyInsertConflict(null)).toBe('other');
    expect(classifyInsertConflict({})).toBe('other');
  });
});
