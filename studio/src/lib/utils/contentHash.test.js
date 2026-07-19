import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { canonicalize, computeContentHash } from './contentHash.js';

describe('canonicalize', () => {
  it('sorts keys at every depth, preserves array order, drops undefined values', () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: [3, 1, 2] } }))
      .toBe('{"a":{"c":[3,1,2],"d":2},"b":1}');
    expect(canonicalize({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(canonicalize([1, undefined, null])).toBe('[1,null,null]');
    expect(canonicalize(null)).toBe('null');
    expect(canonicalize('x')).toBe('"x"');
  });
});

describe('computeContentHash', () => {
  const experience = { z: 1, a: 2 };
  const audio = new Uint8Array([1, 2, 3, 4]);

  it('matches an independently computed SHA-256; absent resources (null/undefined) hash identically, present resources change it', async () => {
    const expected = createHash('sha256')
      .update(Buffer.from('{"a":2,"z":1}', 'utf8'))
      .update(Buffer.from(audio))
      .digest('hex');
    const withNull = await computeContentHash(experience, null, [audio]);
    expect(withNull).toBe(expected);
    expect(await computeContentHash(experience, undefined, [audio])).toBe(withNull);
    expect(await computeContentHash(experience, { r: 1 }, [audio])).not.toBe(withNull);
  });

  it('is sensitive to rendition byte order and accepts ArrayBuffer input', async () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([3, 4]);
    const ab = await computeContentHash(experience, null, [a, b]);
    const ba = await computeContentHash(experience, null, [b, a]);
    expect(ab).not.toBe(ba);
    expect(await computeContentHash(experience, null, [a.buffer.slice(0), b.buffer.slice(0)])).toBe(ab);
  });

  it('throws a clear error when WebCrypto is unavailable (pre-20 Node guard)', async () => {
    vi.stubGlobal('crypto', {});
    try {
      await expect(computeContentHash(experience, null, [audio])).rejects.toThrow(/WebCrypto unavailable/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
