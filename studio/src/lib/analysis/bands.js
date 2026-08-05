// Constant-Q filterbank, harmonic/percussive separation and ridge salience.
// Ported to the browser from examples/immersive-reference-album/scripts/lib/mel.mjs.
//
// The terrain is literally this data: one texel per (time frame, band). Nothing
// about the landscape is invented — its elevation is the recording's own energy,
// its ridges are the recording's own harmonics, and its erosion is the
// recording's own transients.

export const hzToMel = hz => 2595 * Math.log10(1 + hz / 700);
export const melToHz = mel => 700 * (Math.pow(10, mel / 2595) - 1);

// Constant-Q (log2) spacing. Mel is the right scale for speech features, but it
// spends most of its resolution below 1 kHz, which squeezes an entire piece of
// music into the left quarter of the world. Log spacing gives every octave the
// same amount of ground, which is what makes the frequency axis navigable.
export const hzToLog = hz => Math.log2(Math.max(1e-3, hz));
export const logToHz = v => Math.pow(2, v);

/**
 * Triangular filterbank on either a mel or a log2 frequency axis.
 * @returns {{ starts:Int32Array, ends:Int32Array, weights:Float32Array[], centresHz:Float32Array }}
 */
export function melFilterbank({ bands, fftSize, sampleRate, fMin, fMax, scale = 'log' }) {
  const fwd = scale === 'mel' ? hzToMel : hzToLog;
  const inv = scale === 'mel' ? melToHz : logToHz;
  const melMin = fwd(fMin), melMax = fwd(fMax);
  const points = new Float32Array(bands + 2);
  for (let i = 0; i < bands + 2; i++) {
    points[i] = inv(melMin + (melMax - melMin) * i / (bands + 1));
  }
  const binOf = hz => hz * fftSize / sampleRate;
  const starts = new Int32Array(bands);
  const ends = new Int32Array(bands);
  const weights = [];
  const centresHz = new Float32Array(bands);
  const nyquistBin = fftSize / 2;

  for (let b = 0; b < bands; b++) {
    const lo = binOf(points[b]), mid = binOf(points[b + 1]), hi = binOf(points[b + 2]);
    centresHz[b] = points[b + 1];
    const from = Math.max(0, Math.floor(lo));
    const to = Math.min(nyquistBin - 1, Math.ceil(hi));
    const w = new Float32Array(Math.max(0, to - from + 1));
    let sum = 0;
    for (let k = from; k <= to; k++) {
      let v = 0;
      if (k >= lo && k <= mid) v = mid > lo ? (k - lo) / (mid - lo) : 1;
      else if (k > mid && k <= hi) v = hi > mid ? (hi - k) / (hi - mid) : 1;
      w[k - from] = v;
      sum += v;
    }
    // Normalise so a flat spectrum gives a flat band response rather than a ramp.
    if (sum > 0) for (let i = 0; i < w.length; i++) w[i] /= sum;
    starts[b] = from; ends[b] = to; weights.push(w);
  }
  return { starts, ends, weights, centresHz };
}

/** Apply the filterbank to one magnitude frame. */
export function applyMel(bank, mag, offset, out) {
  for (let b = 0; b < out.length; b++) {
    const w = bank.weights[b];
    let sum = 0;
    for (let i = 0; i < w.length; i++) sum += mag[offset + bank.starts[b] + i] * w[i];
    out[b] = sum;
  }
  return out;
}

/**
 * Median of the first `count` entries of a scratch buffer, by insertion sort.
 *
 * The reference does `values.slice(0, count).sort(comparator)`, which allocates a
 * typed array and pays comparator call overhead 2.6 million times over a
 * four-minute track. Insertion sort over a window of 17 is faster than either,
 * allocates nothing, and returns the median of the same multiset — so the output
 * is identical, not merely close.
 */
function medianInPlace(buf, count) {
  for (let i = 1; i < count; i++) {
    const v = buf[i];
    let j = i - 1;
    while (j >= 0 && buf[j] > v) { buf[j + 1] = buf[j]; j--; }
    buf[j + 1] = v;
  }
  const mid = count >> 1;
  return count % 2 ? buf[mid] : (buf[mid - 1] + buf[mid]) / 2;
}

/**
 * Harmonic/percussive separation by median filtering.
 * Harmonic structure is smooth along time; percussive structure is smooth along
 * frequency. This is what lets the terrain distinguish a sustained vocal ridge
 * from a transient that erodes it.
 *
 * @param {Float32Array} S  frames * bands
 * @returns {{ harmonic: Float32Array, percussive: Float32Array }}
 */
export function separate(S, frames, bands, { timeWindow = 17, freqWindow = 17 } = {}) {
  const run = separateChunked(S, frames, bands, { timeWindow, freqWindow, chunkSize: Infinity });
  let step = run.next();
  while (!step.done) step = run.next();
  return step.value;
}

/**
 * Separation as a generator, yielding fractional progress so the worker can
 * report a live stage and honour cancellation. Identical output to `separate`.
 */
export function* separateChunked(S, frames, bands, { timeWindow = 17, freqWindow = 17, chunkSize = 16 } = {}) {
  const harmonic = new Float32Array(frames * bands);
  const percussive = new Float32Array(frames * bands);
  const halfT = timeWindow >> 1, halfF = freqWindow >> 1;
  const scratch = new Float32Array(Math.max(timeWindow, freqWindow));

  for (let b = 0; b < bands; b++) {
    for (let f = 0; f < frames; f++) {
      let n = 0;
      for (let k = -halfT; k <= halfT; k++) {
        const ff = f + k;
        if (ff < 0 || ff >= frames) continue;
        scratch[n++] = S[ff * bands + b];
      }
      harmonic[f * bands + b] = medianInPlace(scratch, n);
    }
    if (chunkSize !== Infinity && (b + 1) % chunkSize === 0) yield 0.5 * (b + 1) / bands;
  }
  for (let f = 0; f < frames; f++) {
    for (let b = 0; b < bands; b++) {
      let n = 0;
      for (let k = -halfF; k <= halfF; k++) {
        const bb = b + k;
        if (bb < 0 || bb >= bands) continue;
        scratch[n++] = S[f * bands + bb];
      }
      percussive[f * bands + b] = medianInPlace(scratch, n);
    }
    if (chunkSize !== Infinity && (f + 1) % (chunkSize * 32) === 0) yield 0.5 + 0.5 * (f + 1) / frames;
  }
  return { harmonic, percussive };
}

/**
 * How much a band stands above its immediate spectral neighbourhood.
 * This is what turns a harmonic series into a row of distinct parallel ridges
 * instead of one smooth swell.
 */
export function ridgeSalience(S, frames, bands, radius = 4) {
  const out = new Float32Array(frames * bands);
  for (let f = 0; f < frames; f++) {
    for (let b = 0; b < bands; b++) {
      const here = S[f * bands + b];
      let around = 0, n = 0;
      for (let k = -radius; k <= radius; k++) {
        if (!k) continue;
        const bb = b + k;
        if (bb < 0 || bb >= bands) continue;
        around += S[f * bands + bb]; n++;
      }
      around = n ? around / n : 0;
      out[f * bands + b] = Math.max(0, here - around) / (here + around + 1e-9);
    }
  }
  return out;
}
