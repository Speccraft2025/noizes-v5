// Compile-time audio/cover analysis (NZ_EXPERIENCE_SCHEMA.md §7).
// Runs in the browser at forge time — never at play time, never on a server.
// Every field is optional downstream: on any failure we return what we have
// and the visualizer degrades gracefully (live FFT → beat_grid → palette-only).

const HOP_S = 1;            // energy_curve sample rate: 1 Hz
const MAX_BEATS = 2000;     // schema cap on beat_grid entries
const ONSET_HOP = 2048;     // ~46 ms at 44.1 kHz — onset detection resolution

/** Decode + analyze audio bytes. Returns a partial analysis block or null. */
export async function analyzeAudioBuffer(arrayBuffer) {
  let audio;
  try {
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const probe = new Ctx(1, 1, 44100);
    // decodeAudioData detaches the buffer — hand it a copy
    audio = await probe.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    return null; // unsupported codec — analysis absent, template degrades
  }

  const sr = audio.sampleRate;
  const mono = mixToMono(audio);
  const durationMs = Math.round(audio.duration * 1000);

  // energy_curve: RMS per second, normalized 0–1
  const perSec = Math.floor(sr * HOP_S);
  const curve = [];
  for (let i = 0; i + 1 < mono.length; i += perSec) {
    const end = Math.min(i + perSec, mono.length);
    let sum = 0;
    for (let j = i; j < end; j++) sum += mono[j] * mono[j];
    curve.push(Math.sqrt(sum / (end - i)));
  }
  const peakRms = Math.max(...curve, 1e-6);
  const energyCurve = curve.map(v => Math.round((v / peakRms) * 100) / 100);
  const meanEnergy = energyCurve.reduce((a, b) => a + b, 0) / (energyCurve.length || 1);
  const energy = meanEnergy < 0.35 ? 'low' : meanEnergy < 0.6 ? 'medium' : 'high';

  // Onsets: positive energy flux peaks above mean + std
  const flux = [];
  let prev = 0;
  for (let i = 0; i + ONSET_HOP < mono.length; i += ONSET_HOP) {
    let sum = 0;
    for (let j = i; j < i + ONSET_HOP; j++) sum += mono[j] * mono[j];
    const e = Math.sqrt(sum / ONSET_HOP);
    flux.push(Math.max(0, e - prev));
    prev = e;
  }
  const fMean = flux.reduce((a, b) => a + b, 0) / (flux.length || 1);
  const fStd = Math.sqrt(flux.reduce((a, b) => a + (b - fMean) ** 2, 0) / (flux.length || 1));
  const thresh = fMean + fStd;
  const beatGrid = [];
  for (let i = 1; i < flux.length - 1 && beatGrid.length < MAX_BEATS; i++) {
    if (flux[i] > thresh && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]) {
      beatGrid.push(Math.round((i * ONSET_HOP / sr) * 1000));
    }
  }

  // BPM: median inter-onset interval folded into 60–180
  let bpm = null;
  if (beatGrid.length > 8) {
    const gaps = [];
    for (let i = 1; i < beatGrid.length; i++) {
      const g = beatGrid[i] - beatGrid[i - 1];
      if (g > 200 && g < 2000) gaps.push(g);
    }
    if (gaps.length > 4) {
      gaps.sort((a, b) => a - b);
      let candidate = 60000 / gaps[Math.floor(gaps.length / 2)];
      while (candidate < 60) candidate *= 2;
      while (candidate > 180) candidate /= 2;
      bpm = Math.round(candidate);
    }
  }

  return {
    engine: 'noizes-studio@1.0.0',
    rendition_id: 'main',
    duration_ms: durationMs,
    ...(bpm ? { detected_bpm: bpm } : {}),
    energy,
    beat_grid: beatGrid,
    energy_curve: energyCurve,
  };
}

/** Extract a 3-color palette from cover art (data URI source — no CORS taint). */
export function extractPalette(coverDataUrl) {
  return new Promise(resolve => {
    if (!coverDataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let rSum = 0, gSum = 0, bSum = 0, n = 0;
        let best = null, bestScore = -1;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          rSum += r; gSum += g; bSum += b; n++;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const score = sat * max; // vivid AND bright
          if (score > bestScore) { bestScore = score; best = [r, g, b]; }
        }
        const avg = [rSum / n, gSum / n, bSum / n].map(Math.round);
        const dark = avg.map(c => Math.round(c * 0.12));
        resolve({
          primary: hex(best || avg),
          secondary: hex(avg),
          background: hex(dark),
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = coverDataUrl;
  });
}

function mixToMono(audio) {
  if (audio.numberOfChannels === 1) return audio.getChannelData(0);
  const a = audio.getChannelData(0), b = audio.getChannelData(1);
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) / 2;
  return out;
}

function hex([r, g, b]) {
  return '#' + [r, g, b].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
}
