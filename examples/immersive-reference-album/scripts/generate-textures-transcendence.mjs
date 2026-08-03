// Authors every bitmap in the Transcendence edition from first principles.
//
// The Sonic Terrain world computes its ground from the recording and generates
// all regular structure (stone veining, contour relief, film grain, the gallery
// walls) analytically in GLSL at runtime, where it carries no resolution limit
// and no storage cost. That leaves exactly two bitmaps worth shipping: a
// suspended-matter sprite and blue noise for dithering and grain.
//
// Nothing here is sourced from a third party, so the edition ships with no
// image licence liability at all.
//
// Usage: node scripts/generate-textures-transcendence.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './lib/png.mjs';
import { clamp01, fbm, hash2 } from './lib/noise.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const OUT = join(ROOT, 'transcendence', 'assets');

/** Build an RGBA texture from a per-pixel function returning [r,g,b,a] in 0..1. */
function render(size, fn) {
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = fn((x + 0.5) / size, (y + 0.5) / size, x, y);
      const i = (y * size + x) * 4;
      px[i] = Math.round(clamp01(c[0]) * 255);
      px[i + 1] = Math.round(clamp01(c[1]) * 255);
      px[i + 2] = Math.round(clamp01(c[2]) * 255);
      px[i + 3] = Math.round(clamp01(c[3] ?? 1) * 255);
    }
  }
  return { size, px };
}

const written = [];
async function emit(name, texture, description, channels) {
  const bytes = encodePng(texture.size, texture.size, texture.px);
  await writeFile(join(OUT, name), bytes);
  written.push({ name, size: texture.size, bytes: bytes.length, description, channels });
  console.log(`  ${name.padEnd(20)} ${texture.size}²  ${(bytes.length / 1024).toFixed(0).padStart(5)} KB  ${description}`);
}

await mkdir(OUT, { recursive: true });
console.log('generating procedural textures →', OUT);

// ---------------------------------------------------------------- dust grain
// One mote of suspended matter, seen through a lens that cannot quite resolve
// it. Irregular on purpose: a perfect Gaussian dot is the single clearest tell
// of a programmer-art particle system.
await emit('dust-grain.png', render(128, (u, v) => {
  const dx = u - 0.5, dy = v - 0.5;
  const theta = Math.atan2(dy, dx);
  const wobble = 0.34 + fbm(Math.cos(theta) * 0.5 + 0.5, Math.sin(theta) * 0.5 + 0.5, { octaves: 3, frequency: 6, seed: 307 }) * 0.12;
  const r = Math.hypot(dx, dy) / wobble;
  const core = Math.exp(-r * r * 2.6);
  const halo = Math.exp(-r * 1.35) * 0.32;
  const a = clamp01(core + halo) * (0.72 + fbm(u, v, { octaves: 2, frequency: 20, seed: 311 }) * 0.42);
  return [1, 0.97, 0.93, a];
}), 'suspended-matter sprite with lens halo', 'RGB tint · A coverage');

// ---------------------------------------------------------------- blue noise
// Void-and-cluster style blue noise for dithering, stochastic sampling and film
// grain. Banding in dark gradients is the fastest way to look cheap, and this is
// what removes it.
await emit('blue-noise.png', (() => {
  const size = 128, n = size * size;
  const value = new Float32Array(n);
  for (let i = 0; i < n; i++) value[i] = hash2(i % size, (i / size) | 0, 401);
  // Relax toward a blue spectrum: repeatedly swap the pixel most similar to its
  // neighbourhood with the one least similar.
  const energy = new Float32Array(n);
  const sigma = 1.9, radius = 4;
  const computeEnergy = () => {
    energy.fill(0);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let sum = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (!dx && !dy) continue;
            const nx = (x + dx + size) % size, ny = (y + dy + size) % size;
            sum += value[ny * size + nx] * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
          }
        }
        energy[y * size + x] = sum;
      }
    }
  };
  for (let pass = 0; pass < 14; pass++) {
    computeEnergy();
    const order = Array.from({ length: n }, (_, i) => i);
    order.sort((a, b) => (energy[a] - value[a] * 4) - (energy[b] - value[b] * 4));
    for (let i = 0; i < n / 2; i += 2) {
      const a = order[i], b = order[n - 1 - i];
      if (value[a] < value[b]) { const t = value[a]; value[a] = value[b]; value[b] = t; }
    }
  }
  const px = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const g = Math.round(clamp01(value[i]) * 255);
    px[i * 4] = g;
    px[i * 4 + 1] = Math.round(clamp01(hash2(i % size, (i / size) | 0, 409)) * 255);
    px[i * 4 + 2] = Math.round(clamp01(hash2(i % size, (i / size) | 0, 419)) * 255);
    px[i * 4 + 3] = 255;
  }
  return { size, px };
})(), 'tileable blue noise for dithering and grain', 'R blue noise · GB white noise');

const total = written.reduce((a, b) => a + b.bytes, 0);
console.log(`\n${written.length} textures · ${(total / 1024).toFixed(0)} KB total`);
await writeFile(join(OUT, 'textures.manifest.json'), JSON.stringify({
  generated_by: 'scripts/generate-textures-transcendence.mjs',
  statement: 'Every bitmap in this edition is generated procedurally by the build. No third-party image is used, downloaded or embedded.',
  analytic_note: 'The terrain itself is not a texture: it is analysis/track-01.terrain.png, computed from the recording. Stone veining, contour relief, the gallery interior and film grain are generated analytically in GLSL at runtime and are not baked to disk.',
  textures: written,
}, null, 2) + '\n');
