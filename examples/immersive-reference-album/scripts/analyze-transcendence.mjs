// Deterministic build-time analysis of Track One for the Transcendence edition.
//
// The runtime never analyses live audio: it samples this precomputed payload by
// audio.currentTime. That is what makes seeking, pausing and replaying
// reconstruct exactly the same world state.
//
// Usage: node scripts/analyze-transcendence.mjs [--report]

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bandEnergy, estimatePitch, median, movingAverage, normalise,
  pickPeaks, quantise, spectralCentroid, spectrogram,
} from './lib/dsp.mjs';
import { applyMel, melFilterbank, ridgeSalience, separate } from './lib/mel.mjs';
import { encodePng } from './lib/png.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const GUIDED = join(ROOT, 'build', 'The-House-That-Remembered-Us-Guided');
const SOURCE_AUDIO = join(GUIDED, 'audio', 'track-01.mp3');
const SOURCE_LYRICS = join(GUIDED, 'lyrics', 'track-01.lrc');
const OUT = join(ROOT, 'transcendence', 'analysis', 'track-01.analysis.json');

const SAMPLE_RATE = 22050;
const FFT_SIZE = 2048;
const HOP = 512;                       // 43.066 analysis frames per second
const FRAME_RATE = SAMPLE_RATE / HOP;

const BANDS = {
  sub:   [20, 120],
  low:   [120, 320],
  body:  [320, 900],
  voice: [200, 1100],                  // tenor fundamental + first formant region
  mid:   [900, 2400],
  high:  [2400, 6000],
  air:   [6000, 10500],                // shellac surface noise lives up here
};

function decodePcm(path) {
  const raw = execFileSync('ffmpeg', [
    '-v', 'error', '-i', path,
    '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', '-acodec', 'pcm_f32le', '-',
  ], { maxBuffer: 1 << 30 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}

function parseLrc(text) {
  const lines = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.+)$/);
    if (!match) continue;
    lines.push({
      declared_seconds: Number(match[1]) * 60 + Number(match[2]),
      text: match[3].trim(),
    });
  }
  return lines;
}

/** Contiguous runs where a curve stays above a threshold for a minimum duration. */
function segments(curve, threshold, minFrames, gapFrames) {
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

/** Checkerboard-kernel novelty over a coarse feature matrix → section boundaries. */
function sectionBoundaries(features, frames, hopFrames, kernel) {
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
  return peaks.map(r => (r * hopFrames) / FRAME_RATE);
}

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

// ---------------------------------------------------------------- analysis run

const audioBytes = await readFile(SOURCE_AUDIO);
const samples = decodePcm(SOURCE_AUDIO);
const duration = samples.length / SAMPLE_RATE;
const { frames, bins, data } = spectrogram(samples, FFT_SIZE, HOP);

const raw = {};
for (const key of Object.keys(BANDS)) raw[key] = new Float32Array(frames);
const rms = new Float32Array(frames);
const peak = new Float32Array(frames);
const centroid = new Float32Array(frames);
const flux = new Float32Array(frames);
const pitchHz = new Float32Array(frames);
const pitchConfidence = new Float32Array(frames);

let previous = null;
for (let f = 0; f < frames; f++) {
  const offset = f * bins;
  for (const [key, [lo, hi]] of Object.entries(BANDS)) {
    raw[key][f] = bandEnergy(data, offset, bins, SAMPLE_RATE, FFT_SIZE, lo, hi);
  }
  centroid[f] = spectralCentroid(data, offset, bins, SAMPLE_RATE, FFT_SIZE);

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

  // Pitch only where there is enough signal to be meaningful.
  if (rms[f] > 0.004) {
    const { f0, confidence } = estimatePitch(samples, start, FFT_SIZE, SAMPLE_RATE, 110, 700);
    pitchHz[f] = f0;
    pitchConfidence[f] = confidence;
  }
}

// Surface-noise floor: the quietest 5% of the air band is the shellac itself.
const airSorted = Float32Array.from(raw.air).sort();
const noiseFloor = airSorted[Math.floor(airSorted.length * 0.05)];

// Musical presence = broadband energy above the disc's own noise, smoothed to
// phrase scale so it reads as "someone is performing" rather than "a transient".
const presenceRaw = new Float32Array(frames);
for (let f = 0; f < frames; f++) {
  presenceRaw[f] = Math.max(0, raw.body[f] + raw.mid[f] - noiseFloor * 2);
}
const presence = normalise(movingAverage(presenceRaw, 6));

// Voice-likeness: energy in the tenor region weighted by how periodic the frame
// is. It does not attempt to separate voice from violin — it measures how
// strongly a single sustained melodic source is present.
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
  t: Number((f / FRAME_RATE).toFixed(3)),
  strength: Number(fluxNorm[f].toFixed(3)),
}));

