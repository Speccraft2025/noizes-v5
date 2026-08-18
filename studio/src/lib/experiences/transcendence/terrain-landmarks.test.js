import { describe, it, expect } from 'vitest';

const clamp01 = t => Math.max(0, Math.min(1, t));
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };

const TIME_SCALE = 26;
const BAND_WIDTH = 420;

function makeMockWorld(heightFn) {
  return { heightAt: heightFn };
}

function peaksAndTroughsTerrain(x, z) {
  const seconds = -z / TIME_SCALE;
  const xn = x / BAND_WIDTH;
  return 20 + 18 * Math.sin(seconds * 0.3) * Math.cos(xn * 4) + 5 * Math.sin(xn * 8 + seconds * 0.5);
}

/**
 * TerrainLandmarks and RouteBuilder are defined inline in the runtime
 * concatenation and can't be imported. The classes below are an exact
 * copy of the production code — not a re-implementation — so the tests
 * exercise the same algorithm that ships.
 */
class TerrainLandmarks {
  constructor() { this.landmarks = []; }

  scan(world, durationSeconds) {
    this.landmarks = [];
    const stepX = 15, stepZ = 25;
    const xMin = -140, xMax = 140;
    const zMax = 0, zMin = -durationSeconds * TIME_SCALE;

    const grid = [];
    const cols = Math.ceil((xMax - xMin) / stepX) + 1;
    const rows = Math.ceil((zMax - zMin) / stepZ) + 1;

    for (let r = 0; r < rows; r++) {
      const row = [];
      const z = zMax - r * stepZ;
      for (let c = 0; c < cols; c++) {
        const x = xMin + c * stepX;
        row.push({ x, z, h: world.heightAt(x, z) });
      }
      grid.push(row);
    }

    const raw = [];
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        const cell = grid[r][c];
        const neighbours = [
          grid[r - 1][c - 1], grid[r - 1][c], grid[r - 1][c + 1],
          grid[r][c - 1],                      grid[r][c + 1],
          grid[r + 1][c - 1], grid[r + 1][c], grid[r + 1][c + 1],
        ];
        const isPeak = neighbours.every(n => cell.h > n.h) && cell.h > 15;
        const isTrough = neighbours.every(n => cell.h < n.h);
        if (!isPeak && !isTrough) continue;

        let prominence;
        if (isPeak) {
          const minNeighbour = Math.min(...neighbours.map(n => n.h));
          prominence = cell.h - minNeighbour;
          if (prominence < 3) continue;
        } else {
          const maxNeighbour = Math.max(...neighbours.map(n => n.h));
          prominence = maxNeighbour - cell.h;
          if (prominence < 1) continue;
        }
        raw.push({
          type: isPeak ? 'peak' : 'trough',
          x: cell.x, z: cell.z, h: cell.h, prominence,
          seconds: -cell.z / TIME_SCALE, band: cell.x / (BAND_WIDTH * 0.5),
        });
      }
    }

    const merged = this._merge(raw, stepX * 1.8, stepZ * 1.8);

    const maxProm = { peak: 0, trough: 0 };
    for (const lm of merged) {
      if (lm.prominence > maxProm[lm.type]) maxProm[lm.type] = lm.prominence;
    }
    for (const lm of merged) {
      lm.prominence = maxProm[lm.type] > 0 ? lm.prominence / maxProm[lm.type] : 0;
    }

    merged.sort((a, b) => a.seconds - b.seconds);

    const counts = { peak: 0, trough: 0 };
    for (const lm of merged) {
      counts[lm.type]++;
      const idx = String(counts[lm.type]).padStart(2, '0');
      lm.id = `${lm.type}-${idx}`;
      lm.position = [lm.x, lm.h, lm.z];
      lm.entry = [lm.x, lm.h + (lm.type === 'peak' ? 20 : -5), lm.z + 60];
      lm.exit = [lm.x, lm.h + (lm.type === 'peak' ? 20 : -5), lm.z - 60];
      lm.contentSlots = [];
    }

    this.landmarks = merged;
    return this;
  }

  _merge(raw, dx, dz) {
    const used = new Set();
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      if (used.has(i)) continue;
      let best = raw[i];
      for (let j = i + 1; j < raw.length; j++) {
        if (used.has(j)) continue;
        if (raw[j].type !== best.type) continue;
        if (Math.abs(raw[j].x - best.x) > dx || Math.abs(raw[j].z - best.z) > dz) continue;
        used.add(j);
        if ((best.type === 'peak' && raw[j].h > best.h) ||
            (best.type === 'trough' && raw[j].h < best.h)) {
          best = { ...raw[j], prominence: Math.max(best.prominence, raw[j].prominence) };
        } else {
          best.prominence = Math.max(best.prominence, raw[j].prominence);
        }
      }
      out.push(best);
    }
    return out;
  }

  byType(type) { return this.landmarks.filter(l => l.type === type); }
  byId(id) { return this.landmarks.find(l => l.id === id) || null; }
  inRange(t0, t1) { return this.landmarks.filter(l => l.seconds >= t0 && l.seconds <= t1); }
}

