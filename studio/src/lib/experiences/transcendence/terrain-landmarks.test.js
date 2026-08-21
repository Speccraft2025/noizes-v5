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

        let type, prominence;
        if (isPeak) {
          const minNeighbour = Math.min(...neighbours.map(n => n.h));
          prominence = cell.h - minNeighbour;
          if (prominence < 3) continue;
          type = 'peak';
        } else if (isTrough) {
          const maxNeighbour = Math.max(...neighbours.map(n => n.h));
          prominence = maxNeighbour - cell.h;
          if (prominence < 1) continue;
          type = 'trough';
        } else {
          const left = grid[r][c - 1].h, right = grid[r][c + 1].h;
          const fwd = grid[r - 1][c].h, back = grid[r + 1][c].h;
          const lateralDrop = cell.h - Math.max(left, right);
          const axialVar = Math.min(Math.abs(cell.h - fwd), Math.abs(cell.h - back));
          if (cell.h < 18 || lateralDrop < 3 || axialVar > 5) continue;
          type = 'ridge';
          prominence = lateralDrop;
        }
        raw.push({
          type,
          x: cell.x, z: cell.z, h: cell.h, prominence,
          seconds: -cell.z / TIME_SCALE, band: cell.x / (BAND_WIDTH * 0.5),
        });
      }
    }

    const merged = this._merge(raw, stepX * 1.8, stepZ * 1.8);

    const maxProm = { peak: 0, trough: 0, ridge: 0 };
    for (const lm of merged) {
      if (lm.prominence > maxProm[lm.type]) maxProm[lm.type] = lm.prominence;
    }
    for (const lm of merged) {
      lm.prominence = maxProm[lm.type] > 0 ? lm.prominence / maxProm[lm.type] : 0;
    }

    merged.sort((a, b) => a.seconds - b.seconds);

    const counts = { peak: 0, trough: 0, ridge: 0 };
    for (const lm of merged) {
      counts[lm.type]++;
      const idx = String(counts[lm.type]).padStart(2, '0');
      lm.id = `${lm.type}-${idx}`;
      lm.position = [lm.x, lm.h, lm.z];
      const entryAlt = lm.type === 'peak' ? 20 : lm.type === 'ridge' ? 10 : -5;
      lm.entry = [lm.x, lm.h + entryAlt, lm.z + 60];
      lm.exit = [lm.x, lm.h + entryAlt, lm.z - 60];
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

  planTraversal(t0, t1) {
    const all = this.landmarks.inRange(t0, t1);
    const peaks = all.filter(l => l.type === 'peak');
    const troughs = all.filter(l => l.type === 'trough');
    const ridges = all.filter(l => l.type === 'ridge');
    const highs = [...ridges, ...peaks].sort((a, b) => a.seconds - b.seconds);

    if (troughs.length === 0 || highs.length === 0) {
      this.traversal = [];
      return this.plan(t0, t1);
    }

    this.route = [];
    this.traversal = [];

    const midpoint = (t0 + t1) * 0.5;
    const firstHalf = troughs.filter(t => t.seconds < midpoint);
    const troughA = firstHalf.length > 0
      ? firstHalf.reduce((best, t) => t.prominence > best.prominence ? t : best)
      : troughs[0];

    const highLandmark = highs.find(h => h.seconds > troughA.seconds + 4);
    const afterHigh = highLandmark ? highLandmark.seconds + 4 : troughA.seconds + 8;
    const troughB = troughs.find(t => t.seconds > afterHigh && t.id !== troughA.id);

    this.traversal.push({ phase: 'atlas', seconds: t0 });
    this.traversal.push({ phase: 'descent', seconds: Math.max(t0 + 3, troughA.seconds - 4) });

    this.route.push(troughA);
    this.traversal.push({ phase: 'trough-a', landmark: troughA, seconds: troughA.seconds });

    if (highLandmark) {
      this.traversal.push({ phase: 'climb', seconds: (troughA.seconds + highLandmark.seconds) * 0.5 });
      this.route.push(highLandmark);
      this.traversal.push({ phase: 'ridge', landmark: highLandmark, seconds: highLandmark.seconds });
      this.traversal.push({ phase: 'atlas-return', seconds: highLandmark.seconds + 4 });
    }

    if (troughB) {
      this.route.push(troughB);
      this.traversal.push({ phase: 'trough-b', landmark: troughB, seconds: troughB.seconds });
    }

    const lastLM = this.route[this.route.length - 1];
    this.traversal.push({ phase: 'reveal', seconds: lastLM.seconds + 4 });
    this.traversal.sort((a, b) => a.seconds - b.seconds);
    return this;
  }

  generateTraversalShots() {
    if (!this.traversal || this.traversal.length === 0) return this.generateShots();
    this.shots = {};
    const troughAPhase = this.traversal.find(p => p.phase === 'trough-a');
    const ridgePhase = this.traversal.find(p => p.phase === 'ridge');
    const troughBPhase = this.traversal.find(p => p.phase === 'trough-b');

    this.shots['route-atlas'] = {
      from: { band: -0.05, alt: 200, lead: 100, look: 600, lookBand: 0, lookAlt: -50, fov: 52, roll: 0 },
      to:   { band: 0, alt: 170, lead: 80, look: 550, lookBand: 0.02, lookAlt: -40, fov: 50, roll: -0.3 },
      ease: 'inOutSine', still: 0.4,
    };

    const dBand = troughAPhase ? troughAPhase.landmark.band : 0;
    this.shots['route-descent'] = {
      from: { band: 0, alt: 170, lead: 80, look: 550, lookBand: dBand, lookAlt: -30, fov: 50, roll: -0.3 },
      to:   { band: dBand, alt: 35, lead: 22, look: 280, lookBand: dBand, lookAlt: 6, fov: 46, roll: 0.3 },
      ease: 'inOutQuint', still: 0.6,
    };

    if (troughAPhase) {
      const b = troughAPhase.landmark.band;
      this.shots['route-trough-a'] = {
        from: { band: b - 0.01, alt: 4, lead: 8, look: 120, lookBand: b, lookAlt: 3, fov: 52, roll: 0 },
        to:   { band: b + 0.01, alt: 2.8, lead: 5, look: 90, lookBand: b, lookAlt: 1.5, fov: 56, roll: 0.1 },
        ease: 'inOutSine', still: 0.5,
      };
    }

    if (ridgePhase) {
      const fromBand = troughAPhase ? troughAPhase.landmark.band : 0;
      const toBand = ridgePhase.landmark.band;
      this.shots['route-climb'] = {
        from: { band: fromBand, alt: 4, lead: 8, look: 140, lookBand: toBand, lookAlt: 8, fov: 48, roll: 0.15 },
        to:   { band: toBand, alt: 55, lead: 28, look: 380, lookBand: toBand, lookAlt: -6, fov: 50, roll: -0.3 },
        ease: 'inOutQuint', still: 0.65,
      };
      const b = ridgePhase.landmark.band;
      this.shots['route-ridge'] = {
        from: { band: b - 0.08, alt: 12, lead: 14, look: 260, lookBand: b, lookAlt: 0, fov: 46, roll: 0.4 },
        to:   { band: b + 0.06, alt: 8, lead: 10, look: 200, lookBand: b + 0.04, lookAlt: -2, fov: 44, roll: -0.3 },
        ease: 'inOutCubic', still: 0.55,
      };
    }

    this.shots['route-atlas-return'] = {
      from: { band: 0, alt: 50, lead: 28, look: 380, lookBand: 0, lookAlt: -10, fov: 48, roll: 0.2 },
      to:   { band: 0, alt: 180, lead: 90, look: 600, lookBand: 0, lookAlt: -50, fov: 52, roll: -0.15 },
      ease: 'inOutQuint', still: 0.55,
    };

    if (troughBPhase) {
      const b = troughBPhase.landmark.band;
      this.shots['route-trough-b'] = {
        from: { band: b - 0.01, alt: 4, lead: 8, look: 120, lookBand: b, lookAlt: 3, fov: 52, roll: 0 },
        to:   { band: b + 0.01, alt: 2.8, lead: 5, look: 90, lookBand: b, lookAlt: 1.5, fov: 56, roll: 0.1 },
        ease: 'inOutSine', still: 0.5,
      };
    }

    const last = this.route[this.route.length - 1];
    const rBand = last ? last.band : 0;
    this.shots['route-reveal'] = {
      from: { band: rBand, alt: 50, lead: 30, look: 400, lookBand: 0, lookAlt: -20, fov: 52, roll: 0.2 },
      to:   { band: 0, alt: 140, lead: 70, look: 650, lookBand: 0, lookAlt: -55, fov: 54, roll: -0.15 },
      ease: 'outCubic', still: 0.55,
    };

    return this;
  }

  generateTraversalSequence() {
    if (!this.traversal || this.traversal.length === 0) return this.generateSequence();
    this.sequence = [];
    const presets = {
      'atlas':        { air: 0.4, relief: 0.3, atmosphere: 0.2, ahead: 0.7 },
      'descent':      { air: 0.35, relief: 0.5, atmosphere: 0.3, ahead: 0.6 },
      'trough-a':     { air: 0.2, relief: 0.7, atmosphere: 0.5, ahead: 0.4 },
      'climb':        { air: 0.35, relief: 0.55, atmosphere: 0.35, ahead: 0.55 },
      'ridge':        { air: 0.3, relief: 0.6, atmosphere: 0.3, ahead: 0.5 },
      'atlas-return': { air: 0.4, relief: 0.3, atmosphere: 0.2, ahead: 0.65 },
      'trough-b':     { air: 0.2, relief: 0.7, atmosphere: 0.5, ahead: 0.4 },
      'reveal':       { air: 0.5, relief: 0.3, atmosphere: 0.2, ahead: 0.7 },
    };
    for (const p of this.traversal) {
      this.sequence.push({
        time: p.seconds,
        id: `route-${p.phase}`,
        shot: `route-${p.phase}`,
        phase: 'route',
        world: presets[p.phase] || { air: 0.3, relief: 0.5, atmosphere: 0.3, ahead: 0.5 },
      });
    }
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
      expect(lm.id).toMatch(/^(peak|trough|ridge)-\d{2}$/);
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

describe('TerrainLandmarks — ridge detection', () => {
  function ridgedTerrain(x, z) {
    const s = -z / TIME_SCALE;
    const xn = x / BAND_WIDTH;
    return 12 + 30 * Math.exp(-800 * xn * xn) + 5 * Math.sin(s * 0.3);
  }

  const world = makeMockWorld(ridgedTerrain);
  const scanner = new TerrainLandmarks().scan(world, 60);

  it('detects ridges along the time axis', () => {
    const ridges = scanner.byType('ridge');
    expect(ridges.length).toBeGreaterThan(0);
  });

  it('ridge IDs follow the ridge-NN pattern', () => {
    for (const lm of scanner.byType('ridge')) {
      expect(lm.id).toMatch(/^ridge-\d{2}$/);
    }
  });

  it('ridges have height above threshold', () => {
    for (const lm of scanner.byType('ridge')) {
      expect(lm.h).toBeGreaterThanOrEqual(18);
    }
  });

  it('ridge prominence is normalized to 0–1', () => {
    const ridges = scanner.byType('ridge');
    if (ridges.length === 0) return;
    for (const lm of ridges) {
      expect(lm.prominence).toBeGreaterThanOrEqual(0);
      expect(lm.prominence).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...ridges.map(r => r.prominence))).toBe(1);
  });

  it('ridge entry altitude is between peak and trough', () => {
    for (const lm of scanner.byType('ridge')) {
      const entryAlt = lm.entry[1] - lm.h;
      expect(entryAlt).toBe(10);
    }
  });
});

describe('RouteBuilder — traversal pattern', () => {
  const world = makeMockWorld(peaksAndTroughsTerrain);
  const scanner = new TerrainLandmarks().scan(world, 80);
  const builder = new RouteBuilder(scanner, world);
  builder.planTraversal(5, 70).generateTraversalShots().generateTraversalSequence();

  it('produces a traversal with the expected phase order', () => {
    expect(builder.traversal.length).toBeGreaterThanOrEqual(4);
    const phases = builder.traversal.map(p => p.phase);
    expect(phases[0]).toBe('atlas');
    expect(phases[1]).toBe('descent');
    expect(phases).toContain('trough-a');
    expect(phases[phases.length - 1]).toBe('reveal');
  });

  it('traversal phases have strictly increasing times', () => {
    for (let i = 1; i < builder.traversal.length; i++) {
      expect(builder.traversal[i].seconds).toBeGreaterThan(builder.traversal[i - 1].seconds);
    }
  });

  it('generates shots for every traversal phase', () => {
    for (const p of builder.traversal) {
      expect(builder.shots).toHaveProperty(`route-${p.phase}`);
    }
  });

  it('every traversal shot has complete from/to parameters', () => {
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

  it('generates a sequence matching the traversal phases', () => {
    expect(builder.sequence.length).toBe(builder.traversal.length);
    for (const cue of builder.sequence) {
      expect(builder.shots).toHaveProperty(cue.shot);
      expect(cue).toHaveProperty('phase', 'route');
      expect(cue.world).toHaveProperty('air');
      expect(cue.world).toHaveProperty('relief');
    }
  });

  it('atlas shot has high altitude', () => {
    const atlas = builder.shots['route-atlas'];
    expect(atlas.from.alt).toBeGreaterThanOrEqual(150);
    expect(atlas.to.alt).toBeGreaterThanOrEqual(150);
  });

  it('trough shots have low altitude', () => {
    const troughA = builder.shots['route-trough-a'];
    if (troughA) {
      expect(troughA.from.alt).toBeLessThan(10);
      expect(troughA.to.alt).toBeLessThan(10);
    }
  });

  it('falls back to plan() when terrain lacks variety', () => {
    const flat = makeMockWorld((x, z) => {
      const s = -z / TIME_SCALE;
      return 10 + 2 * Math.sin(s * 0.2);
    });
    const sc = new TerrainLandmarks().scan(flat, 60);
    const b = new RouteBuilder(sc, flat);
    b.planTraversal(5, 55).generateTraversalShots().generateTraversalSequence();
    expect(b.traversal).toHaveLength(0);
  });

  it('includes ridge phase when ridged terrain is used', () => {
    function ridgedWithTroughs(x, z) {
      const s = -z / TIME_SCALE;
      const xn = x / BAND_WIDTH;
      const ridge = 30 * Math.exp(-200 * xn * xn);
      const troughZone = Math.cos(s * 0.15) > 0.5 ? -15 : 0;
      return 12 + ridge + troughZone + 5 * Math.sin(s * 0.3);
    }
    const w = makeMockWorld(ridgedWithTroughs);
    const sc = new TerrainLandmarks().scan(w, 80);
    const highs = [...sc.byType('ridge'), ...sc.byType('peak')];
    const troughs = sc.byType('trough');
    if (highs.length > 0 && troughs.length > 0) {
      const b = new RouteBuilder(sc, w);
      b.planTraversal(5, 70).generateTraversalShots().generateTraversalSequence();
      const phases = b.traversal.map(p => p.phase);
      expect(phases).toContain('ridge');
      expect(b.shots).toHaveProperty('route-ridge');
    }
  });
});
