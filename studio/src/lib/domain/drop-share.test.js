import { describe, it, expect } from 'vitest';
import {
  canonicalDropUrl, shareMessage, shareTargets, metaDescription, openGraphTags,
} from './drop-share.js';

const url = 'https://noizes.xyz/drop/dboy/retrospect';

describe('canonicalDropUrl', () => {
  it('builds the permanent address', () => {
    expect(canonicalDropUrl('https://noizes.xyz', 'dboy', 'retrospect')).toBe(url);
  });

  it('tolerates a trailing slash on the origin', () => {
    expect(canonicalDropUrl('https://noizes.xyz//', 'dboy', 'retrospect')).toBe(url);
  });
});

describe('shareMessage', () => {
  it('leads with the release so a notification preview says something', () => {
    const message = shareMessage({
      title: 'RETROSPECT', artist: 'dBoy', editionName: 'First Edition', editionSize: 100, url,
    });
    expect(message.split('\n')[0]).toBe('RETROSPECT by dBoy');
    expect(message).toContain('First Edition • 100 copies');
    expect(message.trimEnd().endsWith(url)).toBe(true);
  });

  it('does not leave an empty edition line when there is no edition', () => {
    const message = shareMessage({ title: 'RETROSPECT', artist: 'dBoy', url });
    expect(message).not.toMatch(/\n\n\n/);
    expect(message).toContain(url);
  });
});

describe('shareTargets', () => {
  const targets = shareTargets({ url, title: 'RETRO & SPECT', artist: 'dBoy' });

  it('shares the canonical page, never a storage location', () => {
    for (const target of targets) {
      expect(target.href).not.toMatch(/supabase|storage|\.nz/);
    }
  });

  it('encodes creator-controlled text wherever it appears', () => {
    // An ampersand in a title silently truncates an unencoded query. Facebook
    // takes only a URL, so it carries no title to encode.
    for (const target of targets.filter((entry) => entry.key !== 'facebook')) {
      expect(target.href, target.key).not.toMatch(/RETRO & SPECT/);
      expect(decodeURIComponent(target.href), target.key).toContain('RETRO & SPECT');
    }
  });

  it('never lets a raw title reach a share URL', () => {
    for (const target of targets) {
      expect(target.href, target.key).not.toContain(' ');
      expect(target.href, target.key).not.toMatch(/[<>"]/);
    }
  });

  it('covers the networks people actually paste into', () => {
    expect(targets.map((target) => target.key)).toEqual(['whatsapp', 'x', 'facebook', 'email']);
  });
});

describe('metaDescription', () => {
  it('prefers the description the creator wrote', () => {
    const description = metaDescription({
      title: 'RETROSPECT', artist: 'dBoy', description: 'Ten years of nights in Nairobi.',
      editionName: 'First Edition', editionSize: 100, trackCount: 12,
    });
    expect(description).toContain('Ten years of nights in Nairobi.');
    expect(description).toContain('First Edition • 100 copies • 12 tracks');
  });

  it('writes a sensible line when the creator wrote nothing', () => {
    const description = metaDescription({ title: 'RETROSPECT', artist: 'dBoy' });
    expect(description).toContain('RETROSPECT by dBoy');
    expect(description).toMatch(/offline/);
  });

  it('truncates on a word boundary rather than mid-word', () => {
    const description = metaDescription({
      title: 'X', artist: 'Y', description: 'word '.repeat(80),
    });
    expect(description.length).toBeLessThanOrEqual(200);
    expect(description.endsWith('…')).toBe(true);
    expect(description).not.toMatch(/wo…$/);
  });

  it('flattens newlines so a card is not broken by formatting', () => {
    expect(metaDescription({ title: 'X', artist: 'Y', description: 'a\n\nb\tc' }))
      .toContain('a b c');
  });
});

describe('openGraphTags', () => {
  it('emits the tags a crawler needs, with the canonical URL', () => {
    const tags = openGraphTags({ url, title: 'RETROSPECT', artist: 'dBoy', description: 'd' });
    const byKey = Object.fromEntries(tags.map((tag) => [tag.property ?? tag.name, tag.content]));
    expect(byKey['og:title']).toBe('RETROSPECT by dBoy');
    expect(byKey['og:url']).toBe(url);
    expect(byKey['og:type']).toBe('music.album');
  });

  it('drops to a small card when there is no artwork, rather than a broken one', () => {
    const tags = openGraphTags({ url, title: 'T', artist: 'A', description: 'd' });
    const byKey = Object.fromEntries(tags.map((tag) => [tag.property ?? tag.name, tag.content]));
    expect(byKey['twitter:card']).toBe('summary');
    expect(byKey['og:image']).toBeUndefined();
  });

  it('uses a large card and alt text when artwork exists', () => {
    const tags = openGraphTags({
      url, title: 'T', artist: 'A', description: 'd', imageUrl: 'https://cdn/cover.jpg',
    });
    const byKey = Object.fromEntries(tags.map((tag) => [tag.property ?? tag.name, tag.content]));
    expect(byKey['twitter:card']).toBe('summary_large_image');
    expect(byKey['og:image']).toBe('https://cdn/cover.jpg');
    expect(byKey['og:image:alt']).toBe('Cover artwork for T by A');
  });
});
