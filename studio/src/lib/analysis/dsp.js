// Dependency-free DSP for the Sonic Terrain analyser, ported to the browser from
// examples/immersive-reference-album/scripts/lib/dsp.mjs.
//
// Everything here is deterministic: the same PCM always yields the same analysis
// payload, which is what lets the runtime reconstruct world state from
// audio.currentTime alone. Nothing in this module touches the DOM, Svelte or any
// Node built-in, so it runs unchanged on the main thread, in a worker and under
// vitest's node environment.

/** Iterative radix-2 complex FFT, in place. `re`/`im` are Float64Array of length n (power of two). */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k], uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe; im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe; im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

export function hann(size) {
  const w = new Float64Array(size);
  for (let i = 0; i < size; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / size);
  return w;
}

/** Magnitude spectrogram. Returns { frames, bins, data } with data[frame * bins + bin]. */
export function spectrogram(samples, fftSize, hop) {
  const window = hann(fftSize);
  const bins = fftSize / 2;
  const frames = Math.max(1, Math.floor((samples.length - fftSize) / hop) + 1);
  const data = new Float32Array(frames * bins);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    for (let i = 0; i < fftSize; i++) {
      re[i] = (samples[start + i] || 0) * window[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let b = 0; b < bins; b++) {
      data[f * bins + b] = Math.hypot(re[b], im[b]) / (fftSize / 2);
    }
  }
  return { frames, bins, data };
}

/**
 * Same spectrogram, yielding to the caller every `chunkFrames` frames so a worker
 * can report progress and honour cancellation without blocking for the whole run.
 * Returns the identical result to `spectrogram` — the generator only changes when
 * control returns to the event loop, never what is computed.
 */
export function* spectrogramChunked(samples, fftSize, hop, chunkFrames = 512) {
  const window = hann(fftSize);
  const bins = fftSize / 2;
  const frames = Math.max(1, Math.floor((samples.length - fftSize) / hop) + 1);
  const data = new Float32Array(frames * bins);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    for (let i = 0; i < fftSize; i++) {
      re[i] = (samples[start + i] || 0) * window[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let b = 0; b < bins; b++) {
      data[f * bins + b] = Math.hypot(re[b], im[b]) / (fftSize / 2);
    }
    if ((f + 1) % chunkFrames === 0) yield (f + 1) / frames;
  }
  return { frames, bins, data };
}

/** Sum of magnitudes between two frequencies, normalised by bin count. */
export function bandEnergy(mag, offset, bins, sampleRate, fftSize, lowHz, highHz) {
  const lo = Math.max(0, Math.round(lowHz * fftSize / sampleRate));
  const hi = Math.min(bins - 1, Math.round(highHz * fftSize / sampleRate));
  let sum = 0;
  for (let b = lo; b <= hi; b++) sum += mag[offset + b];
  return sum / Math.max(1, hi - lo + 1);
}

export function spectralCentroid(mag, offset, bins, sampleRate, fftSize) {
  let num = 0, den = 0;
  for (let b = 1; b < bins; b++) {
    const m = mag[offset + b];
    num += m * (b * sampleRate / fftSize);
    den += m;
  }
  return den > 1e-9 ? num / den : 0;
}

/**
 * Normalised autocorrelation pitch estimate, exactly as the reference build
 * defines it: score(lag) = corr(lag) / sqrt(normA * normB + 1e-12), maximised
 * over lag. O(size * lags) — kept as the definition of record and used to
 * validate the fast estimator below. Returns { f0, confidence }.
 */
export function estimatePitchDirect(samples, start, size, sampleRate, minHz, maxHz) {
  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.min(size - 1, Math.ceil(sampleRate / minHz));
  let mean = 0;
  for (let i = 0; i < size; i++) mean += samples[start + i] || 0;
  mean /= size;
  let energy = 0;
  for (let i = 0; i < size; i++) {
    const v = (samples[start + i] || 0) - mean;
    energy += v * v;
  }
  if (energy < 1e-8) return { f0: 0, confidence: 0 };
  let bestLag = 0, bestScore = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0, normA = 0, normB = 0;
    for (let i = 0; i + lag < size; i++) {
      const a = (samples[start + i] || 0) - mean;
      const b = (samples[start + i + lag] || 0) - mean;
      corr += a * b; normA += a * a; normB += b * b;
    }
    const score = corr / Math.sqrt(normA * normB + 1e-12);
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }
  return bestLag ? { f0: sampleRate / bestLag, confidence: Math.max(0, bestScore) } : { f0: 0, confidence: 0 };
}

/**
 * The same estimator computed in O(size log size) instead of O(size * lags).
 *
 * Why this exists: the reference build runs in Node with no deadline. Studio has
 * to finish a four-minute track inside 45 seconds in a browser tab, and the
 * direct estimator is the single most expensive thing in the pipeline — roughly
 * 170 lags x 2048 samples x 3 multiplies for every one of ~10,000 frames.
 *
 * The definition is unchanged. Only the arithmetic route differs:
 *   - corr(lag) for every lag at once, as the inverse transform of the power
 *     spectrum of the zero-padded, mean-removed frame (linear, not circular,
 *     autocorrelation — the padding to >= 2 * size is what guarantees that).
 *   - normA(lag) and normB(lag) in constant time each, from one prefix sum of
 *     squares: normA = P[size - lag], normB = P[size] - P[lag].
 *
 * Buffers are allocated once per estimator, not once per frame, because the
 * orchestrator calls this thousands of times.
 */
