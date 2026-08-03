/* Transcendence Edition — Sonic Terrain
 * Runtime prelude: shared math, deterministic randomness and small utilities.
 *
 * Every module in this runtime is concatenated into one package-local script.
 * There is no import, no bundler resolution and no network fetch at any point.
 */

const TX = {
  version: '1.0.0',
  slice: { track: 'track-01', start: 0, end: 104 },
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const inverseLerp = (a, b, v) => (b === a ? 0 : clamp01((v - a) / (b - a)));

/* Easing used by the camera and by every authored transition. Restraint is the
 * point: nothing in this world uses a bounce or an elastic curve. */
const ease = {
  linear: t => t,
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outQuint: t => 1 - Math.pow(1 - t, 5),
  inOutQuint: t => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  /* Matter thrown and settling: fast departure, long settle, no overshoot. */
  settle: t => 1 - Math.pow(1 - t, 4) * (1 - 0.12 * Math.sin(t * Math.PI * 3)),
};

/* Deterministic 32-bit PRNG. The runtime never calls Math.random: every grain
 * of dust derives from a fixed seed so that two playbacks of the same second
 * are identical, which is what makes seeking and the determinism test real. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* A critically-damped spring. Used for camera and focus so that motion has
 * inertia and a settling time instead of linear interpolation. */
class Spring {
  constructor(value = 0, halfLife = 0.22) {
    this.value = value;
    this.velocity = 0;
    this.halfLife = halfLife;
  }
  step(target, dt) {
    const omega = 2 * Math.LN2 / Math.max(0.0001, this.halfLife);
    const step = clamp(dt, 0, 0.05);
    const a = omega * omega * (target - this.value) - 2 * omega * this.velocity;
    this.velocity += a * step;
    this.value += this.velocity * step;
    return this.value;
  }
  reset(value) { this.value = value; this.velocity = 0; return value; }
}

class Spring3 {
  constructor(x = 0, y = 0, z = 0, halfLife = 0.22) {
    this.x = new Spring(x, halfLife);
    this.y = new Spring(y, halfLife);
    this.z = new Spring(z, halfLife);
  }
  set halfLife(v) { this.x.halfLife = this.y.halfLife = this.z.halfLife = v; }
  step(tx, ty, tz, dt) { this.x.step(tx, dt); this.y.step(ty, dt); this.z.step(tz, dt); return this; }
  reset(x, y, z) { this.x.reset(x); this.y.reset(y); this.z.reset(z); return this; }
  applyTo(vector) { vector.set(this.x.value, this.y.value, this.z.value); return vector; }
}

const dom = {
  $: sel => document.querySelector(sel),
  all: sel => Array.from(document.querySelectorAll(sel)),
  on: (target, type, handler, options) => { target.addEventListener(type, handler, options); return () => target.removeEventListener(type, handler, options); },
};

/* Time formatting for the utility sheet. */
const timecode = seconds => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
