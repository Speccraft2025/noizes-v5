import { describe, it, expect } from 'vitest';
import {
  analyseSamples, bandOfHz, FRAME_RATE, MEL_BANDS, SAMPLE_RATE, SCHEMA_VERSION,
  sectionBoundaries, segments,
} from './terrain.js';

/**
 * A short synthetic recording with enough structure for every measurement to have
 * something to find: a sustained fundamental with a harmonic, an amplitude
 * envelope that opens and closes twice so there are phrases, and periodic clicks
 * so there are onsets.
 */
function fixture({ seconds = 6, sampleRate = SAMPLE_RATE } = {}) {
  const length = Math.round(seconds * sampleRate);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const envelope = t < 1 ? 0 : t < 2.5 ? 1 : t < 3.2 ? 0 : t < 5 ? 1 : 0;
    samples[i] = envelope * (
      0.6 * Math.sin(2 * Math.PI * 196 * t) +
      0.3 * Math.sin(2 * Math.PI * 392 * t) +
      0.1 * Math.sin(2 * Math.PI * 1174 * t)
    );
    // A click every half second, which is what the flux curve should pick up.
    if (i % Math.round(sampleRate / 2) === 0) samples[i] += 0.9;
  }
  return samples;
}

const decodeCurve = base64 => new Uint8Array(Buffer.from(base64, 'base64'));

describe('segments', () => {
  it('finds a run above the threshold and drops runs that are too short', () => {
    const curve = new Float32Array(100);
    for (let i = 10; i < 40; i++) curve[i] = 1;
    for (let i = 60; i < 62; i++) curve[i] = 1;
    const runs = segments(curve, 0.5, 10, 3);
    // 39 is the last frame above the threshold; the two-frame run at 60 is dropped.
    expect(runs).toEqual([[10, 39]]);
  });

  it('bridges a gap shorter than gapFrames instead of splitting the run', () => {
    const curve = new Float32Array(100);
    for (let i = 10; i < 40; i++) curve[i] = 1;
    curve[25] = 0;
    const runs = segments(curve, 0.5, 10, 3);
    expect(runs).toEqual([[10, 39]]);
  });

  it('closes an open run at the end of the curve', () => {
    const curve = new Float32Array(50);
    for (let i = 20; i < 50; i++) curve[i] = 1;
    expect(segments(curve, 0.5, 10, 3)).toEqual([[20, 49]]);
  });
});

describe('sectionBoundaries', () => {
  it('returns nothing when the track is shorter than the kernel needs', () => {
    const feature = new Float32Array(100).fill(0.5);
    expect(sectionBoundaries([feature], 100, 22, 16)).toEqual([]);
  });

  it('finds the boundary where the feature matrix changes character', () => {
    const frames = 4000, hopFrames = 10, kernel = 8;
    const a = new Float32Array(frames);
    const b = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      const secondHalf = f > frames / 2;
      a[f] = secondHalf ? 0.1 : 0.9;
      b[f] = secondHalf ? 0.9 : 0.1;
    }
    const found = sectionBoundaries([a, b], frames, hopFrames, kernel, FRAME_RATE);
    expect(found.length).toBeGreaterThan(0);
    const expected = (frames / 2) / FRAME_RATE;
    const closest = Math.min(...found.map(t => Math.abs(t - expected)));
    expect(closest).toBeLessThan(2);
  });
});

describe('bandOfHz', () => {
  it('picks the band whose centre is nearest the requested frequency', () => {
    const centres = Float32Array.from([100, 200, 400, 800]);
    expect(bandOfHz(centres, 90)).toBe(0);
    expect(bandOfHz(centres, 210)).toBe(1);
    expect(bandOfHz(centres, 500)).toBe(2);
    expect(bandOfHz(centres, 100000)).toBe(3);
  });
});

