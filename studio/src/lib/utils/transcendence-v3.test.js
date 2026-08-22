import { beforeEach, describe, expect, it } from 'vitest';
import { sampleHeight, sampleSpectralDisplacement } from '../transcendence-v2/world/buildTerrainMesh.js';
import { extractGeographicHierarchy } from '../transcendence-v2/world/extractGeographicHierarchy.js';
import { buildSpectralJourney } from '../transcendence-v3/journey/buildSpectralJourney.js';
import { __setTranscendenceV2Sources } from './transcendence-v2.js';
import { buildTrackSpectralGeography, buildTranscendenceV3HTML } from './transcendence-v3.js';

const WIDTH = 192;
const HEIGHT = 64;

function spectrogram({ time = 0.25, band = 0.25 } = {}) {
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  const centerX = Math.round(time * (WIDTH - 1));
  const centerBand = Math.round(band * (HEIGHT - 1));
  for (let row = 0; row < HEIGHT; row += 1) {
    const sourceBand = HEIGHT - 1 - row;
    for (let frame = 0; frame < WIDTH; frame += 1) {
      const offset = (row * WIDTH + frame) * 4;
      const active = Math.abs(frame - centerX) < 18 && Math.abs(sourceBand - centerBand) < 7;
      rgba[offset] = active ? 245 : 12;
      rgba[offset + 1] = active ? 205 : 18;
      rgba[offset + 2] = active ? 225 : 10;
      rgba[offset + 3] = active ? 230 : 16;
    }
  }
  return { rgba, width: WIDTH, height: HEIGHT };
}

const analysis = {
  duration_seconds: 240,
  parameters: { terrain: { band_centres_hz: Array.from({ length: HEIGHT }, (_, index) => Math.round(35 * 1.105 ** index)) } },
};

describe('Transcendence V3 spectral geography', () => {
  beforeEach(() => {
    __setTranscendenceV2Sources({
      template: '<title>/* TXV2_TITLE */</title><style>/* TXV2_CSS */</style><script>/* THREE_RUNTIME */</script><script>window.__TXV2_CONFIG=/* TXV2_CONFIG */</script><script>/* TXV2_RUNTIME */</script>',
      styles: 'body{background:#102318}',
      three: 'window.THREE={};',
      runtime: 'window.__v3Booted=true;',
    });
  });

  it('is deterministic and bakes a continuous measured field and geographic journey', () => {
    const input = { trackId: 'spectral-track', analysis, terrainData: spectrogram() };
    const first = buildTrackSpectralGeography(input);
    const second = buildTrackSpectralGeography(input);

    expect(first).toEqual(second);
    expect(first.worldData.schema).toBe('transcendence-world-v3');
    expect(first.worldData.spectralField.data).toHaveLength(96 * 48 * 4);
    expect(first.geography.counts).toMatchObject({ ranges: 4, troughs: 3, basins: 3 });
    expect(first.journey.schema).toBe('transcendence-journey-v3-spectral');
    expect(first.journey.samples).toHaveLength(901);
    expect(first.journey.keyframes.every((frame, index, frames) => index === 0 || frame.at > frames[index - 1].at)).toBe(true);
  });

  it('moves localized geography when measured energy moves in time and frequency', () => {
    const earlyLow = buildTrackSpectralGeography({ trackId: 'same', analysis, terrainData: spectrogram({ time: 0.2, band: 0.18 }) });
    const lateHigh = buildTrackSpectralGeography({ trackId: 'same', analysis, terrainData: spectrogram({ time: 0.8, band: 0.82 }) });
    const earlyMassif = earlyLow.worldData.massifs[0];
    const lateMassif = lateHigh.worldData.massifs[0];

    expect(lateMassif.x).toBeGreaterThan(earlyMassif.x + 5000);
    expect(lateMassif.z).toBeGreaterThan(earlyMassif.z + 4000);
    expect(lateMassif.spectralSource.seconds).toBeGreaterThan(earlyMassif.spectralSource.seconds + 100);
    expect(lateMassif.spectralSource.hz).toBeGreaterThan(earlyMassif.spectralSource.hz);
  });

  it('uses the baked spectrogram itself as continuous surface displacement', () => {
    const built = buildTrackSpectralGeography({ trackId: 'surface', analysis, terrainData: spectrogram({ time: 0.3, band: 0.35 }) });
    const mapping = built.worldData.spectralField.worldMapping;
    const activeX = mapping.timeStartX + (mapping.timeEndX - mapping.timeStartX) * 0.3;
    const activeZ = mapping.lowBandZ + (mapping.highBandZ - mapping.lowBandZ) * 0.35;
    const quietX = mapping.timeStartX + (mapping.timeEndX - mapping.timeStartX) * 0.92;
    const quietZ = mapping.lowBandZ + (mapping.highBandZ - mapping.lowBandZ) * 0.08;

    expect(sampleSpectralDisplacement(built.worldData, activeX, activeZ))
      .toBeGreaterThan(sampleSpectralDisplacement(built.worldData, quietX, quietZ) + 50);
  });

  it('restores detail relief without changing macro landmarks or route anchors', () => {
    const built = buildTrackSpectralGeography({ trackId: 'relief', analysis, terrainData: spectrogram({ time: 0.42, band: 0.58 }) });
    const smoothWorld = {
      ...built.worldData,
      mesoAmplitude: 0,
      microAmplitude: 0,
      spectralAmplitude: 0,
      spectralDetailAmplitude: 0,
    };
    const smoothGeography = extractGeographicHierarchy(smoothWorld);
    const smoothJourney = buildSpectralJourney(smoothWorld, smoothGeography, (x, z) => sampleHeight(smoothWorld, x, z));
    const routeIdentity = (journey) => journey.keyframes.map((frame) => ({
      at: frame.at,
      landmarkId: frame.landmarkId,
      x: frame.position.x,
      z: frame.position.z,
    }));

    expect(built.worldData.mesoAmplitude).toBe(54);
    expect(built.worldData.microAmplitude).toBe(30);
    expect(built.worldData.spectralDetailAmplitude).toBe(64);
    expect(built.worldData.renderScale).toBe(1.8);
    expect(smoothGeography).toEqual(built.geography);
    expect(routeIdentity(smoothJourney)).toEqual(routeIdentity(built.journey));
  });

  it('assembles a labeled offline V3 experience with provenance', async () => {
    const result = await buildTranscendenceV3HTML({
      identity: { title: 'Measured World', artist: 'Creator' },
      track: { track_id: 'track-v3', audio: { src: 'tracks/track-v3/primary.wav', mime: 'audio/wav' } },
      analysis,
      terrainData: spectrogram(),
      timedLines: [{ t: 2600, text: 'Measured words' }],
      artDirection: { lyricFont: 'mono', lyricSize: 42, lyricColor: '#e0aa42', lyricWeight: 700, lyricAlign: 'center', lyricWidth: 62 },
    });

    expect(result.html).toContain('Measured World · Transcendence V3');
    expect(result.html).toContain('"version":"transcendence-v3"');
    expect(result.html).toContain('"timedLyrics":[{"at":2.6,"text":"Measured words"}]');
    expect(result.analysis.transcendence_v3.fidelity.classification).toBe('spectrogram-derived geography');
    expect(result.config.artDirection).toMatchObject({ lyricFont: 'mono', lyricSize: 42, lyricColor: '#e0aa42', lyricWeight: 700, lyricAlign: 'center', lyricWidth: 62 });
    expect(result.html).not.toContain('Ovacado');
  });
});
