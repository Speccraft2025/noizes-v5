import { describe, expect, it } from 'vitest';
import { embeddedExperiencePath, isEmbeddedExperience } from './experience-preview.js';

describe('embeddedExperiencePath', () => {
  it('builds the controls-free preview route for a release', () => {
    expect(embeddedExperiencePath({ artist_slug: 'jazel-dboy-isaac', slug: 'ovacado-ned' }))
      .toBe('/experience/jazel-dboy-isaac/ovacado-ned?embed=1');
  });

  it('does not create a broken preview route without both slugs', () => {
    expect(embeddedExperiencePath({ artist_slug: 'jazel-dboy-isaac' })).toBe('');
    expect(embeddedExperiencePath(null)).toBe('');
  });
});

describe('isEmbeddedExperience', () => {
  it('recognises only an explicit embed request', () => {
    expect(isEmbeddedExperience(new URL('https://noizes.xyz/experience/a/b?embed=1'))).toBe(true);
    expect(isEmbeddedExperience(new URL('https://noizes.xyz/experience/a/b'))).toBe(false);
    expect(isEmbeddedExperience(new URL('https://noizes.xyz/experience/a/b?embed=true'))).toBe(false);
  });
});
