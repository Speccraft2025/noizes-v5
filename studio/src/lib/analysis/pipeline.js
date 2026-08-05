// The analysis pipeline, shared verbatim by the worker and the main-thread
// fallback. Keeping it in one place is what guarantees a creator without module
// workers gets byte-identical output to one with them.

import { analyseSamplesChunked } from './terrain.js';
import { encodePng } from './encodePng.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * @param {Float32Array} samples   mono PCM
 * @param {object} options         forwarded to analyseSamplesChunked
 * @param {object} hooks
 * @param {(stage: string, progress: number) => void} hooks.onStage
 * @param {() => boolean} [hooks.shouldAbort]   polled between chunks
 * @param {number} [hooks.yieldEveryMs]         0 disables event-loop yielding
 *
 * @returns {Promise<{ terrainPng: Uint8Array, width: number, height: number, analysis: object }>}
 */
export async function runPipeline(samples, options, { onStage, shouldAbort = () => false, yieldEveryMs = 50 } = {}) {
  const run = analyseSamplesChunked(samples, options);
  let step = run.next();
  let lastYield = now();
  while (!step.done) {
    if (shouldAbort()) throw abortError();
    onStage?.(step.value.stage, step.value.progress);
    if (yieldEveryMs > 0 && now() - lastYield > yieldEveryMs) {
      await new Promise(resolve => setTimeout(resolve, 0));
      lastYield = now();
    }
    step = run.next();
  }
  if (shouldAbort()) throw abortError();

  const { terrainRGBA, width, height, analysis } = step.value;
  onStage?.('encode', 0);
  const terrainPng = await encodePng(width, height, terrainRGBA);
  onStage?.('encode', 1);
  if (shouldAbort()) throw abortError();

  return { terrainPng, width, height, analysis };
}

function abortError() {
  const error = new Error('Analysis cancelled.');
  error.name = 'AbortError';
  return error;
}
