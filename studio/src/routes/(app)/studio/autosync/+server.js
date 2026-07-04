import { json, error } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private';

// Normalize text for matching: lowercase, strip punctuation, collapse whitespace
function norm(s) {
  return s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Tokenize a string into words
function words(s) {
  return norm(s).split(' ').filter(Boolean);
}

// Given whisper word tokens [{word, start, end}] and lyric lines [string],
// find the best start timestamp (ms) for each line using sliding-window matching.
function alignLines(whisperWords, lyricLines) {
  // Normalize whisper words
  const ww = whisperWords.map(w => ({
    word: norm(w.word),
    start: Math.round(w.start * 1000),
  }));

  const result = [];
  let searchFrom = 0; // avoid going backwards — lyrics are sequential

  for (const line of lyricLines) {
    const lw = words(line);
    if (!lw.length) continue;

    // Try to find lw[0] in ww starting from searchFrom
    let best = null;
    let bestScore = 0;

    for (let i = searchFrom; i < ww.length; i++) {
      // Count how many consecutive lyric words match from position i
      let matched = 0;
      for (let j = 0; j < lw.length && i + j < ww.length; j++) {
        if (ww[i + j].word === lw[j] || ww[i + j].word.includes(lw[j]) || lw[j].includes(ww[i + j].word)) {
          matched++;
        } else {
          break;
        }
      }
      const score = matched / lw.length;
      if (score > bestScore) {
        bestScore = score;
        best = i;
        if (score === 1) break; // perfect match — stop
      }
    }

    if (best !== null && bestScore > 0.3) {
      result.push({ t: ww[best].start, text: line });
      searchFrom = best + 1;
    } else {
      // Fallback: estimate from previous + average line duration
      const prev = result[result.length - 1];
      const fallbackMs = prev ? prev.t + 3000 : 0;
      result.push({ t: fallbackMs, text: line });
    }
  }

  return result;
}

export async function POST({ request }) {
  if (!OPENAI_API_KEY) throw error(500, 'OPENAI_API_KEY not configured on server');

  const form = await request.formData();
  const audioFile = form.get('audio');
  const lyricsText = form.get('lyrics')?.toString() || '';

  if (!audioFile || audioFile.size === 0) throw error(400, 'No audio file');
  if (!lyricsText.trim()) throw error(400, 'No lyrics text');

  const lines = lyricsText.split('\n').map(l => l.trim()).filter(Boolean);

  // Call Whisper with word-level timestamps
  const whisperForm = new FormData();
  whisperForm.append('file', audioFile, audioFile.name || 'audio.mp3');
  whisperForm.append('model', 'whisper-1');
  whisperForm.append('response_format', 'verbose_json');
  whisperForm.append('timestamp_granularities[]', 'word');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: whisperForm,
  });

  if (!res.ok) {
    const msg = await res.text();
    throw error(502, `Whisper API error: ${msg}`);
  }

  const data = await res.json();
  const whisperWords = data.words || [];

  if (!whisperWords.length) {
    throw error(422, 'Whisper returned no word timestamps — check audio quality');
  }

  const synced = alignLines(whisperWords, lines);
  return json({ synced });
}
