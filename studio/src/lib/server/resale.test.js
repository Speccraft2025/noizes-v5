import { describe, it, expect } from 'vitest';
import { royaltySplit, RESALE_ROYALTY_RATE } from './resale.js';

describe('royaltySplit', () => {
  it('splits 85/15 by default and sums to the gross', () => {
    const s = royaltySplit(1000);
    expect(s.artist).toBe(850);
    expect(s.platform).toBe(150);
    expect(s.artist + s.platform).toBe(1000);
  });

  it('rounds to cents without losing a cent', () => {
    const s = royaltySplit(999.99);
    expect(Math.round((s.artist + s.platform) * 100) / 100).toBe(999.99);
  });

  it('honors a custom rate', () => {
    expect(royaltySplit(200, 0.5)).toEqual({ artist: 100, platform: 100 });
  });

  it('treats non-numeric input as zero', () => {
    expect(royaltySplit(undefined)).toEqual({ artist: 0, platform: 0 });
  });

  it('exposes the documented default rate', () => {
    expect(RESALE_ROYALTY_RATE).toBe(0.85);
  });
});
