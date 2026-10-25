import { describe, expect, it } from 'vitest';
import {
  createExchangeRotation,
  exchangeCatalogueVersion,
  exchangeRotationScore,
  exchangeRotationWindow,
  isEligibleExchangeRelease,
  paginateExchangeReleases,
  searchExchangeReleases,
} from './exchange-rotation.js';

const base = Date.parse('2026-10-24T08:00:00Z');
const release = (id, artist = `Artist ${id}`, extra = {}) => ({
  id,
  artist_id: `artist-${artist}`,
  artist_name: artist,
  title: `Release ${id}`,
  edition_type: 'First Edition',
  edition_name: 'First Edition',
  status: 'published',
  visibility: 'public',
  slug: `release-${id}`,
  artist_slug: `artist-${id}`,
  published_at: new Date(base - 14 * 24 * 60 * 60 * 1000).toISOString(),
  ...extra,
});

function orderFor(ids, hours) {
  const window = exchangeRotationWindow(new Date(base + hours * 60 * 60 * 1000), 4);
  return createExchangeRotation(ids, {
    secret: 'test-only-secret',
    windowId: window.id,
    windowStart: window.start,
  });
}

describe('Exchange Rotation', () => {
  it('keeps the same four-hour window ID and order during refreshes', () => {
    const first = exchangeRotationWindow(new Date(base), 4);
    const later = exchangeRotationWindow(new Date(base + 3 * 60 * 60 * 1000), 4);
    expect(later.id).toBe(first.id);
    expect(orderFor(Array.from({ length: 18 }, (_, i) => release(`r${i}`)), 0))
      .toEqual(orderFor(Array.from({ length: 18 }, (_, i) => release(`r${i}`)), 3));
  });

  it('generates a different deterministic order for the next window', () => {
    const releases = Array.from({ length: 18 }, (_, i) => release(`r${i}`));
    expect(orderFor(releases, 0)).not.toEqual(orderFor(releases, 4));
  });

  it('does not use appreciation or legacy vote counts in placement', () => {
    const releases = Array.from({ length: 14 }, (_, i) => release(`r${i}`, `Artist ${i}`, {
      appreciations: i * 10,
      votes: i * 100,
      sales: i * 1000,
    }));
    const withoutScores = releases.map(({ appreciations, votes, sales, ...item }) => item);
    expect(orderFor(releases, 0)).toEqual(orderFor(withoutScores, 0));
  });

  it('avoids consecutive releases from one artist when alternatives exist', () => {
    const releases = [
      release('a1', 'A'), release('a2', 'A'), release('a3', 'A'),
      release('b1', 'B'), release('c1', 'C'),
    ];
    const order = createExchangeRotation(releases, {
      secret: 'test-only-secret', windowId: 'w1', windowStart: new Date(base),
    });
    const byId = new Map(releases.map((item) => [item.id, item.artist_name]));
    for (let i = 1; i < order.length; i += 1) {
      if (new Set(order.slice(i)).size > 1) expect(byId.get(order[i])).not.toBe(byId.get(order[i - 1]));
    }
  });

  it('does not put the last window’s first release first again when an alternative exists', () => {
    const releases = Array.from({ length: 8 }, (_, i) => release(`r${i}`));
    const previousFirstReleaseId = orderFor(releases, 0)[0];
    const window = exchangeRotationWindow(new Date(base + 4 * 60 * 60 * 1000), 4);
    const next = createExchangeRotation(releases, {
      secret: 'test-only-secret',
      windowId: window.id,
      windowStart: window.start,
      previousFirstReleaseId,
    });
    expect(next[0]).not.toBe(previousFirstReleaseId);
  });

  it('bounds freshness and low-exposure support to eight percent combined', () => {
    const established = release('fresh', 'New artist', {
      published_at: new Date(base - 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const fresh = release('fresh', 'New artist', { published_at: new Date(base).toISOString() });
    const noBoost = exchangeRotationScore(established, {
      secret: 'test-only-secret', windowId: 'w1', catalogueVersion: 'v1',
      windowStart: new Date(base), recentImpressions: 5,
    });
    const maxBoost = exchangeRotationScore(fresh, {
      secret: 'test-only-secret', windowId: 'w1', catalogueVersion: 'v1',
      windowStart: new Date(base), recentImpressions: 0,
    });
    expect(noBoost - maxBoost).toBeLessThanOrEqual(0.080001);
    expect(noBoost - maxBoost).toBeGreaterThanOrEqual(0.079999);
  });

  it('excludes hidden, draft, withdrawn, and incomplete releases', () => {
    expect(isEligibleExchangeRelease(release('ok'))).toBe(true);
    expect(isEligibleExchangeRelease(release('hidden', 'Hidden', { visibility: 'unlisted' }))).toBe(false);
    expect(isEligibleExchangeRelease(release('draft', 'Draft', { status: 'draft' }))).toBe(false);
    expect(isEligibleExchangeRelease(release('withdrawn', 'Withdrawn', { withdrawn_at: '2026-10-24' }))).toBe(false);
    expect(isEligibleExchangeRelease(release('no-route', 'No route', { slug: null }))).toBe(false);
  });

  it('keeps pages stable and free of duplicates', () => {
    const ids = Array.from({ length: 53 }, (_, i) => `r${i}`);
    const first = paginateExchangeReleases(ids, 1, 20);
    const second = paginateExchangeReleases(ids, 2, 20);
    const third = paginateExchangeReleases(ids, 3, 20);
    expect([...first.items, ...second.items, ...third.items]).toEqual(ids);
    expect(new Set([...first.items, ...second.items, ...third.items]).size).toBe(53);
  });

  it('keeps search relevance above rotation and does not weight appreciations', () => {
    const exact = release('exact', 'Artist', { title: 'Ovacado', appreciations: 0 });
    const prefix = release('prefix', 'Ovacado Band', { title: 'Another', appreciations: 9000 });
    const recent = release('recent', 'Artist', {
      title: 'Ovacado Rerun',
      published_at: new Date(base).toISOString(),
      appreciations: 900000,
    });
    expect(searchExchangeReleases([recent, prefix, exact], 'ovacado').map((item) => item.id))
      .toEqual(['exact', 'recent', 'prefix']);
  });

  it('versions snapshots from catalogue eligibility inputs only', () => {
    expect(exchangeCatalogueVersion([release('a')])).toBe(exchangeCatalogueVersion([release('a')]));
    expect(exchangeCatalogueVersion([release('a')])).not.toBe(exchangeCatalogueVersion([release('b')]));
  });

  it('gives every release a turn near the front over successive windows', () => {
    const releases = Array.from({ length: 12 }, (_, i) => release(`r${i}`));
    const firstPageExposure = new Set();
    for (let window = 0; window < 48; window += 1) {
      for (const id of orderFor(releases, window).slice(0, 3)) firstPageExposure.add(id);
    }
    expect(firstPageExposure.size).toBe(releases.length);
  });
});
