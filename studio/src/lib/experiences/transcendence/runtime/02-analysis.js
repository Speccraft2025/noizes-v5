/* AnalysisTrack — the recording's own description of itself.
 *
 * The payload is authored by scripts/analyze-transcendence.mjs and inlined into
 * the package as a JSON script block (the package CSP sets connect-src 'none',
 * so nothing may be fetched at runtime — and nothing needs to be).
 *
 * The runtime never opens a microphone, never runs an AnalyserNode against the
 * master, and never advances on a clock of its own. It asks this object what
 * the record is doing at audio.currentTime.
 */

class AnalysisTrack {
  constructor(payload) {
    this.payload = payload;
    this.frameRate = payload.frame_rate;
    this.frames = payload.frames;
    this.duration = payload.duration_seconds;
    this.sourceHash = payload.source.sha256;

    this.curves = {};
    for (const [name, encoded] of Object.entries(payload.curves)) {
      this.curves[name] = AnalysisTrack.decode(encoded);
    }

    this.onsets = payload.onsets;
    this.sections = payload.sections;
    this.phrases = payload.phrases;
    this.vocalPhrases = payload.vocal_phrases;
    this.lyrics = payload.lyrics;

    /* A GPU-uploadable copy: one row of RGBA per selected curve set, so the
     * vertex shaders can read the recording directly instead of receiving a
     * dozen uniforms per frame. */
    this.textureChannels = ['voice', 'low', 'brightness', 'loudness_short'];
  }

  static decode(base64) {
    const binary = atob(base64);
    const out = new Float32Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i) / 255;
    return out;
  }

  /** Linear-interpolated sample of a curve at a time in seconds. */
  at(name, seconds) {
    const curve = this.curves[name];
    if (!curve) return 0;
    const x = clamp(seconds * this.frameRate, 0, curve.length - 1.0001);
    const i = x | 0;
    const f = x - i;
    return curve[i] * (1 - f) + curve[i + 1] * f;
  }

  /** Mean of a curve over a window ending at `seconds` — used for inertia. */
  mean(name, seconds, window) {
    const curve = this.curves[name];
    if (!curve) return 0;
    const to = clamp(Math.round(seconds * this.frameRate), 0, curve.length - 1);
    const from = clamp(Math.round((seconds - window) * this.frameRate), 0, to);
    let sum = 0;
    for (let i = from; i <= to; i++) sum += curve[i];
    return sum / Math.max(1, to - from + 1);
  }

  /** Peak of a curve over a window — used where a transient must not be missed. */
  peak(name, seconds, window) {
    const curve = this.curves[name];
    if (!curve) return 0;
    const to = clamp(Math.round(seconds * this.frameRate), 0, curve.length - 1);
    const from = clamp(Math.round((seconds - window) * this.frameRate), 0, to);
    let max = 0;
    for (let i = from; i <= to; i++) if (curve[i] > max) max = curve[i];
    return max;
  }

  /**
   * Decaying response to the most recent onset. This is a pure function of
   * time — it looks *backwards* into the onset list rather than integrating
   * forwards — so seeking reproduces it exactly.
   */
  onsetEnergy(seconds, decay = 0.42, minStrength = 0.35) {
    let energy = 0;
    for (let i = this.onsets.length - 1; i >= 0; i--) {
      const onset = this.onsets[i];
      if (onset.t > seconds) continue;
      const age = seconds - onset.t;
      if (age > decay * 5) break;
      if (onset.strength < minStrength) continue;
      energy += onset.strength * Math.exp(-age / decay);
      if (energy > 4) break;
    }
    return Math.min(1.6, energy);
  }

  /** Seconds since the most recent onset at or before `seconds`. */
  sinceOnset(seconds) {
    for (let i = this.onsets.length - 1; i >= 0; i--) {
      if (this.onsets[i].t <= seconds) return seconds - this.onsets[i].t;
    }
    return seconds;
  }

  /** The lyric line active at a time, if any, plus its progress. */
  lyricAt(seconds) {
    for (let i = this.lyrics.length - 1; i >= 0; i--) {
      const line = this.lyrics[i];
      if (seconds >= line.aligned_seconds) {
        const end = line.phrase_end_seconds ?? line.aligned_seconds + 8;
        return { index: i, line, progress: clamp01((seconds - line.aligned_seconds) / Math.max(0.001, end - line.aligned_seconds)) };
      }
    }
    return null;
  }

  /**
   * Hand the decoded terrain image to the analysis object so the camera, the
   * Essential stage and the tests can read exactly the same landscape the
   * vertex shader reads. Without this the flight would be guessing at the
   * height of ground the GPU had already decided on.
   */
  setTerrainImage(pixels, width, height) {
    this.terrainPixels = pixels;
    this.terrainWidth = width;
    this.terrainHeight = height;
  }

  /** Bilinear sample of the terrain image. u = time fraction, v = band fraction. */
  terrainAt(u, v) {
    if (!this.terrainPixels) return { energy: 0, harmonic: 0, transient: 0, ridge: 0 };
    const w = this.terrainWidth, h = this.terrainHeight;
    const x = clamp(u, 0, 1) * (w - 1);
    // Row 0 of the image is the highest band.
    const y = (1 - clamp(v, 0, 1)) * (h - 1);
    const x0 = x | 0, y0 = y | 0;
    const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
    const fx = x - x0, fy = y - y0;
    const at = (px, py, c) => this.terrainPixels[(py * w + px) * 4 + c] / 255;
    const lerp2 = c =>
      (at(x0, y0, c) * (1 - fx) + at(x1, y0, c) * fx) * (1 - fy) +
      (at(x0, y1, c) * (1 - fx) + at(x1, y1, c) * fx) * fy;
    return { energy: lerp2(0), harmonic: lerp2(1), transient: lerp2(2), ridge: lerp2(3) };
  }

  /** Pack selected curves into RGBA bytes for a DataTexture. */
  toTextureData() {
    const width = this.frames;
    const data = new Uint8Array(width * 4);
    const [a, b, c, d] = this.textureChannels.map(name => this.curves[name]);
    for (let i = 0; i < width; i++) {
      data[i * 4] = (a[i] * 255) | 0;
      data[i * 4 + 1] = (b[i] * 255) | 0;
      data[i * 4 + 2] = (c[i] * 255) | 0;
      data[i * 4 + 3] = (d[i] * 255) | 0;
    }
    return { width, data };
  }
}
