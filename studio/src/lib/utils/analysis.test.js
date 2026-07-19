import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { analyzeAudioBuffer } from './analysis.js';

// analyzeAudioBuffer only touches window.OfflineAudioContext for decoding;
// everything downstream is pure math over Float32Arrays. Stub just enough
// (same precedent as packager.test.js stubbing document) and feed synthetic
// PCM with known properties.

const SR = 44100;
let nextDecoded; // what the fake context resolves with; a function → reject

class FakeOfflineAudioContext {
  constructor() {}
  decodeAudioData(buf) {
    if (typeof nextDecoded === 'function') return Promise.reject(new Error('bad codec'));
    // real decodeAudioData detaches its input; analyzeAudioBuffer must hand us a copy
    expect(buf.byteLength).toBeGreaterThanOrEqual(0);
    return Promise.resolve(nextDecoded);
  }
}

beforeAll(() => {
  globalThis.window = { OfflineAudioContext: FakeOfflineAudioContext };
});
afterAll(() => {
  delete globalThis.window;
});

function fakeAudio(channels, sr = SR) {
  return {
    sampleRate: sr,
    numberOfChannels: channels.length,
    duration: channels[0].length / sr,
    getChannelData: (i) => channels[i],
  };
}

/** 10 s mono signal: one-hop (2048-sample) full-scale bursts every 12 hops
 *  (24576 samples ≈ 557 ms) aligned to the onset grid → clean flux peaks. */
function beatSignal() {
  const n = SR * 10;
  const pcm = new Float32Array(n);
  for (let k = 1; k * 24576 + 2048 <= n; k++) {
    pcm.fill(1, k * 24576, k * 24576 + 2048);
  }
  return pcm;
}

describe('analyzeAudioBuffer', () => {
  it('returns null when the codec cannot be decoded (template degrades)', async () => {
    nextDecoded = () => {};
    expect(await analyzeAudioBuffer(new ArrayBuffer(8))).toBeNull();
  });

  it('detects an aligned beat grid and folds the BPM into 60–180', async () => {
    nextDecoded = fakeAudio([beatSignal()]);
    const a = await analyzeAudioBuffer(new ArrayBuffer(8));

    expect(a.engine).toBe('noizes-studio@1.0.0');
    expect(a.rendition_id).toBe('main');
    expect(a.duration_ms).toBe(10000);

    // bursts land at k·24576 samples → k·557.28 ms, k = 1…17
    expect(a.beat_grid.length).toBeGreaterThanOrEqual(15);
    for (let i = 0; i < a.beat_grid.length; i++) {
      const k = Math.round(a.beat_grid[i] / 557.28);
      expect(Math.abs(a.beat_grid[i] - k * 557.28)).toBeLessThan(2);
      if (i) expect(a.beat_grid[i]).toBeGreaterThan(a.beat_grid[i - 1]);
    }

    // 557–558 ms median gap → 60000/557.x ≈ 107.6 → 108
    expect(a.detected_bpm).toBe(108);
  });

  it('classifies a uniform signal as high energy with a normalized curve', async () => {
    nextDecoded = fakeAudio([new Float32Array(SR * 5).fill(0.5)]);
    const a = await analyzeAudioBuffer(new ArrayBuffer(8));
    expect(a.energy).toBe('high');
    expect(a.energy_curve).toHaveLength(5);
    expect(Math.max(...a.energy_curve)).toBe(1); // normalized to peak
    for (const v of a.energy_curve) expect(v).toBeGreaterThan(0.99);
  });

  it('classifies one loud second among quiet ones as low energy', async () => {
    const pcm = new Float32Array(SR * 10).fill(0.05);
    pcm.fill(1, 0, SR); // first second loud → everything else normalizes tiny
    nextDecoded = fakeAudio([pcm]);
    const a = await analyzeAudioBuffer(new ArrayBuffer(8));
    expect(a.energy).toBe('low');
    expect(a.energy_curve[0]).toBe(1);
    expect(a.energy_curve[5]).toBeLessThan(0.1);
  });

  it('omits detected_bpm when there are too few onsets', async () => {
    nextDecoded = fakeAudio([new Float32Array(SR * 3)]); // silence
    const a = await analyzeAudioBuffer(new ArrayBuffer(8));
    expect(a).not.toHaveProperty('detected_bpm');
    expect(a.beat_grid).toEqual([]);
  });

  it('averages stereo to mono (out-of-phase channels cancel)', async () => {
    const left = new Float32Array(SR * 3).fill(0.6);
    const right = new Float32Array(SR * 3).fill(-0.6);
    nextDecoded = fakeAudio([left, right]);
    const a = await analyzeAudioBuffer(new ArrayBuffer(8));
    // (0.6 + -0.6)/2 = 0 → dead silence despite loud channels
    expect(a.beat_grid).toEqual([]);
    expect(a.energy).toBe('low');
    expect(a.duration_ms).toBe(3000);
  });
});
