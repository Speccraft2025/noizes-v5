import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { play, GAME_CATALOG } from './package.js';

describe('GAME_CATALOG invariants', () => {
  it('has nine games with unique ids and complete display fields', () => {
    expect(GAME_CATALOG).toHaveLength(9);
    const ids = GAME_CATALOG.map(g => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of GAME_CATALOG) {
      expect(g.id).toMatch(/^[a-z]+$/);
      expect(g.name.length).toBeGreaterThan(0);
      expect(g.hint.length).toBeGreaterThan(0);
      expect(['toy', 'rhythm', 'arcade']).toContain(g.kind);
    }
  });

  it('play store defaults to no games at standard difficulty, intensity 1', () => {
    const p = get(play);
    expect(p).toEqual({ games: [], difficulty: 'standard', intensity: 1 });
    // default intensity sits inside the UI slider range (0.4–1.4)
    expect(p.intensity).toBeGreaterThanOrEqual(0.4);
    expect(p.intensity).toBeLessThanOrEqual(1.4);
  });
});