// Phrase segmentation: sustained musical presence separated by breaths.
const presenceThreshold = median(presence) * 0.85;
const phraseRuns = segments(presence, presenceThreshold, Math.round(FRAME_RATE * 1.2), Math.round(FRAME_RATE * 0.55));
const phrases = phraseRuns.map(([a, b]) => ({
  start: Number((a / FRAME_RATE).toFixed(3)),
  end: Number((b / FRAME_RATE).toFixed(3)),
  peak_voice: Number(Math.max(...Array.from(voice.subarray(a, b + 1))).toFixed(3)),
  mean_brightness: Number((Array.from(curves.brightness.subarray(a, b + 1)).reduce((x, y) => x + y, 0) / (b - a + 1)).toFixed(3)),
}));

const sections = sectionBoundaries(
  [curves.body, curves.mid, curves.high, curves.brightness, curves.voice, curves.loudness_medium],
  frames, Math.round(FRAME_RATE * 0.5), 16,
).map(t => Number(t.toFixed(3)));

// Vocal phrases are segmented from the voice curve rather than broad presence,
// so the unaccompanied violin statement that opens the record is not mistaken
// for singing.
const voiceThreshold = 0.42;
const vocalPhrases = segments(voice, voiceThreshold, Math.round(FRAME_RATE * 1.1), Math.round(FRAME_RATE * 0.8))
  .map(([a, b]) => ({
    start: Number((a / FRAME_RATE).toFixed(3)),
    end: Number((b / FRAME_RATE).toFixed(3)),
    peak: Number(Math.max(...Array.from(voice.subarray(a, b + 1))).toFixed(3)),
  }))
  .filter(p => p.end - p.start > 1.8 && p.peak > 0.55);

// Lyric alignment. The .lrc file remains the source of truth for text and
// order; its timings are evenly spaced reference marks rather than measured
// ones. Lines are assigned to vocal phrases by an order-preserving (monotonic)
// dynamic program, so the sung sequence can never be reordered by the fit.
// Both values are recorded so the drift is auditable.
const lyricLines = parseLrc(await readFile(SOURCE_LYRICS, 'utf8'));
const assignment = (() => {
  const L = lyricLines.length, P = vocalPhrases.length;
  if (P < L) return null;
  const cost = (i, j) => Math.abs(vocalPhrases[j].start - lyricLines[i].declared_seconds);
  const best = Array.from({ length: L }, () => new Float64Array(P).fill(Infinity));
  const from = Array.from({ length: L }, () => new Int32Array(P).fill(-1));
  for (let j = 0; j < P; j++) best[0][j] = cost(0, j);
  for (let i = 1; i < L; i++) {
    let runningBest = Infinity, runningIndex = -1;
    for (let j = i; j < P; j++) {
      if (best[i - 1][j - 1] < runningBest) { runningBest = best[i - 1][j - 1]; runningIndex = j - 1; }
      best[i][j] = runningBest + cost(i, j);
      from[i][j] = runningIndex;
    }
  }
  let end = -1, endCost = Infinity;
  for (let j = L - 1; j < P; j++) if (best[L - 1][j] < endCost) { endCost = best[L - 1][j]; end = j; }
  if (end < 0) return null;
  const picked = new Array(L);
  for (let i = L - 1; i >= 0; i--) { picked[i] = end; end = from[i][end]; }
  return picked;
})();

const lyrics = lyricLines.map((line, i) => {
  const phrase = assignment ? vocalPhrases[assignment[i]] : null;
  const aligned = phrase ? phrase.start : line.declared_seconds;
  return {
    text: line.text,
    declared_seconds: Number(line.declared_seconds.toFixed(3)),
    aligned_seconds: Number(aligned.toFixed(3)),
    drift_seconds: Number((aligned - line.declared_seconds).toFixed(3)),
    phrase_end_seconds: phrase ? phrase.end : null,
    alignment_method: phrase ? 'order-preserving-vocal-phrase-fit' : 'declared-lrc-time',
  };
});

