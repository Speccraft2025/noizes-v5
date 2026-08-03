/* EssentialStage — the edition without a GPU.
 *
 * Not a degraded build and not an apology screen: the same arc, the same clock,
 * the same cue engine and the same terrain data, drawn in Canvas 2D as a
 * raked-light relief of the recording. The lyric is real text in the document,
 * so a screen reader gets the poem rather than a description of a picture of
 * the poem.
 *
 * It runs when WebGL is unavailable or has been lost, and whenever the listener
 * chooses it.
 */

class EssentialStage {
  constructor(canvas, options) {
    this.canvas = canvas;
    this.analysis = options.analysis;
    this.reducedMotion = !!options.reducedMotion;
    this.highContrast = !!options.highContrast;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.stats = { drawCalls: 1, triangles: 0, points: 0, sceneDrawCalls: 1, sceneTriangles: 0 };
  }

  resize(width, height, dpr) {
    this.dpr = Math.min(dpr, 2);
    this.width = width;
    this.height = height;
    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
  }

  render(f) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const t = f.time;
    const hc = this.highContrast;

    // Sky.
    const bright = this.analysis.mean('brightness', t, 1.5);
    const medium = this.analysis.mean('loudness_medium', t, 2.0);
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, hc ? '#000' : `rgb(${12 + bright * 14 | 0},${16 + bright * 18 | 0},${28 + bright * 26 | 0})`);
    sky.addColorStop(1, hc ? '#111' : `rgb(${34 + medium * 30 | 0},${28 + medium * 22 | 0},${26 + medium * 16 | 0})`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // The recording drawn as a raked-light relief: one profile line per slice
    // of time, receding toward the horizon. Painter's order, far to near.
    const horizon = H * 0.42;
    const lines = this.reducedMotion ? 44 : 70;
    const bands = 96;
    const duration = this.analysis.duration;

    for (let i = lines - 1; i >= 0; i--) {
      // Distance ahead of the playhead, quadratically spaced.
      const d = Math.pow(i / lines, 1.8);
      const seconds = t + d * 46;
      if (seconds > duration) continue;

      const depth = 1 - d;                       // 1 = nearest
      const y0 = horizon + Math.pow(depth, 1.35) * (H - horizon) * 0.98;
      const scale = 0.20 + depth * 1.5;
      const alpha = 0.10 + depth * 0.75;

      ctx.beginPath();
      for (let b = 0; b <= bands; b++) {
        const bandFraction = b / bands;
        const T = this.analysis.terrainAt(seconds / duration, bandFraction);
        const mass = 1.45 + (0.48 - 1.45) * Math.pow(bandFraction, 0.70);
        const h = Math.max(3.4, Math.pow(T.energy, 1.75) * mass * 46 + T.ridge * T.energy * 8);
        const x = (bandFraction - 0.5) * W * (0.45 + depth * 1.25) + W / 2;
        const y = y0 - h * scale * (H / 900);
        if (b === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(W * 2, H); ctx.lineTo(-W, H); ctx.closePath();

      // Frequency colours the ground the same way it does in the rendered world.
      const warm = 30 + depth * 60;
      ctx.fillStyle = hc
        ? `rgba(${8 + depth * 30 | 0},${8 + depth * 30 | 0},${10 + depth * 32 | 0},1)`
        : `rgba(${warm | 0},${warm * 0.82 | 0},${warm * 0.72 | 0},${alpha})`;
      ctx.fill();
      ctx.strokeStyle = hc ? `rgba(255,255,255,${0.10 + depth * 0.5})` : `rgba(${190 + depth * 60 | 0},${172 + depth * 60 | 0},${140 + depth * 60 | 0},${0.06 + depth * 0.35})`;
      ctx.lineWidth = (0.5 + depth * 1.4) * this.dpr;
      ctx.stroke();
    }

    // The specimen replaces the country at the end.
    if (f.specimen > 0.01) {
      ctx.fillStyle = `rgba(0,0,0,${f.specimen})`;
      ctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H * 0.56;
      const span = Math.min(W * 0.68, H * 1.1) * mix(0.6, 1, f.specimen);
      ctx.save();
      ctx.translate(cx, cy);
      const heard = clamp01(t / duration);
      for (let b = 0; b <= 72; b++) {
        ctx.beginPath();
        for (let s = 0; s <= 150; s++) {
          const u = s / 150;
          const T = this.analysis.terrainAt(u, b / 72);
          const h = Math.pow(T.energy, 1.75) * 30;
          const x = (u - 0.5) * span;
          const y = (b / 72 - 0.5) * span * 0.30 - h;
          if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        const lit = (b / 72) * 0 + 1;
        ctx.strokeStyle = `rgba(${210 * lit | 0},${190 * lit | 0},${152 * lit | 0},${0.10 + 0.3 * (b / 72)})`;
        ctx.lineWidth = 1 * this.dpr;
        ctx.stroke();
      }
      // The unheard remainder stays in shadow, as it does on the rendered object.
      ctx.fillStyle = 'rgba(0,0,0,0.66)';
      ctx.fillRect(-span / 2 + span * heard, -span * 0.3, span * (1 - heard), span * 0.6);
      ctx.restore();
    }

    // Vignette. Even here the frame is composed.
    const vig = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.28, W / 2, H * 0.5, Math.max(W, H) * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${hc ? 0.45 : 0.70})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  dispose() {}
}