describe('analyseSamples', () => {
  const samples = fixture();
  const result = analyseSamples(samples, { source: { path: 'tracks/01-a/audio/primary.mp3' } });

  it('sizes the terrain as frames x bands', () => {
    expect(result.height).toBe(MEL_BANDS);
    expect(result.width).toBe(result.analysis.frames);
    expect(result.terrainRGBA.length).toBe(result.width * result.height * 4);
  });

  it('reports the duration and frame rate the clock depends on', () => {
    expect(result.analysis.duration_seconds).toBeCloseTo(6, 2);
    expect(result.analysis.frame_rate).toBeCloseTo(SAMPLE_RATE / 512, 4);
    expect(result.analysis.frames).toBe(Math.floor((samples.length - 2048) / 512) + 1);
  });

  it('publishes one byte per frame for every curve', () => {
    const curves = Object.entries(result.analysis.curves);
    expect(curves.length).toBeGreaterThan(10);
    for (const [name, encoded] of curves) {
      expect(decodeCurve(encoded).length, name).toBe(result.analysis.frames);
    }
  });

  it('keeps every terrain channel inside a byte and raises real elevation', () => {
    let maxElevation = 0;
    for (let i = 0; i < result.terrainRGBA.length; i += 4) {
      if (result.terrainRGBA[i] > maxElevation) maxElevation = result.terrainRGBA[i];
    }
    // Not a flat plain: the sustained tone has to stand above the floor.
    expect(maxElevation).toBeGreaterThan(128);
    expect(result.terrainRGBA.every(v => v >= 0 && v <= 255)).toBe(true);
  });

  it('records the band centres the UI needs to map a slider to frequency', () => {
    const centres = result.analysis.parameters.terrain.band_centres_hz;
    expect(centres.length).toBe(MEL_BANDS);
    expect(centres[0]).toBeGreaterThan(80);
    expect(centres[MEL_BANDS - 1]).toBeLessThan(6400);
  });

  it('finds onsets from the clicks and phrases from the envelope', () => {
    expect(result.analysis.onsets.length).toBeGreaterThan(2);
    expect(result.analysis.phrases.length).toBeGreaterThan(0);
    for (const onset of result.analysis.onsets) {
      expect(onset.t).toBeGreaterThanOrEqual(0);
      expect(onset.t).toBeLessThanOrEqual(result.analysis.duration_seconds);
    }
    for (const phrase of result.analysis.phrases) {
      expect(phrase.end).toBeGreaterThan(phrase.start);
    }
  });

  it('stamps the schema version and the producer', () => {
    expect(result.analysis.schema_version).toBe(SCHEMA_VERSION);
    expect(result.analysis.produced_by).toBe('studio-local');
    expect(result.analysis.parameters.terrain.channels.R).toMatch(/elevation/);
  });

  it('carries the source path into the documentation so the payload is self-describing', () => {
    expect(result.analysis.documentation.clock).toContain('tracks/01-a/audio/primary.mp3');
    expect(result.analysis.source.path).toBe('tracks/01-a/audio/primary.mp3');
  });

  it('publishes the pitch stride it actually used', () => {
    expect(result.analysis.parameters.pitch.stride_frames).toBe(4);
    expect(result.analysis.parameters.pitch.rms_gate).toBeGreaterThan(0);
  });
});

describe('determinism', () => {
  it('produces byte-identical terrain and payload for the same input', () => {
    const samples = fixture({ seconds: 4 });
    const first = analyseSamples(Float32Array.from(samples));
    const second = analyseSamples(Float32Array.from(samples));
    expect(Array.from(first.terrainRGBA)).toEqual(Array.from(second.terrainRGBA));
    expect(JSON.stringify(first.analysis)).toBe(JSON.stringify(second.analysis));
  });

  it('produces different terrain for different audio', () => {
    const a = analyseSamples(fixture({ seconds: 4 }));
    const shifted = fixture({ seconds: 4 });
    for (let i = 0; i < shifted.length; i++) shifted[i] *= 0.4;
    const b = analyseSamples(shifted);
    expect(Array.from(a.terrainRGBA)).not.toEqual(Array.from(b.terrainRGBA));
  });
});
