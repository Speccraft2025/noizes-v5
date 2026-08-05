// Audio decode for the Sonic Terrain analyser.
//
// The reference build shells out to `ffmpeg -ac 1 -ar 22050 -f f32le`. Studio is a
// browser, so the equivalent is `decodeAudioData` on an OfflineAudioContext
// constructed at the analysis sample rate: decodeAudioData resamples to the
// context's rate, which covers the `-ar` half. It does not downmix, so the `-ac 1`
// half is done here by averaging channels.
//
// Main thread only. OfflineAudioContext is not exposed in worker scopes in any
// current browser, which is why the pipeline decodes here and hands raw PCM to
// the worker rather than handing it the file.

import { SAMPLE_RATE } from './terrain.js';

function offlineContextClass() {
  return globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext || null;
}

/** True when this scope can decode audio — false in workers and under vitest. */
export function canDecodeAudio() {
  return Boolean(offlineContextClass());
}

/**
 * Pearson correlation between the first two channels. The reference records this
 * so a listener can see whether the stereo engine has any width to work with, or
 * whether the master is genuinely mono. Nothing is widened to make the world look
 * better; the measurement is published either way.
 */
function channelCorrelation(left, right) {
  const n = Math.min(left.length, right.length);
  if (!n) return 1;
  let sumL = 0, sumR = 0;
  for (let i = 0; i < n; i++) { sumL += left[i]; sumR += right[i]; }
  const meanL = sumL / n, meanR = sumR / n;
  let cov = 0, varL = 0, varR = 0;
  for (let i = 0; i < n; i++) {
    const a = left[i] - meanL, b = right[i] - meanR;
    cov += a * b; varL += a * a; varR += b * b;
  }
  const denominator = Math.sqrt(varL * varR);
  return denominator > 1e-12 ? cov / denominator : 1;
}

/**
 * Decode a File/Blob to mono PCM at `sampleRate`.
 *
 * @returns {Promise<{ samples: Float32Array, sampleRate: number, durationSeconds: number,
 *                     channels: number, soundField: object }>}
 */
export async function decodeToMono(file, { sampleRate = SAMPLE_RATE } = {}) {
  const Ctx = offlineContextClass();
  if (!Ctx) throw new Error('This browser cannot decode audio: OfflineAudioContext is unavailable.');

  const encoded = await file.arrayBuffer();
  // decodeAudioData detaches the buffer it is given, and the caller still needs
  // the original bytes to hash the component. Hand it a copy.
  const context = new Ctx(1, 128, sampleRate);
  const decoded = await context.decodeAudioData(encoded.slice(0));

  const channels = decoded.numberOfChannels;
  const length = decoded.length;
  const samples = new Float32Array(length);
  if (channels === 1) {
    samples.set(decoded.getChannelData(0));
  } else {
    for (let c = 0; c < channels; c++) {
      const channel = decoded.getChannelData(c);
      for (let i = 0; i < length; i++) samples[i] += channel[i];
    }
    for (let i = 0; i < length; i++) samples[i] /= channels;
  }

  let soundField = {
    channel_correlation: 1,
    statement: 'Source is single-channel: the terrain is a single ribbon rather than a mirrored pair.',
    measured_on: `decoded at ${sampleRate} Hz`,
  };
  if (channels >= 2) {
    const correlation = channelCorrelation(decoded.getChannelData(0), decoded.getChannelData(1));
    soundField = {
      channel_correlation: Number(correlation.toFixed(6)),
      statement: correlation > 0.9995
        ? 'This master is effectively mono: the two channels are identical to within 5e-4. The stereo engine is implemented but this recording has no width to give it, so the terrain is a single ribbon rather than a mirrored pair.'
        : 'This master carries genuine stereo width. Nothing here is widened, re-panned or synthesised to make the world look better; the terrain reflects the measured field.',
      measured_on: `${channels} channels decoded at ${sampleRate} Hz`,
    };
  }

  return {
    samples,
    sampleRate,
    durationSeconds: length / sampleRate,
    channels,
    soundField,
    encodedBytes: encoded.byteLength,
  };
}
