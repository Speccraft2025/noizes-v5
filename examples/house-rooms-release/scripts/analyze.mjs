// Offline audio analysis: energy envelope, band balance, tempo, section changes.
import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SR = 11025, HOP = 256; // ~23ms frames
function pcm(file, filter) {
  const args = ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR)];
  if (filter) args.push('-af', filter);
  args.push('-f', 'f32le', '-');
  const b = execFileSync('ffmpeg', args, { maxBuffer: 1 << 30 });
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength >> 2);
}
function env(x) { const n = Math.floor(x.length / HOP), e = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < HOP; j++) { const v = x[i * HOP + j]; s += v * v; } e[i] = Math.sqrt(s / HOP); } return e; }
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
function perSecond(e) { const fps = SR / HOP, n = Math.floor(e.length / fps), o = []; for (let i = 0; i < n; i++) o.push(mean(e.subarray(Math.floor(i * fps), Math.floor((i + 1) * fps)))); return o; }
function flux(e) { const f = new Float32Array(e.length); for (let i = 1; i < e.length; i++) f[i] = Math.max(0, e[i] - e[i - 1]); return f; }
function tempo(f) { const fps = SR / HOP; let best = 0, bl = 0; for (let bpm = 60; bpm <= 180; bpm += 0.5) { const lag = 60 / bpm * fps; let s = 0; for (let i = 0; i + lag * 4 < f.length; i += 2) { const a = f[i]; s += a * (f[Math.round(i + lag)] + 0.5 * f[Math.round(i + lag * 2)] + 0.25 * f[Math.round(i + lag * 4)]); } if (s > best) { best = s; bl = bpm; } } return bl; }
const out = {};
for (const name of readdirSync(join(ROOT, 'source-audio')).filter(f => /\.(mp3|wav|flac|m4a)$/i.test(f)).sort()) {
  const file = join(ROOT, 'source-audio', name);
  const full = env(pcm(file)), low = env(pcm(file, 'lowpass=f=120')), high = env(pcm(file, 'highpass=f=3500')), mid = env(pcm(file, 'bandpass=f=1000:w=1400'));
  const sFull = perSecond(full), sLow = perSecond(low), sHigh = perSecond(high);
  const peak = Math.max(...sFull), norm = sFull.map(v => v / peak);
  const fl = flux(low), flh = flux(high);
  // percussion onset: first second where low-band flux density (kick-like transients) becomes sustained
  const fps = SR / HOP, thr = mean(Array.from(fl)) * 4, kicks = []; for (let i = 0; i < fl.length; i++) if (fl[i] > thr && (!kicks.length || i - kicks[kicks.length - 1] > fps * 0.15)) kicks.push(i);
  const kd = new Array(sFull.length).fill(0); kicks.forEach(k => { const s = Math.floor(k / fps); if (s < kd.length) kd[s]++; });
  let drumIn = null; for (let s = 0; s + 4 <= kd.length; s++) if (kd.slice(s, s + 4).every(v => v >= 1) && kd.slice(s, s + 4).reduce((a, b) => a + b) >= 6) { drumIn = s; break; }
  // section changes: largest jumps in 8s-smoothed energy
  const sm = norm.map((_, i) => mean(norm.slice(Math.max(0, i - 4), i + 4)));
  const jumps = []; for (let i = 8; i < sm.length - 8; i++) { const d = mean(norm.slice(i, i + 8)) - mean(norm.slice(i - 8, i)); jumps.push([i, d]); }
  const ups = [], downs = []; for (const [arr, sign] of [[ups, 1], [downs, -1]]) { const c = jumps.slice().sort((a, b) => sign * (b[1] - a[1])); for (const [i, d] of c) { if (sign * d < 0.08) break; if (arr.every(u => Math.abs(u.t - i) > 12)) arr.push({ t: i, delta: +d.toFixed(3) }); if (arr.length >= 5) break; } arr.sort((a, b) => a.t - b.t); }
  out[name] = {
    duration_s: +(full.length / fps).toFixed(2), bpm_estimate: tempo(fl.map((v, i) => v + flh[i])),
    rms_mean: +mean(sFull).toFixed(4), rms_peak_1s: +peak.toFixed(4),
    low_ratio: +(mean(sLow) / mean(sFull)).toFixed(3), high_ratio: +(mean(sHigh) / mean(sFull)).toFixed(3), mid_ratio: +(mean(perSecond(mid)) / mean(sFull)).toFixed(3),
    dynamic_spread: +(Math.sqrt(mean(norm.map(v => (v - mean(norm)) ** 2)))).toFixed(3),
    kick_density_per_s: +(kicks.length / (full.length / fps)).toFixed(2), percussion_onset_s: drumIn,
    energy_rises: ups, energy_drops: downs,
    energy_4s: norm.filter((_, i) => i % 4 === 0).map((_, i) => +mean(norm.slice(i * 4, i * 4 + 4)).toFixed(2)),
    kicks_4s: kd.filter((_, i) => i % 4 === 0).map((_, i) => kd.slice(i * 4, i * 4 + 4).reduce((a, b) => a + b, 0)),
    energy_1s: norm.map(v => +v.toFixed(3)),
  };
}
writeFileSync(join(ROOT, 'analysis', 'analysis.json'), JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) { const { energy_1s, ...r } = v; console.log(k, JSON.stringify(r)); }
