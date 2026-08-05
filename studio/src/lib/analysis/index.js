// The only entry point into Sonic Terrain analysis.
//
// Everything downstream — the Experience step, the packager, the validator — talks
// to `analyseTrack` and nothing else. That boundary is what lets a server-side
// implementation be added later without touching the .nz format or the runtime:
// a future `remote` mode returns the same shape from the same call.

import { runPipeline } from './pipeline.js';
import { FRAME_RATE, MEL_BANDS, SAMPLE_RATE } from './terrain.js';
import { canDecodeAudio, decodeToMono } from './decode.js';

/** Stage order is part of the contract: progress never goes backwards. */
export const STAGES = ['decode', 'spectrum', 'bands', 'separation', 'terrain', 'encode'];

// Rough share of wall-clock time each stage takes on a four-minute track. Used
// only to turn per-stage progress into one honest overall percentage.
const STAGE_WEIGHTS = { decode: 8, spectrum: 24, bands: 26, separation: 24, terrain: 12, encode: 6 };
const TOTAL_WEIGHT = Object.values(STAGE_WEIGHTS).reduce((sum, w) => sum + w, 0);

export const STAGE_LABELS = {
  decode: 'Decoding audio',
  spectrum: 'Measuring the spectrum',
  bands: 'Folding into bands',
  separation: 'Separating harmonics from transients',
  terrain: 'Raising the terrain',
  encode: 'Encoding the terrain',
};

function overallPercent(stage, progress) {
  let before = 0;
  for (const name of STAGES) {
    if (name === stage) break;
    before += STAGE_WEIGHTS[name];
  }
  return Math.min(100, Math.round(((before + STAGE_WEIGHTS[stage] * clamp01(progress)) / TOTAL_WEIGHT) * 100));
}

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

export class AnalysisAbortError extends Error {
  constructor() {
    super('Analysis cancelled.');
    this.name = 'AbortError';
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new AnalysisAbortError();
}

export async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Analyse one track into a terrain image and an analysis payload.
 *
 * @param {File|Blob} file            the audio the creator selected
 * @param {object}    options
 * @param {(update: { stage: string, label: string, progress: number, percent: number }) => void} [options.onProgress]
 * @param {AbortSignal} [options.signal]
 * @param {object}    [options.source]   release metadata recorded in the payload
 * @param {Function}  [options.decode]   injectable decoder; defaults to OfflineAudioContext
 * @param {boolean}   [options.useWorker] run the DSP off the main thread when possible
 *
 * @returns {Promise<{ terrain: Blob, analysis: object,
 *                     meta: { durationSeconds: number, frameRate: number, frames: number,
 *                             bands: number, sourceSha256: string|null, sourceBytes: number|null } }>}
 */
export async function analyseTrack(file, {
  onProgress = () => {},
  signal = null,
  source = {},
  decode = decodeToMono,
  useWorker = true,
} = {}) {
  throwIfAborted(signal);
  const report = (stage, progress) => {
    onProgress({ stage, label: STAGE_LABELS[stage], progress: clamp01(progress), percent: overallPercent(stage, progress) });
  };

  report('decode', 0);
  const sourceBytes = await file.arrayBuffer();
  const sourceSha256 = await sha256Hex(sourceBytes);
  throwIfAborted(signal);

  const decoded = await decode(file, { sampleRate: SAMPLE_RATE });
  report('decode', 1);
  throwIfAborted(signal);

  const analysisOptions = {
    sampleRate: decoded.sampleRate ?? SAMPLE_RATE,
    soundField: decoded.soundField ?? null,
    source: { ...source, sha256: sourceSha256, bytes: sourceBytes.byteLength },
    producedBy: 'studio-local',
  };

  const runner = useWorker && canRunWorker() ? runInWorker : runInline;
  const { terrainPng, height, analysis } = await runner(decoded.samples, analysisOptions, { report, signal });
  throwIfAborted(signal);

  return {
    terrain: new Blob([terrainPng], { type: 'image/png' }),
    analysis,
    meta: {
      durationSeconds: analysis.duration_seconds,
      frameRate: analysis.frame_rate,
      frames: analysis.frames,
      bands: height,
      sourceSha256,
      sourceBytes: sourceBytes.byteLength,
    },
  };
}

function canRunWorker() {
  return typeof Worker === 'function' && typeof import.meta.url === 'string';
}

/**
 * Same computation on the main thread, yielding to the event loop between stages
 * so a cancel button still responds. Used when Worker is unavailable and by the
 * node-environment tests.
 */
function runInline(samples, analysisOptions, { report, signal }) {
  return runPipeline(samples, analysisOptions, {
    onStage: report,
    shouldAbort: () => Boolean(signal?.aborted),
    // Hand the event loop back periodically; without this a four-minute track
    // freezes the tab for the whole run and the cancel button never fires.
    yieldEveryMs: 50,
  });
}

/** The same computation in `workers/terrain.worker.js`, off the main thread. */
function runInWorker(samples, analysisOptions, { report, signal }) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('../workers/terrain.worker.js', import.meta.url), { type: 'module' });
    } catch (error) {
      // A bundler or CSP that refuses module workers must not cost the creator the
      // feature — fall back to the main thread rather than failing the analysis.
      runInline(samples, analysisOptions, { report, signal }).then(resolve, reject);
      return;
    }

    const finish = (fn, value) => {
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
      fn(value);
    };
    const onAbort = () => finish(reject, new AnalysisAbortError());
    signal?.addEventListener('abort', onAbort, { once: true });

    worker.onmessage = (event) => {
      const message = event.data;
      if (message.type === 'progress') report(message.stage, message.progress);
      else if (message.type === 'done') finish(resolve, message.result);
      else if (message.type === 'error') finish(reject, new Error(message.message));
    };
    worker.onerror = (event) => finish(reject, new Error(event.message || 'Terrain worker failed.'));

    // The PCM is transferred, not copied: a four-minute track is ~21 MB and
    // structured cloning it would double peak memory for no benefit. `samples` is
    // not read again on this side after the handoff.
    const buffer = samples.buffer;
    worker.postMessage({ type: 'analyse', samples, options: analysisOptions }, [buffer]);
  });
}

export { MEL_BANDS, SAMPLE_RATE, FRAME_RATE };
export { bandOfHz } from './terrain.js';
export { canDecodeAudio };
