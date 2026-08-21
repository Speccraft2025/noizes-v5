import { describe, expect, it } from 'vitest';
import { buildWorldData, extractTerrainLandmarks, planGeographicJourney } from './world-data.js';

function makeTerrain(width = 48, height = 16) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let energy = 0.18 + 0.08 * Math.sin(x * 0.21) + 0.05 * Math.cos(y * 0.45);
      let ridge = 0.2 + 0.12 * Math.cos(x * 0.17 - y * 0.5);
      if (Math.abs(x - 8) < 2 && Math.abs(y - 4) < 2) { energy += 0.5; ridge += 0.35; }
      if (Math.abs(x - 18) < 2 && Math.abs(y - 10) < 2) { energy -= 0.12; ridge -= 0.08; }
      if (Math.abs(x - 28) < 2 && Math.abs(y - 5) < 2) { energy += 0.46; ridge += 0.28; }
      if (Math.abs(x - 38) < 2 && Math.abs(y - 11) < 2) { energy -= 0.15; ridge -= 0.12; }
      const offset = (y * width + x) * 4;
      rgba[offset] = Math.round(Math.max(0, Math.min(1, energy)) * 255);
      rgba[offset + 1] = Math.round(Math.max(0, Math.min(1, ridge * 0.8)) * 255);
      rgba[offset + 2] = 0;
      rgba[offset + 3] = Math.round(Math.max(0, Math.min(1, ridge)) * 255);
    }
  }
  return { rgba, width, height, durationSeconds: 96 };
}

describe('extractTerrainLandmarks', () => {
  it('finds stable landmark types from terrain samples', () => {
    const result = extractTerrainLandmarks(makeTerrain());
    expect(result.landmarks.length).toBeGreaterThan(0);
    expect(result.landmarks.some((item) => item.type === 'peak')).toBe(true);
    expect(result.landmarks.some((item) => item.type === 'trough')).toBe(true);
    expect(result.landmarks.some((item) => item.type === 'summit')).toBe(true);
    for (const landmark of result.landmarks) {
      expect(landmark.id).toMatch(/^(peak|trough|ridge|pass|summit|basin)-\d{3}$/);
      expect(landmark.safe_entry).toBeTruthy();
      expect(landmark.safe_exit).toBeTruthy();
    }
  });
});

describe('planGeographicJourney', () => {
  it('builds the required geographic route phases in order', () => {
    const { landmarks } = extractTerrainLandmarks(makeTerrain());
    const journey = planGeographicJourney(landmarks, 96);
    expect(journey.route.map((step) => step.phase)).toEqual([
      'AERIAL_OVERVIEW',
      'PEAK_TRAVERSE',
      'DESCENT',
      'TROUGH',
      'ASCENT',
      'CREST',
      'REVEAL',
      'SECOND_TROUGH',
    ]);
    for (let i = 1; i < journey.route.length; i++) {
      expect(journey.route[i].time).toBeGreaterThan(journey.route[i - 1].time);
    }
  });
});

describe('buildWorldData', () => {
  it('packages scale, landmarks, and journey together', () => {
    const world = buildWorldData({ terrainData: makeTerrain(), durationSeconds: 96 });
    expect(world.version).toBe('2.0.0');
    expect(world.scale.timeScale).toBeGreaterThan(0);
    expect(world.landmarks.length).toBeGreaterThan(0);
    expect(world.journey.route).toHaveLength(8);
  });
});
