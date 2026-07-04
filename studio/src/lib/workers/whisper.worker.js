import { pipeline, env } from '@huggingface/transformers';

// Fetch models from HF Hub, cache in browser Cache API
env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = 'Xenova/whisper-small';
let transcriber = null;

// ── alignment ───────────────────────────────────────────────────────────────
function norm(s) {
  return s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function alignLines(chunks, lyricLines) {
  const ww = chunks.map(c => ({
    word: norm(c.text),
    start: Math.round(c.timestamp[0] * 1000),
  }));

  const result = [];
  let searchFrom = 0;

  for (const line of lyricLines) {
    const lw = norm(line).split(' ').filter(Boolean);
    if (!lw.length) continue;

    let best = null;
    let bestScore = 0;

    for (let i = searchFrom; i < ww.length; i++) {
      let matched = 0;
      for (let j = 0; j < lw.length && i + j < ww.length; j++) {
        const a = ww[i + j].word, b = lw[j];
        if (a === b || a.includes(b) || b.includes(a)) matched++;
        else break;
      }
      const score = matched / lw.length;
      if (score > bestScore) { bestScore = score; best = i; }
      if (score === 1) break;
    }

    if (best !== null && bestScore > 0.25) {
      result.push({ t: ww[best].start, text: line });
      searchFrom = best + 1;
    } else {
      const prev = result[result.length - 1];
      result.push({ t: prev ? prev.t + 3000 : 0, text: line });
    }
  }

  return result;
}

// ── message handler ─────────────────────────────────────────────────────────
self.addEventListener('message', async ({ data }) => {
  const { type, audio, lyrics } = data;

  if (type === 'transcribe') {
    try {
      // Load model if not already loaded (cached after first download)
      if (!transcriber) {
        transcriber = await pipeline(
          'automatic-speech-recognition',
          MODEL_ID,
          {
            dtype: 'fp32',
            progress_callback: (p) => self.postMessage({ type: 'progress', data: p }),
          }
        );
      }

      self.postMessage({ type: 'status', message: 'Transcribing audio…' });

      const result = await transcriber(audio, {
        return_timestamps: 'word',
        chunk_length_s: 30,
        stride_length_s: 5,
        language: 'english',
      });

      const lines = lyrics.split('\n').map(l => l.trim()).filter(Boolean);
      const synced = alignLines(result.chunks || [], lines);

      self.postMessage({ type: 'result', synced });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }
});