export function createPitchEstimator({ size, sampleRate, minHz, maxHz }) {
  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.min(size - 1, Math.ceil(sampleRate / minHz));
  let n = 1;
  while (n < size * 2) n <<= 1;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const prefix = new Float64Array(size + 1);   // prefix[k] = sum of x[i]^2 for i < k

  return {
    minLag,
    maxLag,
    fftSize: n,
    /** @returns {{ f0: number, confidence: number }} */
    estimate(samples, start) {
      let mean = 0;
      for (let i = 0; i < size; i++) mean += samples[start + i] || 0;
      mean /= size;

      re.fill(0); im.fill(0);
      let energy = 0;
      for (let i = 0; i < size; i++) {
        const v = (samples[start + i] || 0) - mean;
        re[i] = v;
        energy += v * v;
        prefix[i + 1] = energy;
      }
      if (energy < 1e-8) return { f0: 0, confidence: 0 };

      fft(re, im);
      // Power spectrum in place. It is real and even, so the forward transform of
      // it divided by n is its own inverse transform — one more fft, no conjugation.
      for (let k = 0; k < n; k++) {
        re[k] = re[k] * re[k] + im[k] * im[k];
        im[k] = 0;
      }
      fft(re, im);

      let bestLag = 0, bestScore = 0;
      for (let lag = minLag; lag <= maxLag; lag++) {
        const corr = re[lag] / n;
        const normA = prefix[size - lag];
        const normB = prefix[size] - prefix[lag];
        const score = corr / Math.sqrt(normA * normB + 1e-12);
        if (score > bestScore) { bestScore = score; bestLag = lag; }
      }
      return bestLag ? { f0: sampleRate / bestLag, confidence: Math.max(0, bestScore) } : { f0: 0, confidence: 0 };
    },
  };
}

export function movingAverage(values, radius) {
  const out = new Float32Array(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= 2 * radius + 1) sum -= values[i - 2 * radius - 1];
    const from = Math.max(0, i - 2 * radius);
    out[Math.max(0, i - radius)] = sum / (i - from + 1);
  }
  for (let i = values.length - radius; i < values.length; i++) out[i] = out[Math.max(0, values.length - radius - 1)];
  return out;
}

export function median(values) {
  const sorted = Float32Array.from(values).sort();
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function normalise(values, percentile = 0.995) {
  const sorted = Float32Array.from(values).sort();
  const ceiling = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentile))] || 1;
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = Math.min(1, values[i] / (ceiling || 1));
  return out;
}

/** Adaptive peak picking over an onset-strength curve. Returns frame indices. */
export function pickPeaks(curve, { window = 12, delta = 0.06, wait = 6 } = {}) {
  const peaks = [];
  let last = -Infinity;
  for (let i = 1; i < curve.length - 1; i++) {
    if (curve[i] <= curve[i - 1] || curve[i] < curve[i + 1]) continue;
    const from = Math.max(0, i - window), to = Math.min(curve.length, i + window);
    const local = curve.subarray(from, to);
    const threshold = median(local) + delta;
    if (curve[i] < threshold) continue;
    if (i - last < wait) continue;
    peaks.push(i);
    last = i;
  }
  return peaks;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Base64 without Buffer or btoa. btoa needs a binary string, which means either
 * a 1.3 MB intermediate string or chunked String.fromCharCode calls; both are
 * slower and neither is available in every worker scope. This is 20 lines and
 * byte-identical to Buffer#toString('base64').
 */
export function bytesToBase64(bytes) {
  let out = '';
  const whole = bytes.length - (bytes.length % 3);
  for (let i = 0; i < whole; i += 3) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += BASE64_ALPHABET[(v >> 18) & 63] + BASE64_ALPHABET[(v >> 12) & 63]
         + BASE64_ALPHABET[(v >> 6) & 63] + BASE64_ALPHABET[v & 63];
  }
  const rest = bytes.length - whole;
  if (rest === 1) {
    const v = bytes[whole] << 16;
    out += BASE64_ALPHABET[(v >> 18) & 63] + BASE64_ALPHABET[(v >> 12) & 63] + '==';
  } else if (rest === 2) {
    const v = (bytes[whole] << 16) | (bytes[whole + 1] << 8);
    out += BASE64_ALPHABET[(v >> 18) & 63] + BASE64_ALPHABET[(v >> 12) & 63]
         + BASE64_ALPHABET[(v >> 6) & 63] + '=';
  }
  return out;
}

/** Quantise a 0..1 curve to bytes for compact, GPU-uploadable storage. */
export function quantise(values) {
  const out = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) {
    out[i] = Math.max(0, Math.min(255, Math.round(values[i] * 255)));
  }
  return bytesToBase64(out);
}
