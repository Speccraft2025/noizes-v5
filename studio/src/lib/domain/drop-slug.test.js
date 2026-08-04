import { describe, it, expect } from 'vitest';
import {
  slugify, slugSuffix, artistSlugFor, dropSlugCandidates,
  dropPath, dropUrl, isCanonicalAddress, RESERVED_ARTIST_SLUGS,
} from './drop-slug.js';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('The Mixtape')).toBe('the-mixtape');
  });

  it('folds diacritics rather than dropping the letters', () => {
    // "sauti-sl" would be a different word. Losing characters silently is the
    // failure mode worth guarding.
    expect(slugify('Sauti Sól')).toBe('sauti-sol');
    expect(slugify('Björk')).toBe('bjork');
  });

  it('collapses runs of punctuation and trims the edges', () => {
    expect(slugify('  ...RETRO///SPECT!! ')).toBe('retro-spect');
  });

  it('never ends on a hyphen, even after truncation', () => {
    const slug = slugify(`${'a'.repeat(59)} tail`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('falls back when nothing survives', () => {
    expect(slugify('!!!', 'release')).toBe('release');
    expect(slugify('', 'release')).toBe('release');
    expect(slugify(null, 'release')).toBe('release');
  });
});

describe('artistSlugFor', () => {
  it('refuses to shadow a route', () => {
    // An artist called "Studio" must not own /drop/studio in a way that
    // reads like the application's own /studio.
    for (const reserved of RESERVED_ARTIST_SLUGS) {
      expect(artistSlugFor(reserved)).toBe(`${reserved}-artist`);
    }
  });

  it('leaves ordinary names alone', () => {
    expect(artistSlugFor('dBoy')).toBe('dboy');
  });
});

describe('dropSlugCandidates', () => {
  const releaseId = 'a1b2c3d4-0000-4000-8000-000000000000';

  it('prefers the clean address', () => {
    const [first] = dropSlugCandidates({ artistName: 'dBoy', title: 'Retrospect', releaseId });
    expect(first).toEqual({ artist_slug: 'dboy', slug: 'retrospect' });
  });

  it('derives the collision suffix from the release id, not a counter', () => {
    // A counter depends on insertion order, so restoring a snapshot or
    // re-running a backfill could hand an address to a different release.
    const candidates = dropSlugCandidates({ artistName: 'dBoy', title: 'Retrospect', releaseId });
    expect(candidates[1].slug).toBe('retrospect-a1b2');
    expect(dropSlugCandidates({ artistName: 'dBoy', title: 'Retrospect', releaseId })[1].slug)
      .toBe(candidates[1].slug);
  });

  it('ends with a candidate that cannot collide', () => {
    const candidates = dropSlugCandidates({ artistName: 'dBoy', title: 'Retrospect', releaseId });
    expect(candidates).toHaveLength(3);
    expect(candidates.at(-1).slug).toContain('a1b2c3d40000');
  });

  it('still produces an address for an untitled release by an unnamed artist', () => {
    const [first] = dropSlugCandidates({ artistName: '', title: '', releaseId });
    expect(first).toEqual({ artist_slug: 'artist', slug: 'release' });
  });
});

describe('slugSuffix', () => {
  it('takes four hex characters of the id', () => {
    expect(slugSuffix('a1b2c3d4-0000-4000-8000-000000000000')).toBe('a1b2');
  });

  it('degrades to a constant rather than an empty string', () => {
    expect(slugSuffix(null)).toBe('0000');
    expect(slugSuffix('zzz')).toBe('0000');
  });
});

describe('addresses', () => {
  it('builds the path and the absolute URL', () => {
    expect(dropPath('dboy', 'retrospect')).toBe('/drop/dboy/retrospect');
    expect(dropUrl('https://noizes.xyz', 'dboy', 'retrospect'))
      .toBe('https://noizes.xyz/drop/dboy/retrospect');
  });

  it('does not double the slash when the origin has a trailing one', () => {
    expect(dropUrl('https://noizes.xyz/', 'dboy', 'retrospect'))
      .toBe('https://noizes.xyz/drop/dboy/retrospect');
  });

  it('recognises a superseded address', () => {
    const release = { artist_slug: 'dboy', slug: 'retrospect' };
    expect(isCanonicalAddress(release, 'dboy', 'retrospect')).toBe(true);
    expect(isCanonicalAddress(release, 'dboy', 'retro-spect-old')).toBe(false);
  });
});
