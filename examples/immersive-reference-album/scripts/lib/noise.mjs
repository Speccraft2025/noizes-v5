// Deterministic procedural noise for build-time texture authoring.
// Seeded integer hashing only — no Math.random anywhere, so the generated
// textures are byte-identical on every machine and their hashes are stable.

export function hash2(x, y, seed = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 1274126177;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function hash3(x, y, z, seed = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (z | 0) * 2147483647 + (seed | 0) * 1274126177;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const quintic = t => t * t * t * (t * (t * 6 - 15) + 10);

/** Tileable 2D value noise on a `period`-sized lattice. */
export function valueNoise(x, y, period, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = quintic(xf), v = quintic(yf);
  const wrap = n => ((n % period) + period) % period;
  const a = hash2(wrap(xi), wrap(yi), seed);
  const b = hash2(wrap(xi + 1), wrap(yi), seed);
  const c = hash2(wrap(xi), wrap(yi + 1), seed);
  const d = hash2(wrap(xi + 1), wrap(yi + 1), seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** Tileable fractal Brownian motion. */
export function fbm(x, y, { octaves = 5, frequency = 4, lacunarity = 2, gain = 0.5, seed = 0 } = {}) {
  let sum = 0, amplitude = 1, norm = 0, f = frequency;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * valueNoise(x * f, y * f, f, seed + o * 101);
    norm += amplitude;
    amplitude *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/** Ridged fbm — produces creases and scratch-like structure. */
export function ridged(x, y, { octaves = 5, frequency = 4, lacunarity = 2, gain = 0.5, seed = 0 } = {}) {
  let sum = 0, amplitude = 1, norm = 0, f = frequency;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(valueNoise(x * f, y * f, f, seed + o * 71) * 2 - 1);
    sum += amplitude * n * n;
    norm += amplitude;
    amplitude *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/** Tileable cellular (Worley) noise. Returns distance to the nearest feature point. */
export function worley(x, y, cells, seed = 0) {
  const cx = Math.floor(x * cells), cy = Math.floor(y * cells);
  let best = 1e9;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const gx = cx + dx, gy = cy + dy;
      const wx = ((gx % cells) + cells) % cells;
      const wy = ((gy % cells) + cells) % cells;
      const px = (gx + hash2(wx, wy, seed)) / cells;
      const py = (gy + hash2(wx, wy, seed + 977)) / cells;
      const d = Math.hypot(x - px, y - py);
      if (d < best) best = d;
    }
  }
  return Math.min(1, best * cells);
}

/** Domain-warped fbm — the cheapest route to organic, non-machine-looking stains. */
export function warped(x, y, options = {}) {
  const { warp = 0.35, seed = 0 } = options;
  const qx = fbm(x, y, { ...options, seed: seed + 11 });
  const qy = fbm(x, y, { ...options, seed: seed + 23 });
  return fbm(x + warp * (qx - 0.5), y + warp * (qy - 0.5), { ...options, seed });
}

export const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
export const smoothstep = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };
export const mix = (a, b, t) => a + (b - a) * t;