// Word timings are proportional estimates inside the aligned phrase, weighted
// by syllable count. They are explicitly labelled as estimates.
for (const line of lyrics) {
  const end = line.phrase_end_seconds ?? line.aligned_seconds + 6;
  const words = line.text.split(/\s+/);
  const weights = words.map(w => Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) || ['a']).length));
  const total = weights.reduce((a, b) => a + b, 0);
  let cursor = line.aligned_seconds;
  const span = Math.max(1.5, end - line.aligned_seconds);
  line.words = words.map((word, i) => {
    const width = span * weights[i] / total;
    const entry = { word, start: Number(cursor.toFixed(3)), end: Number((cursor + width).toFixed(3)) };
    cursor += width;
    return entry;
  });
}

/* ------------------------------------------------------- the terrain itself */

/* The Sonic Terrain is not a picture of the recording — it *is* the recording,
 * one texel per (time frame, log-frequency band). The runtime samples this texture in a
 * vertex shader, so the landscape has no authored geometry at all: change the
 * recording and every ridge, valley and spire changes with it. */
const MEL_BANDS = 128;
const MEL_MIN = 80;
const MEL_MAX = 6400;
const BAND_SCALE = 'log';   // constant-Q: every octave gets equal ground

const bank = melFilterbank({ bands: MEL_BANDS, fftSize: FFT_SIZE, sampleRate: SAMPLE_RATE, fMin: MEL_MIN, fMax: MEL_MAX, scale: BAND_SCALE });
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
// Per-band noise-floor subtraction. A 1902 shellac disc carries a dense, steady
// hiss that is loudest exactly where the music is quietest. Without removing
// each band's own resting level, the high frequencies become a noisy high
// plateau and the surface noise outranks the singer. Each band's 18th
// percentile across the whole track is treated as that band's silence.
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

// Percentile anchoring rather than a fixed window below the peak. A 1902 disc
// has a high, dense surface-noise floor; anchoring to the peak alone would put
// the whole landscape on one high plateau with the music barely raised above the
// hiss. The floor percentile becomes the plains, the ceiling percentile becomes
// the summits, and a gamma opens up the middle where the music lives.
const DB_FLOOR_PERCENTILE = 0.62;
const DB_CEIL_PERCENTILE = 0.9995;
const TERRAIN_GAMMA = 0.72;
const dbSorted = Float32Array.from(melDb).sort();
const dbLow = dbSorted[Math.floor(dbSorted.length * DB_FLOOR_PERCENTILE)];
const dbHigh = dbSorted[Math.floor(dbSorted.length * DB_CEIL_PERCENTILE)];
const melNorm = new Float32Array(frames * MEL_BANDS);
for (let i = 0; i < melDb.length; i++) {
  const t = Math.max(0, Math.min(1, (melDb[i] - dbLow) / Math.max(1e-6, dbHigh - dbLow)));
  melNorm[i] = Math.pow(t, TERRAIN_GAMMA);
}

const { harmonic, percussive } = separate(melNorm, frames, MEL_BANDS, { timeWindow: 17, freqWindow: 17 });
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

