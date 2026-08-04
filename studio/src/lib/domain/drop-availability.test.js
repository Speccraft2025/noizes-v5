import { describe, it, expect } from 'vitest';
import {
  dropAvailability, canDownloadPackage, copiesAvailable, isSoldOut, packageFilename,
} from './drop-availability.js';

const published = (overrides = {}) => ({
  status: 'published',
  price: 1500,
  currency: 'KES',
  edition_size: 100,
  acquired_count: 10,
  offers_enabled: true,
  transferable: true,
  allow_public_download: false,
  ...overrides,
});

describe('copiesAvailable', () => {
  it('subtracts what has been claimed', () => {
    expect(copiesAvailable(published())).toBe(90);
  });

  it('returns null for an open edition', () => {
    expect(copiesAvailable(published({ edition_size: null }))).toBeNull();
    expect(isSoldOut(published({ edition_size: null }))).toBe(false);
  });

  it('never reports a negative count when an oversell has happened', () => {
    // A refunded-but-not-decremented count should read "sold out", not "-2 left".
    expect(copiesAvailable(published({ edition_size: 10, acquired_count: 12 }))).toBe(0);
    expect(isSoldOut(published({ edition_size: 10, acquired_count: 12 }))).toBe(true);
  });
});

describe('dropAvailability', () => {
  it('offers a purchase for a paid limited edition', () => {
    const verdict = dropAvailability({ release: published() });
    expect(verdict.state).toBe('buy_limited');
    expect(verdict.primary).toMatchObject({ label: 'Buy this edition', action: 'acquire', disabled: false });
  });

  it('offers a claim rather than a purchase when the price is zero', () => {
    expect(dropAvailability({ release: published({ price: 0 }) }).primary.label).toBe('Claim a copy');
    expect(dropAvailability({ release: published({ price: 0, edition_size: null }) }).primary.label)
      .toBe('Get the .nz package');
  });

  it('puts ownership above every other state', () => {
    // A collector who already holds a copy must reach it even when the
    // edition is sold out or the release has been withdrawn.
    for (const release of [
      published({ acquired_count: 100 }),
      published({ status: 'withdrawn' }),
      published({ status: 'archived' }),
    ]) {
      const verdict = dropAvailability({ release, owned: true });
      expect(verdict.state).toBe('owned');
      expect(verdict.primary).toMatchObject({ action: 'experience', disabled: false });
      expect(verdict.secondary.action).toBe('download');
    }
  });

  it('routes a sold-out edition to offers when the creator allows them', () => {
    const verdict = dropAvailability({ release: published({ acquired_count: 100 }) });
    expect(verdict.state).toBe('sold_out_offers');
    expect(verdict.primary).toMatchObject({ label: 'Make an offer', disabled: false });
  });

  it('says sold out, and disables the button, when offers are off', () => {
    const verdict = dropAvailability({
      release: published({ acquired_count: 100, offers_enabled: false }),
    });
    expect(verdict.state).toBe('sold_out');
    expect(verdict.primary.disabled).toBe(true);
    // The experience preview stays reachable — an archive record should still
    // be explorable by someone who cannot buy it.
    expect(verdict.secondary.action).toBe('experience');
  });

  it('disables acquisition on a withdrawn release while keeping the page alive', () => {
    const verdict = dropAvailability({ release: published({ status: 'withdrawn' }) });
    expect(verdict.state).toBe('withdrawn');
    expect(verdict.primary).toMatchObject({ label: 'Not currently available', disabled: true });
    expect(verdict.note).toMatch(/copies already held are unaffected/i);
  });

  it('gives the creator of a draft a way back to Studio, and nobody else an action', () => {
    expect(dropAvailability({ release: published({ status: 'draft' }), isCreator: true }).secondary.action)
      .toBe('manage');
    expect(dropAvailability({ release: published({ status: 'draft' }) }).secondary).toBeNull();
  });
});

describe('canDownloadPackage', () => {
  it('lets the creator and the owner through', () => {
    expect(canDownloadPackage({ release: published(), isCreator: true }))
      .toEqual({ allowed: true, reason: 'creator' });
    expect(canDownloadPackage({ release: published(), owned: true }))
      .toEqual({ allowed: true, reason: 'owner' });
  });

  it('refuses a stranger by default', () => {
    expect(canDownloadPackage({ release: published() }))
      .toEqual({ allowed: false, reason: 'not_entitled' });
  });

  it('allows a public download only when it is free AND the creator said so', () => {
    expect(canDownloadPackage({ release: published({ price: 0, allow_public_download: true }) }))
      .toEqual({ allowed: true, reason: 'public' });
    // A paid release with the flag set is still not a giveaway.
    expect(canDownloadPackage({ release: published({ price: 1500, allow_public_download: true }) }).allowed)
      .toBe(false);
    expect(canDownloadPackage({ release: published({ price: 0, allow_public_download: false }) }).allowed)
      .toBe(false);
  });

  it('refuses an unpublished release even to a would-be owner', () => {
    expect(canDownloadPackage({ release: published({ status: 'draft' }) }))
      .toEqual({ allowed: false, reason: 'not_published' });
  });
});

describe('packageFilename', () => {
  it('keeps the .nz extension the format is recognised by', () => {
    expect(packageFilename({ artist: 'dBoy', title: 'Retrospect' })).toBe('dBoy - Retrospect.nz');
  });

  it('includes the edition number when the copy is numbered', () => {
    expect(packageFilename({ artist: 'dBoy', title: 'Retrospect', editionNumber: 7 }))
      .toBe('dBoy - Retrospect (No. 7).nz');
  });

  it('strips characters that would break a save dialog', () => {
    expect(packageFilename({ artist: 'A/B:C', title: 'What? "Now"' }))
      .toBe('ABC - What Now.nz');
  });

  it('still produces a usable name when the metadata is empty', () => {
    expect(packageFilename({})).toBe('Noizes - Release.nz');
  });
});
