import { beforeEach, describe, expect, it } from 'vitest';
import {
  __setTranscendenceV2Sources,
  buildTrackGeography,
  buildTranscendenceV2HTML,
} from './transcendence-v2.js';
import { extractRuntimeScripts } from './validateTranscendence.js';

const terrain = (offset = 0) => {
  const rgba = new Uint8Array(64 * 32 * 4);
  for (let index = 0; index < rgba.length; index += 4) {
    rgba[index] = (index * 17 + offset) % 256;
    rgba[index + 1] = (index * 7 + offset * 3) % 256;
    rgba[index + 2] = (index * 3 + offset * 5) % 256;
    rgba[index + 3] = 255;
  }
  return { rgba, width: 64, height: 32 };
};

describe('Transcendence V2 creator bake', () => {
  beforeEach(() => {
    __setTranscendenceV2Sources({
      template: '<title>/* TXV2_TITLE */</title><style>/* TXV2_CSS */</style><script>/* THREE_RUNTIME */</script><script>window.__TXV2_CONFIG=/* TXV2_CONFIG */</script><script>/* TXV2_RUNTIME */</script>',
      styles: 'body{background:#102318}',
      three: 'window.THREE={};',
      runtime: 'window.__v2Booted=true;',
    });
  });

  it('builds the same continuous geography and dense journey for identical analysis', () => {
    const input = { trackId: 'creator-track', analysis: { duration_seconds: 184.2 }, terrainData: terrain(12) };
    const first = buildTrackGeography(input);
    const second = buildTrackGeography(input);

    expect(first).toEqual(second);
    expect(first.worldData.schema).toBe('transcendence-world-v2');
    expect(first.geography.counts.ranges).toBeGreaterThanOrEqual(3);
    expect(first.geography.counts.troughs).toBeGreaterThanOrEqual(3);
    expect(first.geography.counts.peaks).toBeGreaterThanOrEqual(3);
    expect(first.journey.samples).toHaveLength(901);
    expect(first.journey.sequence).toEqual([
      'AERIAL_OVERVIEW', 'APPROACH', 'PEAK_TRAVERSE', 'DESCENT', 'TROUGH',
      'ASCENT', 'CREST', 'REVEAL', 'SECOND_TROUGH',
    ]);
  });

  it('uses each selected track to vary meso and micro articulation without changing topology', () => {
    const first = buildTrackGeography({ trackId: 'track-a', terrainData: terrain(3) });
    const second = buildTrackGeography({ trackId: 'track-b', terrainData: terrain(91) });

    expect(first.worldData.seed).not.toBe(second.worldData.seed);
    expect(first.worldData.noiseOffsetX).not.toBe(second.worldData.noiseOffsetX);
    expect(first.worldData.ranges).toHaveLength(second.worldData.ranges.length);
    expect(first.worldData.troughs).toHaveLength(second.worldData.troughs.length);
  });

  it('embeds creator identity, packaged audio, baked geography, and NED tracks offline', async () => {
    const result = await buildTranscendenceV2HTML({
      identity: { title: 'Creator World', artist: 'A. Producer' },
      track: { track_id: 'track-77', audio: { src: 'tracks/01-track-77/audio/master.wav', mime: 'audio/wav' } },
      analysis: { duration_seconds: 210 },
      terrainData: terrain(44),
      timedLines: [{ t: 1250, text: 'First light' }, { t: 4200, text: 'Across the ridge' }],
      directionTracks: { exposure: [{ time: 0, value: 0.9 }, { time: 210, value: 1.1 }] },
    });

    expect(result.html).toContain('Creator World · Transcendence V2');
    expect(result.html).toContain('tracks/01-track-77/audio/master.wav');
    expect(result.html).toContain('"directionTracks":{"exposure"');
    expect(result.config.timedLyrics).toEqual([{ at: 1.25, text: 'First light' }, { at: 4.2, text: 'Across the ridge' }]);
    expect(result.html).not.toContain('Ovacado');
    expect(result.arcEnd).toBe(210);
    expect(result.worldData.journey.samples).toHaveLength(901);
  });

  it('assembles the real offline runtime with every script parseable', async () => {
    __setTranscendenceV2Sources(null);
    const result = await buildTranscendenceV2HTML({
      identity: { title: 'Runtime Check', artist: 'Noizes Test' },
      track: { track_id: 'runtime-track', audio: { src: 'tracks/runtime/audio.wav', mime: 'audio/wav' } },
      analysis: { duration_seconds: 90 },
      terrainData: terrain(27),
    });
    const scripts = extractRuntimeScripts(result.html);
    expect(result.html.length).toBeGreaterThan(500_000);
    expect(result.html).not.toContain('Ovacado');
    expect(result.html).not.toContain('Jazel');
    expect(result.html).toContain('class="txv2-explore"');
    expect(result.html).toContain('class="txv2-archive-button"');
    expect(result.html).toContain('class="txv2-map"');
    expect(result.html).toContain('aria-label="Explore movement controls"');
    expect(result.html).toContain('Number(world.renderScale) || 1');
    expect(scripts.length).toBeGreaterThanOrEqual(3);
    for (const source of scripts) expect(() => new Function(source)).not.toThrow();
  });
});