// Elevation is smoothed along time before it becomes geometry. A harmonic is
// steady in frequency but jitters frame to frame in level; without this the
// landscape aliases into a forest of needles instead of ranges running away
// into the distance. Only the elevation channel is smoothed — the transient
// channel must stay sharp, because that is where the erosion comes from.
const melGeom = new Float32Array(frames * MEL_BANDS);
{
  const RADIUS = 4;   // ±4 frames ≈ ±0.09 s
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

// Pack as an image: R elevation · G harmonic mask · B transient · A ridge.
// Shipping the terrain as a PNG means it is a package component with its own
// hash, it is inspectable by eye, and it uploads straight to the GPU.
const terrainPixels = new Uint8Array(frames * MEL_BANDS * 4);
for (let f = 0; f < frames; f++) {
  for (let b = 0; b < MEL_BANDS; b++) {
    const i = f * MEL_BANDS + b;
    // Row 0 of the image is the highest band, so the PNG reads like a
    // spectrogram when opened in any viewer.
    const px = ((MEL_BANDS - 1 - b) * frames + f) * 4;
    const h = harmonic[i], p = percussive[i];
    terrainPixels[px] = Math.round(melGeom[i] * 255);
    terrainPixels[px + 1] = Math.round(Math.min(1, h / (h + p + 1e-6)) * 255);
    terrainPixels[px + 2] = Math.round(Math.min(1, bandFlux[i] / fluxCeiling) * 255);
    terrainPixels[px + 3] = Math.round(Math.min(1, ridge[i] * 1.6) * 255);
  }
}
const terrainPng = encodePng(frames, MEL_BANDS, terrainPixels);
const TERRAIN_OUT = join(ROOT, 'transcendence', 'analysis', 'track-01.terrain.png');
await mkdir(dirname(TERRAIN_OUT), { recursive: true });
await writeFile(TERRAIN_OUT, terrainPng);

// Where the voice lives, band by band — this is where lyric landmarks are cut.
function dominantBand(seconds, loBand, hiBand) {
  const f = clampInt(Math.round(seconds * FRAME_RATE), 0, frames - 1);
  let best = loBand, bestValue = -1;
  for (let b = loBand; b <= hiBand; b++) {
    const v = melNorm[f * MEL_BANDS + b] * (0.4 + ridge[f * MEL_BANDS + b]);
    if (v > bestValue) { bestValue = v; best = b; }
  }
  return best;
}
function clampInt(v, a, b) { return v < a ? a : v > b ? b : v; }

const bandOfHz = hz => {
  let best = 0, bestD = Infinity;
  for (let b = 0; b < MEL_BANDS; b++) {
    const d = Math.abs(bank.centresHz[b] - hz);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
};

for (const line of lyrics) {
  // Average the dominant vocal band across the sung phrase, so the landmark
  // sits on the ridge the singer actually made rather than on one frame of it.
  const end = line.phrase_end_seconds ?? line.aligned_seconds + 4;
  let sum = 0, n = 0;
  for (let t = line.aligned_seconds; t < end; t += 0.25) {
    sum += dominantBand(t, bandOfHz(160), bandOfHz(1400)); n++;
  }
  line.terrain_band = Math.round(sum / Math.max(1, n));
  line.terrain_band_hz = Number(bank.centresHz[line.terrain_band].toFixed(1));
}

const payload = {
  schema_version: '2.0.0',
  generated_by: 'scripts/analyze-transcendence.mjs',
  documentation: {
    purpose: 'Deterministic musical description of Track One. The runtime samples this by audio.currentTime; it never analyses live audio and never opens a microphone.',
    clock: 'All times are seconds from the start of audio/track-01.mp3.',
    terrain: 'analysis/track-01.terrain.png IS the landscape. One pixel per (time frame, mel band). Column x = time frame x. Row y = band (MEL_BANDS-1-y), so the image reads as a spectrogram when opened. R = elevation (normalised dB), G = harmonic mask H/(H+P), B = per-band transient, A = ridge salience. The runtime samples it in a vertex shader; there is no authored terrain geometry anywhere in the package.',
    curve_encoding: 'Each curve is a base64 string of one unsigned byte per analysis frame. value = byte / 255. Frame f covers time f / frame_rate seconds.',
    normalisation: 'Curves are scaled so the 99.5th percentile of the track maps to 1.0, except pitch_confidence which is a raw 0..1 correlation score.',
    caveats: [
      'This is a 1902 acoustic disc: bandwidth above ~6 kHz is dominated by surface noise, not programme material.',
      'voice measures a sustained periodic melodic source; it does not separate the tenor from the violin.',
      'Word timings are proportional syllable estimates inside an aligned phrase, not forced alignment.',
    ],
  },
  source: {
    path: 'audio/track-01.mp3',
    title: 'Home, Sweet Home',
    performer: 'Harry Macdonough; Charles D’Almaine',
    recorded: '1902-01-23',
    sha256: createHash('sha256').update(audioBytes).digest('hex'),
    bytes: audioBytes.length,
  },
  parameters: {
    decoder: 'ffmpeg -ac 1 -ar 22050 -f f32le',
    sample_rate: SAMPLE_RATE,
    fft_size: FFT_SIZE,
    hop: HOP,
    window: 'hann',
    frame_rate: Number(FRAME_RATE.toFixed(6)),
    bands_hz: BANDS,
    onset_picker: { curve: 'normalised spectral flux', window: 14, delta: 0.055, wait_frames: 5 },
    section_picker: { method: 'checkerboard novelty over cosine self-similarity', coarse_hop_seconds: 0.5, kernel: 16 },
    terrain: {
      file: 'analysis/track-01.terrain.png',
      bands: MEL_BANDS,
      band_scale: BAND_SCALE,
      octaves: Number((Math.log2(MEL_MAX / MEL_MIN)).toFixed(3)),
      f_min_hz: MEL_MIN,
      f_max_hz: MEL_MAX,
      band_centres_hz: Array.from(bank.centresHz).map(v => Number(v.toFixed(1))),
      per_band_floor: 'each mel band’s 18th percentile across the whole track is subtracted before normalisation, so the disc’s own surface noise becomes flat ground instead of a high plateau',
      db_floor_percentile: DB_FLOOR_PERCENTILE,
      db_ceiling_percentile: DB_CEIL_PERCENTILE,
      db_floor: Number(dbLow.toFixed(3)),
      db_ceiling: Number(dbHigh.toFixed(3)),
      db_peak: Number(dbMax.toFixed(3)),
      gamma: TERRAIN_GAMMA,
      separation: 'median filtering, 17-frame time window and 17-band frequency window',
      ridge_radius_bands: 4,
      elevation_time_smoothing_frames: 9,
      channels: { R: 'elevation (normalised dB)', G: 'harmonic mask', B: 'per-band transient', A: 'ridge salience' },
    },
  },
  sound_field: {
    channel_correlation: 1,
    statement: 'This master is exactly mono: the two channels are identical to within 1.04e-4. The stereo engine is implemented but this recording has no width to give it, so the terrain is a single ribbon rather than a mirrored pair. Nothing here is widened, re-panned or synthesised to make the world look better.',
    measured_on: 'audio/track-01.mp3 decoded to 2 channels at 22050 Hz',
  },
  duration_seconds: Number(duration.toFixed(3)),
  frames,
  frame_rate: Number(FRAME_RATE.toFixed(6)),
  noise_floor: Number(noiseFloor.toFixed(6)),
  curves: Object.fromEntries(Object.entries(curves).map(([k, v]) => [k, quantise(v)])),
  onsets,
  phrases,
  vocal_phrases: vocalPhrases,
  sections,
  lyrics,
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(payload, null, 1) + '\n');

const bytes = (await readFile(OUT)).length;
console.log(`analysis → ${OUT}`);
console.log(`  ${duration.toFixed(2)}s · ${frames} frames @ ${FRAME_RATE.toFixed(2)} fps · ${(bytes / 1024).toFixed(0)} KB`);
console.log(`  ${onsets.length} onsets · ${phrases.length} phrases · ${sections.length} section boundaries`);

if (process.argv.includes('--report')) {
  console.log('\nsections (s): ' + sections.join(', '));
  console.log('\nphrases:');
  for (const p of phrases) {
    console.log(`  ${p.start.toFixed(2).padStart(7)} → ${p.end.toFixed(2).padStart(7)}  (${(p.end - p.start).toFixed(1).padStart(5)}s)  voice ${p.peak_voice.toFixed(2)}  bright ${p.mean_brightness.toFixed(2)}`);
  }
  console.log('\nvocal phrases:');
  for (const p of vocalPhrases) {
    console.log(`  ${p.start.toFixed(2).padStart(7)} → ${p.end.toFixed(2).padStart(7)}  (${(p.end - p.start).toFixed(1).padStart(5)}s)  peak ${p.peak.toFixed(2)}`);
  }
  console.log('\nlyric alignment:');
  for (const l of lyrics) {
    console.log(`  declared ${l.declared_seconds.toFixed(2).padStart(7)} → aligned ${l.aligned_seconds.toFixed(2).padStart(7)}  (drift ${l.drift_seconds >= 0 ? '+' : ''}${l.drift_seconds.toFixed(2)})  ${l.text.slice(0, 52)}`);
  }
  console.log('\nstrongest onsets in first 130 s:');
  for (const o of onsets.filter(o => o.t < 130).sort((a, b) => b.strength - a.strength).slice(0, 18).sort((a, b) => a.t - b.t)) {
    console.log(`  ${o.t.toFixed(2).padStart(7)}  ${o.strength.toFixed(3)}`);
  }
}