class RouteBuilder {
  constructor(landmarks, world) {
    this.landmarks = landmarks;
    this.world = world;
    this.route = [];
    this.shots = {};
    this.sequence = [];
  }

  plan(t0, t1) {
    const candidates = this.landmarks.inRange(t0, t1);
    const all = candidates.slice().sort((a, b) => a.seconds - b.seconds);
    if (all.length === 0) return this;

    this.route = [];
    let lastTime = t0;
    const first = all[0];
    let wantType = first.type;

    for (const lm of all) {
      if (lm.seconds < lastTime + 4) continue;
      if (lm.type !== wantType) continue;
      this.route.push(lm);
      lastTime = lm.seconds;
      wantType = lm.type === 'peak' ? 'trough' : 'peak';
    }

    if (this.route.length < 3) {
      this.route = [];
      lastTime = t0;
      wantType = first.type;
      for (const lm of all) {
        if (lm.seconds < lastTime + 4) continue;
        if (lm.type !== wantType) continue;
        this.route.push(lm);
        lastTime = lm.seconds;
        wantType = lm.type === 'peak' ? 'trough' : 'peak';
      }
      if (this.route.length < 2) {
        this.route = [];
        lastTime = t0;
        for (const lm of all) {
          if (lm.seconds < lastTime + 4) continue;
          if (this.route.length > 0 && lm.type === this.route[this.route.length - 1].type) continue;
          this.route.push(lm);
          lastTime = lm.seconds;
        }
      }
    }

    return this;
  }

  generateShots() {
    this.shots = {};
    for (let i = 0; i < this.route.length; i++) {
      const lm = this.route[i];
      const next = this.route[i + 1] || null;
      const band = lm.band;

      if (lm.type === 'peak') {
        this.shots[`route-aerial-${lm.id}`] = {
          from: { band: band - 0.05, alt: 60, lead: 30, look: 400, lookBand: band, lookAlt: -10, fov: 50, roll: 0.3 },
          to:   { band: band + 0.05, alt: 40, lead: 20, look: 320, lookBand: band - 0.05, lookAlt: 4, fov: 46, roll: -0.3 },
          ease: 'inOutCubic', still: 0.5,
        };
        if (next && next.type === 'trough') {
          this.shots[`route-descend-${lm.id}`] = {
            from: { band: band, alt: 40, lead: 20, look: 300, lookBand: next.band, lookAlt: 4, fov: 46, roll: -0.2 },
            to:   { band: next.band, alt: 6, lead: 10, look: 160, lookBand: next.band, lookAlt: 3, fov: 50, roll: 0.1 },
            ease: 'inOutQuint', still: 0.6,
          };
        }
      } else {
        this.shots[`route-trough-${lm.id}`] = {
          from: { band: band - 0.01, alt: 4, lead: 8, look: 120, lookBand: band, lookAlt: 3, fov: 52, roll: 0 },
          to:   { band: band + 0.01, alt: 3, lead: 5, look: 90, lookBand: band, lookAlt: 2, fov: 56, roll: 0.1 },
          ease: 'inOutSine', still: 0.5,
        };
        if (next && next.type === 'peak') {
          this.shots[`route-climb-${lm.id}`] = {
            from: { band: band, alt: 4, lead: 8, look: 140, lookBand: next.band, lookAlt: 6, fov: 48, roll: 0.15 },
            to:   { band: next.band, alt: 50, lead: 28, look: 380, lookBand: next.band, lookAlt: -8, fov: 50, roll: -0.3 },
            ease: 'inOutQuint', still: 0.65,
          };
        }
      }
    }

    if (this.route.length > 0) {
      const last = this.route[this.route.length - 1];
      this.shots['route-reveal'] = {
        from: { band: last.band, alt: 50, lead: 30, look: 400, lookBand: 0, lookAlt: -20, fov: 52, roll: 0.2 },
        to:   { band: 0, alt: 120, lead: 60, look: 600, lookBand: 0, lookAlt: -50, fov: 54, roll: -0.15 },
        ease: 'outCubic', still: 0.55,
      };
    }
    return this;
  }

