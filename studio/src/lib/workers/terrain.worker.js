// Sonic Terrain analysis, off the main thread.
//
// The main thread decodes (OfflineAudioContext is not available in workers) and
// transfers the mono PCM here; everything expensive — spectrogram, filterbank,
// pitch, harmonic/percussive separation, terrain packing, PNG encoding — happens
// in this scope so the Experience step stays responsive and cancellable.
//
// Cancellation is cooperative: the main thread posts `cancel`, the pipeline sees
// it at the next chunk boundary and unwinds. index.js also terminates the worker,
// which is what actually frees the memory.

import { runPipeline } from '../analysis/pipeline.js';

let cancelled = false;

self.onmessage = async (event) => {
  const message = event.data;

  if (message?.type === 'cancel') {
    cancelled = true;
    return;
  }

  if (message?.type !== 'analyse') return;
  cancelled = false;

  try {
    const { terrainPng, width, height, analysis } = await runPipeline(message.samples, message.options, {
      onStage: (stage, progress) => self.postMessage({ type: 'progress', stage, progress }),
      shouldAbort: () => cancelled,
      // Nothing else runs in this scope, so there is no event loop to be polite to.
      yieldEveryMs: 0,
    });

    self.postMessage(
      { type: 'done', result: { terrainPng, terrainRGBA, width, height, analysis } },
      [terrainPng.buffer, terrainRGBA.buffer],
    );
  } catch (error) {
    if (error?.name === 'AbortError') self.postMessage({ type: 'cancelled' });
    else self.postMessage({ type: 'error', message: error?.message || String(error) });
  }
};
