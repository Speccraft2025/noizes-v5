import { describe, it, expect } from 'vitest';
import { applyMel, hzToLog, logToHz, melFilterbank, ridgeSalience, separate, separateChunked } from './bands.js';

const SAMPLE_RATE = 22050;
const FFT_SIZE = 2048;

const bank = () => melFilterbank({
  bands: 128, fftSize: FFT_SIZE, sampleRate: SAMPLE_RATE, fMin: 80, fMax: 6400, scale: 'log',
});

describe('log frequency axis', () => {
  it('round-trips', () => {
    for (const hz of [80, 440, 1000, 6400]) expect(logToHz(hzToLog(hz))).toBeCloseTo(hz, 6);
  });

  it('gives every octave the same amount of ground', () => {
    const { centresHz } = bank();
    // Constant-Q means the ratio between adjacent centres is constant, not the gap.
    const ratios = [];
    for (let b = 1; b < centresHz.length; b++) ratios.push(centresHz[b] / centresHz[b - 1]);
    const first = ratios[0];
    for (const ratio of ratios) expect(ratio).toBeCloseTo(first, 4);
  });
});

describe('melFilterbank', () => {
  it('spans the requested range in ascending order', () => {
    const { centresHz } = bank();
    expect(centresHz.length).toBe(128);
    expect(centresHz[0]).toBeGreaterThan(80);
    expect(centresHz[127]).toBeLessThan(6400);
    for (let b = 1; b < 128; b++) expect(centresHz[b]).toBeGreaterThan(centresHz[b - 1]);
  });

  it('normalises each triangle so a flat spectrum gives a flat response', () => {
    const filterbank = bank();
    const flat = new Float32Array(FFT_SIZE / 2).fill(1);
    const out = new Float32Array(128);
    applyMel(filterbank, flat, 0, out);
    // Bands narrower than one FFT bin cannot integrate to exactly 1; every band
    // that covers at least one full bin must.
    for (let b = 40; b < 128; b++) expect(out[b]).toBeCloseTo(1, 5);
  });

  it('keeps every filter inside the spectrum it will be applied to', () => {
    const { starts, ends } = bank();
    for (let b = 0; b < 128; b++) {
      expect(starts[b]).toBeGreaterThanOrEqual(0);
      expect(ends[b]).toBeLessThan(FFT_SIZE / 2);
    }
  });

  it('places energy from a single bin in the band whose centre is nearest', () => {
    const filterbank = bank();
    const mag = new Float32Array(FFT_SIZE / 2);
    const bin = 93;                                    // ~1001 Hz
    mag[bin] = 1;
    const out = new Float32Array(128);
    applyMel(filterbank, mag, 0, out);
    let loudest = 0;
    for (let b = 1; b < 128; b++) if (out[b] > out[loudest]) loudest = b;
    expect(filterbank.centresHz[loudest]).toBeGreaterThan(900);
    expect(filterbank.centresHz[loudest]).toBeLessThan(1100);
  });
});

describe('separate', () => {
  // A sustained tone in one band across all time, plus one broadband click at a
  // single frame — the two things the terrain has to tell apart.
  const frames = 64, bands = 32;
  const build = () => {
    const S = new Float32Array(frames * bands);
    for (let f = 0; f < frames; f++) S[f * bands + 10] = 0.8;   // harmonic ridge
    for (let b = 0; b < bands; b++) S[30 * bands + b] = 0.9;    // percussive column
    return S;
  };

  it('assigns a sustained tone to the harmonic component', () => {
    const { harmonic, percussive } = separate(build(), frames, bands);
    const f = 20;
    expect(harmonic[f * bands + 10]).toBeGreaterThan(percussive[f * bands + 10]);
  });

  it('assigns a one-frame broadband click to the percussive component', () => {
    const { harmonic, percussive } = separate(build(), frames, bands);
    const b = 20;
    expect(percussive[30 * bands + b]).toBeGreaterThan(harmonic[30 * bands + b]);
  });

  it('leaves silence as silence in both components', () => {
    const { harmonic, percussive } = separate(new Float32Array(frames * bands), frames, bands);
    expect(harmonic.every(v => v === 0)).toBe(true);
    expect(percussive.every(v => v === 0)).toBe(true);
  });

  it('chunked form yields monotonic progress and identical output', () => {
    const S = build();
    const direct = separate(S, frames, bands);
    const run = separateChunked(S, frames, bands, { chunkSize: 4 });
    const progress = [];
    let step = run.next();
    while (!step.done) { progress.push(step.value); step = run.next(); }
    expect(progress.length).toBeGreaterThan(0);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
    expect(Array.from(step.value.harmonic)).toEqual(Array.from(direct.harmonic));
    expect(Array.from(step.value.percussive)).toEqual(Array.from(direct.percussive));
  });
});

describe('ridgeSalience', () => {
  const frames = 8, bands = 32;

  it('is high for a band standing above its neighbours', () => {
    const S = new Float32Array(frames * bands).fill(0.1);
    for (let f = 0; f < frames; f++) S[f * bands + 16] = 1;
    const ridge = ridgeSalience(S, frames, bands, 4);
    expect(ridge[3 * bands + 16]).toBeGreaterThan(0.7);
  });

  it('is near zero across a flat spectrum', () => {
    const S = new Float32Array(frames * bands).fill(0.4);
    const ridge = ridgeSalience(S, frames, bands, 4);
    for (let i = 0; i < ridge.length; i++) expect(ridge[i]).toBeLessThan(1e-6);
  });

  it('stays inside 0..1 for arbitrary input', () => {
    const S = new Float32Array(frames * bands);
    for (let i = 0; i < S.length; i++) S[i] = Math.abs(Math.sin(i * 1.7));
    const ridge = ridgeSalience(S, frames, bands, 4);
    for (let i = 0; i < ridge.length; i++) {
      expect(ridge[i]).toBeGreaterThanOrEqual(0);
      expect(ridge[i]).toBeLessThanOrEqual(1);
    }
  });
});