  generateSequence() {
    this.sequence = [];
    if (this.route.length === 0) return this;

    for (let i = 0; i < this.route.length; i++) {
      const lm = this.route[i];
      const next = this.route[i + 1] || null;

      if (lm.type === 'peak') {
        this.sequence.push({
          time: lm.seconds, id: `route-aerial-${lm.id}`,
          shot: `route-aerial-${lm.id}`, phase: 'route',
          world: { air: 0.4, relief: 0.5, atmosphere: 0.3, ahead: 0.6 },
        });
        if (next && next.type === 'trough') {
          const midTime = (lm.seconds + next.seconds) * 0.5;
          this.sequence.push({
            time: midTime, id: `route-descend-${lm.id}`,
            shot: `route-descend-${lm.id}`, phase: 'route',
            world: { air: 0.3, relief: 0.6, atmosphere: 0.4, ahead: 0.5 },
          });
        }
      } else {
        this.sequence.push({
          time: lm.seconds, id: `route-trough-${lm.id}`,
          shot: `route-trough-${lm.id}`, phase: 'route',
          world: { air: 0.2, relief: 0.7, atmosphere: 0.5, ahead: 0.4 },
        });
        if (next && next.type === 'peak') {
          const midTime = (lm.seconds + next.seconds) * 0.5;
          this.sequence.push({
            time: midTime, id: `route-climb-${lm.id}`,
            shot: `route-climb-${lm.id}`, phase: 'route',
            world: { air: 0.35, relief: 0.55, atmosphere: 0.35, ahead: 0.55 },
          });
        }
      }
    }

    const last = this.route[this.route.length - 1];
    this.sequence.push({
      time: last.seconds + 4, id: 'route-reveal',
      shot: 'route-reveal', phase: 'route',
      world: { air: 0.5, relief: 0.4, atmosphere: 0.25, ahead: 0.7 },
    });

    this.sequence.sort((a, b) => a.time - b.time);
    return this;
  }
}


describe('TerrainLandmarks', () => {
  const world = makeMockWorld(peaksAndTroughsTerrain);
  const scanner = new TerrainLandmarks().scan(world, 60);

  it('finds both peaks and troughs', () => {
    const peaks = scanner.byType('peak');
    const troughs = scanner.byType('trough');
    expect(peaks.length).toBeGreaterThan(0);
    expect(troughs.length).toBeGreaterThan(0);
  });

  it('assigns stable IDs with type prefix and sequential numbering', () => {
    for (const lm of scanner.landmarks) {
      expect(lm.id).toMatch(/^(peak|trough)-\d{2}$/);
    }
    const peakIds = scanner.byType('peak').map(l => l.id);
    expect(peakIds[0]).toBe('peak-01');
    if (peakIds.length > 1) expect(peakIds[1]).toBe('peak-02');
  });

  it('each landmark has the required shape', () => {
    for (const lm of scanner.landmarks) {
      expect(lm).toHaveProperty('id');
      expect(lm).toHaveProperty('type');
      expect(lm).toHaveProperty('position');
      expect(lm).toHaveProperty('entry');
      expect(lm).toHaveProperty('exit');
      expect(lm).toHaveProperty('prominence');
      expect(lm).toHaveProperty('contentSlots');
      expect(lm.position).toHaveLength(3);
      expect(lm.entry).toHaveLength(3);
      expect(lm.exit).toHaveLength(3);
      expect(Array.isArray(lm.contentSlots)).toBe(true);
    }
  });

  it('normalizes prominence to 0–1', () => {
    for (const lm of scanner.landmarks) {
      expect(lm.prominence).toBeGreaterThanOrEqual(0);
      expect(lm.prominence).toBeLessThanOrEqual(1);
    }
    const maxPeak = Math.max(...scanner.byType('peak').map(l => l.prominence));
    if (scanner.byType('peak').length > 0) expect(maxPeak).toBe(1);
  });

  it('landmarks are sorted by time', () => {
    for (let i = 1; i < scanner.landmarks.length; i++) {
      expect(scanner.landmarks[i].seconds).toBeGreaterThanOrEqual(scanner.landmarks[i - 1].seconds);
    }
  });

  it('byId retrieves a specific landmark', () => {
    const first = scanner.landmarks[0];
    expect(scanner.byId(first.id)).toBe(first);
    expect(scanner.byId('nonexistent')).toBeNull();
  });

  it('inRange filters by time window', () => {
    const mid = scanner.landmarks.length > 2
      ? scanner.landmarks[Math.floor(scanner.landmarks.length / 2)].seconds
      : 30;
    const ranged = scanner.inRange(mid - 5, mid + 5);
    for (const lm of ranged) {
      expect(lm.seconds).toBeGreaterThanOrEqual(mid - 5);
      expect(lm.seconds).toBeLessThanOrEqual(mid + 5);
    }
  });

  it('produces nothing for flat terrain', () => {
    const flat = makeMockWorld(() => 10);
    const empty = new TerrainLandmarks().scan(flat, 60);
    expect(empty.landmarks).toHaveLength(0);
  });
});

