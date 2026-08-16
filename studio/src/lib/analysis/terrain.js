// Deterministic musical analysis of one track, and the Sonic Terrain computed
// from it. Ported to the browser from
// examples/immersive-reference-album/scripts/analyze-transcendence.mjs.
//
// The runtime never analyses live audio: it samples this precomputed payload by
// audio.currentTime. That is what makes seeking, pausing and replaying
// reconstruct exactly the same world state.
//
// Two deliberate departures from the reference script:
//
//   1. Lyric alignment is not done here. The reference fits lyrics to measured
//      vocal phrases; Studio takes timings from the Lyrics step and lets the
//      creator place landmarks by hand. `vocal_phrases` is still published, so a
//      later release can align against measurement without re-cutting the format.
//   2. Pitch is estimated on a stride and interpolated. See PITCH_STRIDE.
//
// Art direction lives in the experience config, never in here. Changing the
// palette or the sun angle must never require re-analysing the recording.

import {
  bandEnergy, createPitchEstimator, median, movingAverage, normalise,
  pickPeaks, quantise, spectralCentroid, spectrogramChunked,
} from './dsp.js';
import { applyMel, melFilterbank, ridgeSalience, separateChunked } from './bands.js';

export const SAMPLE_RATE = 22050;
export const FFT_SIZE = 2048;
export const HOP = 512;                          // 43.066 analysis frames per second
export const FRAME_RATE = SAMPLE_RATE / HOP;

export const MEL_BANDS = 128;
export const MEL_MIN = 80;
export const MEL_MAX = 6400;
export const BAND_SCALE = 'log';                 // constant-Q: every octave gets equal ground

export const SCHEMA_VERSION = '3.0.0';

const DB_FLOOR_PERCENTILE_SPARSE = 0.62;
const DB_FLOOR_PERCENTILE_DENSE = 0.32;
const DB_CEIL_PERCENTILE = 0.9995;
const TERRAIN_GAMMA_SPARSE = 0.72;
const TERRAIN_GAMMA_DENSE = 0.52;

// Pitch is the most expensive measurement in the pipeline by an order of
// magnitude. The voice curve it feeds is smoothed over +-4 frames (~0.19 s) and
// then normalised, so estimating every 4th frame (~10.8 Hz) and interpolating
// sits comfortably inside that smoothing while cutting the cost fourfold. The
// stride is published in `parameters` so the decision is auditable rather than
// hidden.
const PITCH_STRIDE = 4;
const PITCH_RMS_GATE = 0.004;

const BANDS_HZ = {
  sub:   [20, 120],
  low:   [120, 320],
  body:  [320, 900],
  voice: [200, 1100],                            // fundamental + first formant region
  mid:   [900, 2400],
  high:  [2400, 6000],
  air:   [6000, 10500],
};

/** Contiguous runs where a curve stays above a threshold for a minimum duration. */
export function segments(curve, threshold, minFrames, gapFrames) {
  const runs = [];
  let start = -1, gap = 0;
  for (let i = 0; i < curve.length; i++) {
    if (curve[i] >= threshold) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap > gapFrames) {
        if (i - gap - start >= minFrames) runs.push([start, i - gap]);
        start = -1; gap = 0;
      }
    }
  }
  if (start >= 0 && curve.length - start >= minFrames) runs.push([start, curve.length - 1]);
  return runs;
}

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

/** Checkerboard-kernel novelty over a coarse feature matrix -> section boundaries. */
export function sectionBoundaries(features, frames, hopFrames, kernel, frameRate = FRAME_RATE) {
  const rows = Math.floor(frames / hopFrames);
  const dim = features.length;
  const coarse = [];
  for (let r = 0; r < rows; r++) {
    const vec = new Float64Array(dim);
    for (let d = 0; d < dim; d++) {
      let sum = 0;
      for (let k = 0; k < hopFrames; k++) sum += features[d][r * hopFrames + k] || 0;
      vec[d] = sum / hopFrames;
    }
    let norm = 0;
    for (let d = 0; d < dim; d++) norm += vec[d] * vec[d];
    norm = Math.sqrt(norm) || 1;
    for (let d = 0; d < dim; d++) vec[d] /= norm;
    coarse.push(vec);
  }
  const novelty = new Float32Array(rows);
  for (let r = kernel; r < rows - kernel; r++) {
    let past = 0, future = 0, cross = 0;
    for (let i = 1; i <= kernel; i++) {
      for (let j = 1; j <= kernel; j++) {
        past += dot(coarse[r - i], coarse[r - j]);
        future += dot(coarse[r + i], coarse[r + j]);
        cross += dot(coarse[r - i], coarse[r + j]);
      }
    }
    novelty[r] = Math.max(0, (past + future) / 2 - cross) / (kernel * kernel);
  }
  const peaks = pickPeaks(normalise(novelty), { window: kernel * 2, delta: 0.12, wait: kernel });
  return peaks.map(r => (r * hopFrames) / frameRate);
}

