import { describe, it, expect } from 'vitest';
import {
  bandEnergy, bytesToBase64, createPitchEstimator, estimatePitchDirect, fft, hann,
  median, movingAverage, normalise, pickPeaks, quantise, spectralCentroid,
  spectrogram, spectrogramChunked,
} from './dsp.js';

const SAMPLE_RATE = 22050;

function sine(length, hz, sampleRate = SAMPLE_RATE, amplitude = 1) {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = amplitude * Math.sin(2 * Math.PI * hz * i / sampleRate);
  return out;
}

function peakBin(mag, offset, bins) {
  let best = 0, bestValue = -Infinity;
  for (let b = 0; b < bins; b++) {
    if (mag[offset + b] > bestValue) { bestValue = mag[offset + b]; best = b; }
  }
  return best;
}

describe('fft', () => {
  it('puts a pure bin-k sinusoid entirely in bins k and n-k', () => {
    const n = 64, k = 7;
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.cos(2 * Math.PI * k * i / n);
    fft(re, im);
    const magnitude = i => Math.hypot(re[i], im[i]);
    // A real cosine of amplitude 1 splits into two conjugate bins of n/2 each.
    expect(magnitude(k)).toBeCloseTo(n / 2, 6);
    expect(magnitude(n - k)).toBeCloseTo(n / 2, 6);
    for (let i = 0; i < n; i++) {
      if (i === k || i === n - k) continue;
      expect(magnitude(i)).toBeLessThan(1e-9);
    }
  });

  it('is linear: the transform of a sum is the sum of the transforms', () => {
    const n = 32;
    const a = new Float64Array(n), b = new Float64Array(n);
    for (let i = 0; i < n; i++) { a[i] = Math.sin(i); b[i] = Math.cos(i * 0.3); }
    const sumRe = Float64Array.from(a, (v, i) => v + b[i]);
    const sumIm = new Float64Array(n);
    fft(sumRe, sumIm);

    const aRe = Float64Array.from(a), aIm = new Float64Array(n);
    const bRe = Float64Array.from(b), bIm = new Float64Array(n);
    fft(aRe, aIm); fft(bRe, bIm);
    for (let i = 0; i < n; i++) {
      expect(sumRe[i]).toBeCloseTo(aRe[i] + bRe[i], 9);
      expect(sumIm[i]).toBeCloseTo(aIm[i] + bIm[i], 9);
    }
  });
});

describe('hann', () => {
  it('starts at zero, peaks at the centre and is symmetric', () => {
    const w = hann(64);
    expect(w[0]).toBeCloseTo(0, 12);
    expect(w[32]).toBeCloseTo(1, 12);
    for (let i = 1; i < 32; i++) expect(w[i]).toBeCloseTo(w[64 - i], 12);
  });
});

describe('spectrogram', () => {
  it('reports the frame count implied by the hop and finds the tone', () => {
    const samples = sine(22050, 440);
    const { frames, bins, data } = spectrogram(samples, 2048, 512);
    expect(bins).toBe(1024);
    expect(frames).toBe(Math.floor((22050 - 2048) / 512) + 1);
    // 440 Hz at 22050 Hz over 2048 points sits at bin 440 * 2048 / 22050 = 40.9.
    expect(peakBin(data, 5 * bins, bins)).toBeGreaterThanOrEqual(40);
    expect(peakBin(data, 5 * bins, bins)).toBeLessThanOrEqual(41);
  });

  it('never reports fewer than one frame for a short buffer', () => {
    const { frames } = spectrogram(new Float32Array(100), 2048, 512);
    expect(frames).toBe(1);
  });

  it('chunked form computes exactly the same data and yields progress', () => {
    const samples = sine(40000, 300);
    const direct = spectrogram(samples, 2048, 512);
    const run = spectrogramChunked(samples, 2048, 512, 16);
    const progress = [];
    let step = run.next();
    while (!step.done) { progress.push(step.value); step = run.next(); }
    expect(progress.length).toBeGreaterThan(0);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
    expect(step.value.frames).toBe(direct.frames);
    expect(Array.from(step.value.data)).toEqual(Array.from(direct.data));
  });
});

describe('bandEnergy', () => {
  it('averages only the bins inside the requested range', () => {
    const bins = 1024;
    const mag = new Float32Array(bins);
    // Bin 93 is 1000 Hz at 22050 Hz / 2048.
    mag[93] = 4;
    const inside = bandEnergy(mag, 0, bins, SAMPLE_RATE, 2048, 900, 1100);
    const outside = bandEnergy(mag, 0, bins, SAMPLE_RATE, 2048, 2400, 6000);
    expect(inside).toBeGreaterThan(0);
    expect(outside).toBe(0);
  });
});

describe('spectralCentroid', () => {
  it('returns the frequency of the only populated bin', () => {
    const bins = 1024;
    const mag = new Float32Array(bins);
    mag[100] = 1;
    const centroid = spectralCentroid(mag, 0, bins, SAMPLE_RATE, 2048);
    expect(centroid).toBeCloseTo(100 * SAMPLE_RATE / 2048, 6);
  });

  it('returns zero for a silent frame rather than dividing by zero', () => {
    expect(spectralCentroid(new Float32Array(1024), 0, 1024, SAMPLE_RATE, 2048)).toBe(0);
  });
});