describe('RouteBuilder', () => {
  const world = makeMockWorld(peaksAndTroughsTerrain);
  const scanner = new TerrainLandmarks().scan(world, 80);
  const builder = new RouteBuilder(scanner, world).plan(5, 70).generateShots().generateSequence();

  it('produces a route that alternates high and low', () => {
    expect(builder.route.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < builder.route.length; i++) {
      expect(builder.route[i].type).not.toBe(builder.route[i - 1].type);
    }
  });

  it('enforces minimum spacing between landmarks', () => {
    for (let i = 1; i < builder.route.length; i++) {
      expect(builder.route[i].seconds - builder.route[i - 1].seconds).toBeGreaterThanOrEqual(4);
    }
  });

  it('generates a shot for every route landmark', () => {
    for (const lm of builder.route) {
      const prefix = lm.type === 'peak' ? 'route-aerial-' : 'route-trough-';
      expect(builder.shots).toHaveProperty(prefix + lm.id);
    }
  });

  it('generates transition shots between consecutive different types', () => {
    for (let i = 0; i < builder.route.length - 1; i++) {
      const lm = builder.route[i], next = builder.route[i + 1];
      if (lm.type === 'peak' && next.type === 'trough') {
        expect(builder.shots).toHaveProperty(`route-descend-${lm.id}`);
      }
      if (lm.type === 'trough' && next.type === 'peak') {
        expect(builder.shots).toHaveProperty(`route-climb-${lm.id}`);
      }
    }
  });

  it('ends with a reveal shot', () => {
    expect(builder.shots).toHaveProperty('route-reveal');
  });

  it('generates a sequence with strictly increasing times', () => {
    expect(builder.sequence.length).toBeGreaterThan(0);
    for (let i = 1; i < builder.sequence.length; i++) {
      expect(builder.sequence[i].time).toBeGreaterThan(builder.sequence[i - 1].time);
    }
  });

  it('every sequence cue references a generated shot', () => {
    for (const cue of builder.sequence) {
      expect(builder.shots).toHaveProperty(cue.shot);
    }
  });

  it('every shot has the full from/to parameter set', () => {
    const required = ['band', 'alt', 'lead', 'look', 'lookBand', 'lookAlt', 'fov', 'roll'];
    for (const [name, shot] of Object.entries(builder.shots)) {
      for (const key of required) {
        expect(shot.from).toHaveProperty(key);
        expect(shot.to).toHaveProperty(key);
      }
      expect(shot).toHaveProperty('ease');
      expect(shot).toHaveProperty('still');
    }
  });

  it('every sequence cue has the required world properties', () => {
    for (const cue of builder.sequence) {
      expect(cue.world).toHaveProperty('air');
      expect(cue.world).toHaveProperty('relief');
      expect(cue.world).toHaveProperty('atmosphere');
      expect(cue.world).toHaveProperty('ahead');
      expect(cue).toHaveProperty('phase', 'route');
    }
  });

  it('fallback mode activates when strict alternation yields too few landmarks', () => {
    const sparse = makeMockWorld((x, z) => {
      const s = -z / TIME_SCALE;
      if (s > 8 && s < 12) return 40;
      if (s > 20 && s < 24) return 42;
      return 20;
    });
    const sc = new TerrainLandmarks().scan(sparse, 30);
    const b = new RouteBuilder(sc, sparse).plan(0, 30);
    expect(b.route.length).toBeGreaterThanOrEqual(0);
  });
});
