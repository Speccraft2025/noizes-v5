import { describe, it, expect, beforeEach } from 'vitest';
import {
  JOURNEY_TEMPLATE,
  normalizeArtDirection,
  DEFAULT_ART_DIRECTION,
  buildJourneyHTML,
  assertTemplatePrebuilt,
  __setJourneySources,
} from './journey.js';
import { MARKERS } from '../experiences/journey/markers.js';
import { normalizeTemplate, EXPERIENCE_SYSTEMS, JOURNEY_TEMPLATE as PROJECT_JOURNEY } from './project.js';

const fakeTemplate = MARKERS
  .map(m => m.token)
  .join('\n')
  .replace('/* THREE_RUNTIME */', 'window.THREE=Object.assign({},{});')
  .replace('/* GSAP_RUNTIME */', '/* gsap already inlined */');

beforeEach(() => {
  __setJourneySources({
    template: fakeTemplate,
    styles: 'body{margin:0}',
    runtime: '/* journey runtime */',
  });
});

describe('template registration', () => {
  it('JOURNEY_TEMPLATE is in EXPERIENCE_SYSTEMS', () => {
    expect(EXPERIENCE_SYSTEMS).toContain(JOURNEY_TEMPLATE);
  });

  it('normalizeTemplate recognizes journey-v1', () => {
    expect(normalizeTemplate('journey-v1')).toBe('journey-v1');
  });

  it('JOURNEY_TEMPLATE matches project.js export', () => {
    expect(JOURNEY_TEMPLATE).toBe(PROJECT_JOURNEY);
  });
});

describe('normalizeArtDirection', () => {
  it('returns defaults for empty input', () => {
    const art = normalizeArtDirection({});
    expect(art.roadParticleCount).toBe(DEFAULT_ART_DIRECTION.roadParticleCount);
    expect(art.sideOffset).toBe(DEFAULT_ART_DIRECTION.sideOffset);
  });

  it('clamps out-of-range values', () => {
    const art = normalizeArtDirection({ sideOffset: 999, fogDensity: -1 });
    expect(art.sideOffset).toBe(12);
    expect(art.fogDensity).toBe(0.001);
  });

  it('validates color arrays', () => {
    const art = normalizeArtDirection({ topColor: 'invalid', midColor: [0.1, 0.2, 0.3] });
    expect(art.topColor).toEqual(DEFAULT_ART_DIRECTION.topColor);
    expect(art.midColor).toEqual([0.1, 0.2, 0.3]);
  });
});

describe('assertTemplatePrebuilt', () => {
  it('passes for a prebuilt template', () => {
    expect(() => assertTemplatePrebuilt(fakeTemplate)).not.toThrow();
  });

  it('throws for unfilled THREE_RUNTIME', () => {
    expect(() => assertTemplatePrebuilt('/* THREE_RUNTIME */')).toThrow('THREE_RUNTIME');
  });

  it('throws when window.THREE=Object.assign is missing', () => {
    expect(() => assertTemplatePrebuilt('some random html')).toThrow('no Three.js runtime');
  });
});

describe('buildJourneyHTML', () => {
  const baseInput = {
    identity: { title: 'Test Road', artist: 'Test Artist' },
    edition: { edition_id: 'ed-1', edition_name: 'First Edition' },
    analysis: { duration_seconds: 180, sections: [{ start: 0.3 }, { start: 0.7 }] },
    track: { track_id: 't-1', title: 'Track One', primary_artist: 'Test Artist', audio: { src: 'tracks/01/audio/primary.mp3', mime: 'audio/mpeg' } },
  };

  it('produces complete HTML with all markers filled', async () => {
    const result = await buildJourneyHTML(baseInput);
    expect(result.html).toContain('Test Road');
    expect(result.html).toContain('body{margin:0}');
    expect(result.html).toContain('/* journey runtime */');
    expect(result.html).not.toContain('/* JM_');
    expect(result.html).not.toContain('/* JOURNEY_');
  });

  it('throws without analysis', async () => {
    await expect(buildJourneyHTML({ ...baseInput, analysis: null })).rejects.toThrow('needs an analysis');
  });

  it('throws without audio source', async () => {
    await expect(buildJourneyHTML({ ...baseInput, track: { ...baseInput.track, audio: {} } })).rejects.toThrow('needs a packaged audio');
  });

  it('returns arcEnd from analysis duration', async () => {
    const result = await buildJourneyHTML(baseInput);
    expect(result.arcEnd).toBe(180);
  });

  it('respects arcEndSeconds override', async () => {
    const result = await buildJourneyHTML({ ...baseInput, arcEndSeconds: 120 });
    expect(result.arcEnd).toBe(120);
  });

  it('generates sections as sequence', async () => {
    const result = await buildJourneyHTML(baseInput);
    expect(result.sequence).toHaveLength(2);
    expect(result.sequence[0].start).toBe(0.3);
  });

  it('escapes HTML in title', async () => {
    const result = await buildJourneyHTML({
      ...baseInput,
      identity: { title: '</script><script>alert(1)', artist: 'Safe' },
    });
    expect(result.html).not.toContain('</script><script>');
    expect(result.html).toContain('&lt;/script&gt;');
  });
});