describe('pitch estimation', () => {
  it('recovers the fundamental of a synthetic tone', () => {
    const samples = sine(4096, 220);
    const estimator = createPitchEstimator({ size: 2048, sampleRate: SAMPLE_RATE, minHz: 110, maxHz: 700 });
    const { f0, confidence } = estimator.estimate(samples, 0);
    expect(f0).toBeGreaterThan(215);
    expect(f0).toBeLessThan(225);
    expect(confidence).toBeGreaterThan(0.9);
  });

  it('agrees with the direct O(size*lags) definition it replaces', () => {
    // Two harmonics plus noise, so the correlation surface has real structure and
    // the two routes could plausibly disagree on the argmax if the fast one were
    // computing a different quantity.
    const samples = new Float32Array(4096);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 196 * i / SAMPLE_RATE)
        + 0.5 * Math.sin(2 * Math.PI * 392 * i / SAMPLE_RATE)
        + 0.02 * Math.sin(i * 12.9898);
    }
    const estimator = createPitchEstimator({ size: 2048, sampleRate: SAMPLE_RATE, minHz: 110, maxHz: 700 });
    for (const start of [0, 512, 1024, 2048]) {
      const fast = estimator.estimate(samples, start);
      const direct = estimatePitchDirect(samples, start, 2048, SAMPLE_RATE, 110, 700);
      expect(fast.f0).toBeCloseTo(direct.f0, 6);
      expect(fast.confidence).toBeCloseTo(direct.confidence, 6);
    }
  });

  it('reports no pitch for a silent window', () => {
    const estimator = createPitchEstimator({ size: 2048, sampleRate: SAMPLE_RATE, minHz: 110, maxHz: 700 });
    expect(estimator.estimate(new Float32Array(4096), 0)).toEqual({ f0: 0, confidence: 0 });
    expect(estimatePitchDirect(new Float32Array(4096), 0, 2048, SAMPLE_RATE, 110, 700))
      .toEqual({ f0: 0, confidence: 0 });
  });
});

describe('movingAverage', () => {
  it('flattens an alternating signal towards its mean', () => {
    const values = new Float32Array(64);
    for (let i = 0; i < values.length; i++) values[i] = i % 2;
    const smoothed = movingAverage(values, 4);
    for (let i = 10; i < 50; i++) expect(smoothed[i]).toBeGreaterThan(0.4);
    for (let i = 10; i < 50; i++) expect(smoothed[i]).toBeLessThan(0.6);
  });

  it('leaves a constant signal unchanged', () => {
    const values = new Float32Array(32).fill(0.25);
    const smoothed = movingAverage(values, 3);
    for (let i = 0; i < smoothed.length; i++) expect(smoothed[i]).toBeCloseTo(0.25, 6);
  });
});

describe('median', () => {
  it('takes the middle of an odd count and the mean of the middle two of an even count', () => {
    expect(median(Float32Array.from([5, 1, 3]))).toBe(3);
    expect(median(Float32Array.from([4, 1, 3, 2]))).toBe(2.5);
  });
});

describe('normalise', () => {
  it('maps the requested percentile to 1 and clamps above it', () => {
    const values = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) values[i] = i / 1000;
    const out = normalise(values, 0.5);
    expect(out[500]).toBeCloseTo(1, 3);
    expect(out[999]).toBe(1);
    expect(out[250]).toBeCloseTo(0.5, 2);
  });

  it('survives an all-zero curve instead of dividing by zero', () => {
    const out = normalise(new Float32Array(16));
    expect(Array.from(out)).toEqual(new Array(16).fill(0));
  });
});

describe('pickPeaks', () => {
  it('finds separated peaks and respects the wait between them', () => {
    const curve = new Float32Array(200);
    for (const at of [30, 90, 150]) curve[at] = 1;
    const peaks = pickPeaks(curve, { window: 12, delta: 0.06, wait: 6 });
    expect(peaks).toEqual([30, 90, 150]);
  });

  it('rejects a second peak inside the wait window', () => {
    const curve = new Float32Array(200);
    curve[30] = 1;
    curve[33] = 1;
    const peaks = pickPeaks(curve, { window: 12, delta: 0.06, wait: 6 });
    expect(peaks).toEqual([30]);
  });

  it('finds nothing in a flat curve', () => {
    expect(pickPeaks(new Float32Array(100).fill(0.5))).toEqual([]);
  });
});

describe('base64', () => {
  it('matches Buffer for every remainder length', () => {
    for (const length of [0, 1, 2, 3, 4, 5, 255, 256, 257]) {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) bytes[i] = (i * 37 + 11) & 0xff;
      expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    }
  });

  it('quantises a 0..1 curve to one byte per frame', () => {
    const curve = Float32Array.from([0, 0.5, 1]);
    const encoded = quantise(curve);
    expect(Array.from(Buffer.from(encoded, 'base64'))).toEqual([0, 128, 255]);
  });

  it('clamps values outside 0..1 rather than wrapping', () => {
    const encoded = quantise(Float32Array.from([-1, 2]));
    expect(Array.from(Buffer.from(encoded, 'base64'))).toEqual([0, 255]);
  });
});