/** Nearest terrain band to a frequency, for the UI's band <-> Hz slider. */
export function bandOfHz(centresHz, hz) {
  let best = 0, bestD = Infinity;
  for (let b = 0; b < centresHz.length; b++) {
    const d = Math.abs(centresHz[b] - hz);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

/**
 * The analysis run, as a generator.
 *
 * Yields `{ stage, progress }` between and inside the expensive passes so a
 * worker can report a live stage and abort between yields. The value returned on
 * completion is `{ terrainRGBA, width, height, analysis }`.
 *
 * @param {Float32Array} samples  mono PCM at `sampleRate`
 */
export function* analyseSamplesChunked(samples, {
  sampleRate = SAMPLE_RATE,
  source = {},
  soundField = null,
  producedBy = 'studio-local',
} = {}) {
  const frameRate = sampleRate / HOP;
  const duration = samples.length / sampleRate;

  /* ------------------------------------------------------------- spectrum */

  yield { stage: 'spectrum', progress: 0 };
  const spectro = spectrogramChunked(samples, FFT_SIZE, HOP);
  let step = spectro.next();
  while (!step.done) {
    yield { stage: 'spectrum', progress: step.value };
    step = spectro.next();
  }
  const { frames, bins, data } = step.value;

  /* ---------------------------------------------------- per-frame features */

  yield { stage: 'bands', progress: 0 };
  const raw = {};
  for (const key of Object.keys(BANDS_HZ)) raw[key] = new Float32Array(frames);
  const rms = new Float32Array(frames);
  const peak = new Float32Array(frames);
  const centroid = new Float32Array(frames);
  const flux = new Float32Array(frames);
  const bandEntries = Object.entries(BANDS_HZ);

  let previous = null;
  for (let f = 0; f < frames; f++) {
    const offset = f * bins;
    for (const [key, [lo, hi]] of bandEntries) {
      raw[key][f] = bandEnergy(data, offset, bins, sampleRate, FFT_SIZE, lo, hi);
    }
    centroid[f] = spectralCentroid(data, offset, bins, sampleRate, FFT_SIZE);

    let sum = 0, max = 0;
    const start = f * HOP;
    for (let i = 0; i < FFT_SIZE && start + i < samples.length; i++) {
      const v = samples[start + i];
      sum += v * v;
      if (Math.abs(v) > max) max = Math.abs(v);
    }
    rms[f] = Math.sqrt(sum / FFT_SIZE);
    peak[f] = max;

    if (previous) {
      let diff = 0;
      for (let b = 0; b < bins; b++) diff += Math.max(0, data[offset + b] - previous[b]);
      flux[f] = diff / bins;
    }
    previous = data.subarray(offset, offset + bins);

    if ((f + 1) % 1024 === 0) yield { stage: 'bands', progress: 0.5 * (f + 1) / frames };
  }

  /* ------------------------------------------------------------- pitch */

  // Pitch only where there is enough signal to be meaningful, on a stride, then
  // interpolated. The rms gate is applied per frame after interpolation so a
  // silent frame can never inherit confidence from a sung neighbour.
  const pitchHz = new Float32Array(frames);
  const pitchConfidence = new Float32Array(frames);
  {
    const estimator = createPitchEstimator({ size: FFT_SIZE, sampleRate, minHz: 110, maxHz: 700 });
    const anchorCount = Math.floor((frames - 1) / PITCH_STRIDE) + 1;
    const anchorHz = new Float32Array(anchorCount);
    const anchorConf = new Float32Array(anchorCount);
    for (let a = 0; a < anchorCount; a++) {
      const f = a * PITCH_STRIDE;
      if (rms[f] > PITCH_RMS_GATE) {
        const { f0, confidence } = estimator.estimate(samples, f * HOP);
        anchorHz[a] = f0;
        anchorConf[a] = confidence;
      }
      if ((a + 1) % 256 === 0) yield { stage: 'bands', progress: 0.5 + 0.5 * (a + 1) / anchorCount };
    }
    for (let f = 0; f < frames; f++) {
      if (rms[f] <= PITCH_RMS_GATE) continue;
      const a = f / PITCH_STRIDE;
      const lo = Math.min(anchorCount - 1, Math.floor(a));
      const hi = Math.min(anchorCount - 1, lo + 1);
      const t = a - lo;
      pitchHz[f] = anchorHz[lo] + (anchorHz[hi] - anchorHz[lo]) * t;
      pitchConfidence[f] = anchorConf[lo] + (anchorConf[hi] - anchorConf[lo]) * t;
    }
  }

  /* ------------------------------------------------------------- curves */

  // Surface-noise floor: the quietest 5% of the air band is the medium itself.
  const airSorted = Float32Array.from(raw.air).sort();
  const noiseFloor = airSorted[Math.floor(airSorted.length * 0.05)];

  // Musical presence = broadband energy above the recording's own noise, smoothed
  // to phrase scale so it reads as "someone is performing" rather than "a
  // transient".
  const presenceRaw = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    presenceRaw[f] = Math.max(0, raw.body[f] + raw.mid[f] - noiseFloor * 2);
  }
  const presence = normalise(movingAverage(presenceRaw, 6));

  // Voice-likeness: energy in the fundamental region weighted by how periodic the
  // frame is. It does not separate a voice from a melodic instrument — it measures
  // how strongly a single sustained melodic source is present.
  const voiceRaw = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    voiceRaw[f] = raw.voice[f] * Math.pow(Math.max(0, pitchConfidence[f]), 1.5);
  }
  const voice = normalise(movingAverage(voiceRaw, 4));

  const curves = {
    rms: normalise(rms),
    peak: normalise(peak),
    loudness_short: normalise(movingAverage(rms, 3)),      // ~0.15 s
    loudness_medium: normalise(movingAverage(rms, 32)),    // ~1.5 s
    sub: normalise(raw.sub), low: normalise(raw.low), body: normalise(raw.body),
    mid: normalise(raw.mid), high: normalise(raw.high), air: normalise(raw.air),
    voice,
    presence,
    flux: normalise(movingAverage(flux, 1)),
    // Brightness normalised on a log scale between 200 Hz and 6 kHz.
    brightness: (() => {
      const out = new Float32Array(frames);
      const lo = Math.log(200), hi = Math.log(6000);
      for (let f = 0; f < frames; f++) {
        out[f] = centroid[f] > 1 ? Math.min(1, Math.max(0, (Math.log(centroid[f]) - lo) / (hi - lo))) : 0;
      }
      return out;
    })(),
    pitch_confidence: normalise(pitchConfidence, 1),
  };

  // Onsets from spectral flux, reported with strength so cues can weight them.
  const fluxNorm = curves.flux;
  const onsetFrames = pickPeaks(fluxNorm, { window: 14, delta: 0.055, wait: 5 });
  const onsets = onsetFrames.map(f => ({
    t: Number((f / frameRate).toFixed(3)),
    strength: Number(fluxNorm[f].toFixed(3)),
  }));

  // Phrase segmentation: sustained musical presence separated by breaths.
  const presenceThreshold = median(presence) * 0.85;
  const phraseRuns = segments(presence, presenceThreshold, Math.round(frameRate * 1.2), Math.round(frameRate * 0.55));
  const phrases = phraseRuns.map(([a, b]) => ({
    start: Number((a / frameRate).toFixed(3)),
    end: Number((b / frameRate).toFixed(3)),
    peak_voice: Number(maxOf(voice, a, b).toFixed(3)),
    mean_brightness: Number(meanOf(curves.brightness, a, b).toFixed(3)),
  }));

  const sections = sectionBoundaries(
    [curves.body, curves.mid, curves.high, curves.brightness, curves.voice, curves.loudness_medium],
    frames, Math.round(frameRate * 0.5), 16, frameRate,
  ).map(t => Number(t.toFixed(3)));

  // Vocal phrases are segmented from the voice curve rather than broad presence,
  // so an unaccompanied instrumental statement is not mistaken for singing.
  const vocalPhrases = segments(voice, 0.42, Math.round(frameRate * 1.1), Math.round(frameRate * 0.8))
    .map(([a, b]) => ({
      start: Number((a / frameRate).toFixed(3)),
      end: Number((b / frameRate).toFixed(3)),
      peak: Number(maxOf(voice, a, b).toFixed(3)),
    }))
    .filter(p => p.end - p.start > 1.8 && p.peak > 0.55);

  /* ------------------------------------------------------- the terrain itself */

  /* The Sonic Terrain is not a picture of the recording — it *is* the recording,
   * one texel per (time frame, log-frequency band). The runtime samples this
   * texture in a vertex shader, so the landscape has no authored geometry at all:
   * change the recording and every ridge, valley and spire changes with it. */

  yield { stage: 'bands', progress: 1 };
  const bank = melFilterbank({
    bands: MEL_BANDS, fftSize: FFT_SIZE, sampleRate, fMin: MEL_MIN, fMax: MEL_MAX, scale: BAND_SCALE,
  });
  const mel = new Float32Array(frames * MEL_BANDS);
  {
    const row = new Float32Array(MEL_BANDS);
    for (let f = 0; f < frames; f++) {
      applyMel(bank, data, f * bins, row);
      mel.set(row, f * MEL_BANDS);
    }
  }

  // Decibel scaling: linear magnitude would give a landscape that is one spike
  // and a flat plain. Hearing is logarithmic and so is the terrain.
  const melDb = new Float32Array(frames * MEL_BANDS);
  let dbMax = -Infinity;
  for (let i = 0; i < mel.length; i++) {
    const db = 20 * Math.log10(mel[i] + 1e-8);
    melDb[i] = db;
    if (db > dbMax) dbMax = db;
  }
  // Per-band noise-floor subtraction. A noisy medium carries a dense, steady hiss
  // that is loudest exactly where the music is quietest. Without removing each
  // band's own resting level, the high frequencies become a noisy high plateau and
  // the surface noise outranks the performer. Each band's 18th percentile across
  // the whole track is treated as that band's silence.
  const bandFloorDb = new Float32Array(MEL_BANDS);
  {
    const column = new Float32Array(frames);
    for (let b = 0; b < MEL_BANDS; b++) {
      for (let f = 0; f < frames; f++) column[f] = melDb[f * MEL_BANDS + b];
      const sorted = Float32Array.from(column).sort();
      bandFloorDb[b] = sorted[Math.floor(sorted.length * 0.18)];
    }
    for (let f = 0; f < frames; f++) {
      for (let b = 0; b < MEL_BANDS; b++) melDb[f * MEL_BANDS + b] -= bandFloorDb[b];
    }
  }

  // Density detection: two signals combined.
  // 1) IQR-based spectral density — how tightly clustered is the energy after
  //    noise floor subtraction? Compressed pop → tight cluster → high density.
  // 2) Crest factor — peak / RMS of the raw waveform. Heavily compressed
  //    material has crest < 3; sparse classical is 5-10+.
  const dbSorted = Float32Array.from(melDb).sort();
  const dbMedian = dbSorted[Math.floor(dbSorted.length * 0.50)];
  const dbQ25 = dbSorted[Math.floor(dbSorted.length * 0.25)];
  const dbQ75 = dbSorted[Math.floor(dbSorted.length * 0.75)];
  const iqr = dbQ75 - dbQ25;
  const iqrDensity = Math.max(0, Math.min(1, 1 - iqr / Math.max(1e-6, Math.abs(dbMedian) + iqr)));

  let globalRms = 0, globalPeak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    globalRms += v * v;
    if (v > globalPeak) globalPeak = v;
  }
  globalRms = Math.sqrt(globalRms / samples.length);
  const crestFactor = globalPeak / Math.max(1e-10, globalRms);
  const crestDensity = Math.max(0, Math.min(1, 1 - (crestFactor - 2) / 5));

  const density = Math.max(iqrDensity, crestDensity);

  const DB_FLOOR_PERCENTILE = DB_FLOOR_PERCENTILE_SPARSE + (DB_FLOOR_PERCENTILE_DENSE - DB_FLOOR_PERCENTILE_SPARSE) * density;
  const TERRAIN_GAMMA = TERRAIN_GAMMA_SPARSE + (TERRAIN_GAMMA_DENSE - TERRAIN_GAMMA_SPARSE) * density;

  const dbLow = dbSorted[Math.floor(dbSorted.length * DB_FLOOR_PERCENTILE)];
  const dbHigh = dbSorted[Math.floor(dbSorted.length * DB_CEIL_PERCENTILE)];
  const melNorm = new Float32Array(frames * MEL_BANDS);
  for (let i = 0; i < melDb.length; i++) {
    const t = Math.max(0, Math.min(1, (melDb[i] - dbLow) / Math.max(1e-6, dbHigh - dbLow)));
    melNorm[i] = Math.pow(t, TERRAIN_GAMMA);
  }

  yield { stage: 'separation', progress: 0 };
  const separation = separateChunked(melNorm, frames, MEL_BANDS, { timeWindow: 17, freqWindow: 17 });
  let sepStep = separation.next();
  while (!sepStep.done) {
    yield { stage: 'separation', progress: sepStep.value };
    sepStep = separation.next();
  }
  const { harmonic, percussive } = sepStep.value;

  yield { stage: 'terrain', progress: 0 };
  const ridge = ridgeSalience(melNorm, frames, MEL_BANDS, 4);

  // Per-band onset: how sharply this band gained energy. Drives erosion and the
  // impulses that travel through the landscape.
  const bandFlux = new Float32Array(frames * MEL_BANDS);
  for (let f = 1; f < frames; f++) {
    for (let b = 0; b < MEL_BANDS; b++) {
      bandFlux[f * MEL_BANDS + b] = Math.max(0, melNorm[f * MEL_BANDS + b] - melNorm[(f - 1) * MEL_BANDS + b]);
    }
  }
  const fluxCeiling = (() => {
    const sorted = Float32Array.from(bandFlux).sort();
    return sorted[Math.floor(sorted.length * 0.999)] || 1;
  })();

  yield { stage: 'terrain', progress: 0.4 };

  // Elevation is smoothed along time before it becomes geometry. A harmonic is
  // steady in frequency but jitters frame to frame in level; without this the
  // landscape aliases into a forest of needles instead of ranges running away into
  // the distance. Only the elevation channel is smoothed — the transient channel
  // must stay sharp, because that is where the erosion comes from.
  const melGeom = new Float32Array(frames * MEL_BANDS);
  {
    const RADIUS = 4;   // +-4 frames ~ +-0.09 s
    for (let b = 0; b < MEL_BANDS; b++) {
      for (let f = 0; f < frames; f++) {
        let sum = 0, n = 0;
        for (let k = -RADIUS; k <= RADIUS; k++) {
          const ff = f + k;
          if (ff < 0 || ff >= frames) continue;
          sum += melNorm[ff * MEL_BANDS + b]; n++;
        }
        melGeom[f * MEL_BANDS + b] = sum / n;
      }
    }
  }

  yield { stage: 'terrain', progress: 0.8 };

  // Pack as an image: R elevation · G harmonic mask · B transient · A ridge.
  // Shipping the terrain as a PNG means it is a package component with its own
  // hash, it is inspectable by eye, and it uploads straight to the GPU.
  const terrainRGBA = new Uint8Array(frames * MEL_BANDS * 4);
  for (let f = 0; f < frames; f++) {
    for (let b = 0; b < MEL_BANDS; b++) {
      const i = f * MEL_BANDS + b;
      // Row 0 of the image is the highest band, so the PNG reads like a
      // spectrogram when opened in any viewer.
      const px = ((MEL_BANDS - 1 - b) * frames + f) * 4;
      const h = harmonic[i], p = percussive[i];
      terrainRGBA[px] = Math.round(melGeom[i] * 255);
      terrainRGBA[px + 1] = Math.round(Math.min(1, h / (h + p + 1e-6)) * 255);
      terrainRGBA[px + 2] = Math.round(Math.min(1, bandFlux[i] / fluxCeiling) * 255);
      terrainRGBA[px + 3] = Math.round(Math.min(1, ridge[i] * 1.6) * 255);
    }
  }

  yield { stage: 'terrain', progress: 1 };

  /* ------------------------------------------------------------ the payload */

  const audioPath = source.path || 'audio/track-01.mp3';
  const terrainPath = source.terrain_path || 'analysis/track-01.terrain.png';

  const analysis = {
    schema_version: SCHEMA_VERSION,
    produced_by: producedBy,
    generated_by: 'studio/src/lib/analysis/terrain.js',
    documentation: {
      purpose: 'Deterministic musical description of one track. The runtime samples this by audio.currentTime; it never analyses live audio and never opens a microphone.',
      clock: `All times are seconds from the start of ${audioPath}.`,
      terrain: `${terrainPath} IS the landscape. One pixel per (time frame, band). Column x = time frame x. Row y = band (${MEL_BANDS}-1-y), so the image reads as a spectrogram when opened. R = elevation (normalised dB), G = harmonic mask H/(H+P), B = per-band transient, A = ridge salience. The runtime samples it in a vertex shader; there is no authored terrain geometry anywhere in the package.`,
      curve_encoding: 'Each curve is a base64 string of one unsigned byte per analysis frame. value = byte / 255. Frame f covers time f / frame_rate seconds.',
      normalisation: 'Curves are scaled so the 99.5th percentile of the track maps to 1.0, except pitch_confidence which is a raw 0..1 correlation score.',
      caveats: [
        'voice measures a sustained periodic melodic source; it does not separate a singer from a melodic instrument.',
        `Pitch confidence is estimated every ${PITCH_STRIDE} frames and linearly interpolated, then gated by frame RMS.`,
        'Lyric landmark positions are creator-placed, not measured. vocal_phrases records where singing was actually detected.',
      ],
    },
    source: {
      path: audioPath,
      title: source.title || '',
      performer: source.performer || '',
      sha256: source.sha256 || null,
      bytes: source.bytes ?? null,
    },
    parameters: {
      decoder: `OfflineAudioContext decodeAudioData, downmixed to mono at ${sampleRate} Hz`,
      sample_rate: sampleRate,
      fft_size: FFT_SIZE,
      hop: HOP,
      window: 'hann',
      frame_rate: Number(frameRate.toFixed(6)),
      bands_hz: BANDS_HZ,
      pitch: { min_hz: 110, max_hz: 700, stride_frames: PITCH_STRIDE, rms_gate: PITCH_RMS_GATE, method: 'normalised autocorrelation via power spectrum' },
      onset_picker: { curve: 'normalised spectral flux', window: 14, delta: 0.055, wait_frames: 5 },
      section_picker: { method: 'checkerboard novelty over cosine self-similarity', coarse_hop_seconds: 0.5, kernel: 16 },
      terrain: {
        file: terrainPath,
        bands: MEL_BANDS,
        band_scale: BAND_SCALE,
        octaves: Number((Math.log2(MEL_MAX / MEL_MIN)).toFixed(3)),
        f_min_hz: MEL_MIN,
        f_max_hz: MEL_MAX,
        band_centres_hz: Array.from(bank.centresHz).map(v => Number(v.toFixed(1))),
        per_band_floor: "each band’s 18th percentile across the whole track is subtracted before normalisation, so the recording’s own surface noise becomes flat ground instead of a high plateau",
        density: Number(density.toFixed(3)),
        iqr_density: Number(iqrDensity.toFixed(3)),
        crest_factor: Number(crestFactor.toFixed(3)),
        crest_density: Number(crestDensity.toFixed(3)),
        density_adapted: "floor percentile and gamma are interpolated between sparse and dense presets; density is max(iqr, crest) so either compression signal triggers adaptation",
        db_floor_percentile: Number(DB_FLOOR_PERCENTILE.toFixed(3)),
        db_ceiling_percentile: DB_CEIL_PERCENTILE,
        db_floor: Number(dbLow.toFixed(3)),
        db_ceiling: Number(dbHigh.toFixed(3)),
        db_peak: Number(dbMax.toFixed(3)),
        gamma: Number(TERRAIN_GAMMA.toFixed(3)),
        separation: 'median filtering, 17-frame time window and 17-band frequency window',
        ridge_radius_bands: 4,
        elevation_time_smoothing_frames: 9,
        channels: { R: 'elevation (normalised dB)', G: 'harmonic mask', B: 'per-band transient', A: 'ridge salience' },
      },
    },
    sound_field: soundField,
    duration_seconds: Number(duration.toFixed(3)),
    frames,
    frame_rate: Number(frameRate.toFixed(6)),
    noise_floor: Number(noiseFloor.toFixed(6)),
    curves: Object.fromEntries(Object.entries(curves).map(([k, v]) => [k, quantise(v)])),
    onsets,
    phrases,
    vocal_phrases: vocalPhrases,
    sections,
  };

  return { terrainRGBA, width: frames, height: MEL_BANDS, analysis };
}

/** Run the whole analysis to completion, ignoring progress. Used by tests. */
export function analyseSamples(samples, options = {}) {
  const run = analyseSamplesChunked(samples, options);
  let step = run.next();
  while (!step.done) step = run.next();
  return step.value;
}

function maxOf(values, a, b) {
  let max = -Infinity;
  for (let i = a; i <= b; i++) if (values[i] > max) max = values[i];
  return max === -Infinity ? 0 : max;
}

function meanOf(values, a, b) {
  let sum = 0;
  for (let i = a; i <= b; i++) sum += values[i];
  return sum / Math.max(1, b - a + 1);
}
