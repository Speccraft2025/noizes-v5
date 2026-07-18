import { describe, it, expect } from 'vitest';
import { buildExperienceHTML } from './experience.js';
import { GAME_CATALOG } from '../stores/package.js';
import ULTRA_HTML from '../templates/ULTRA.html?raw';

const base = {
  identity: { artist: 'Test Artist', title: 'Test Title', release_id: 'nz-test-1', year: '2026' },
  edition: { edition_type: 'First Edition' },
  rights: {},
  lyrics: [{ t: 0, text: 'line one' }],
  template: 'ultra',
};

function configOf(html) {
  // NZ_CONFIG is injected as a JSON object assigned to window.NZ_CONFIG
  const m = html.match(/window\.NZ_CONFIG = (\{[\s\S]*?\});\n/);
  expect(m, 'injected NZ_CONFIG not found').toBeTruthy();
  return JSON.parse(m[1]);
}

describe('buildExperienceHTML — play block', () => {
  it('bakes the play block when games are enabled', () => {
    const html = buildExperienceHTML({
      ...base,
      play: { games: ['pulse', 'clash'], difficulty: 'sharp', intensity: 1.2 },
    });
    const cfg = configOf(html);
    expect(cfg.play).toEqual({ games: ['pulse', 'clash'], difficulty: 'sharp', intensity: 1.2 });
    expect(cfg.features).toContain('play');
  });

  it('omits the play block when no games are selected', () => {
    const html = buildExperienceHTML({ ...base, play: { games: [], difficulty: 'standard', intensity: 1 } });
    const cfg = configOf(html);
    expect(cfg.play).toBeNull();
    expect(cfg.features).not.toContain('play');
  });

  it('omits the play block when play is undefined (v1 callers)', () => {
    const cfg = configOf(buildExperienceHTML({ ...base }));
    expect(cfg.play).toBeNull();
  });

  it('defaults difficulty and intensity when unset', () => {
    const cfg = configOf(buildExperienceHTML({ ...base, play: { games: ['bloom'] } }));
    expect(cfg.play.difficulty).toBe('standard');
    expect(cfg.play.intensity).toBe(1);
  });
});

describe('buildExperienceHTML — injection integrity', () => {
  it('replaces the demo config entirely', () => {
    const html = buildExperienceHTML({ ...base, play: { games: ['pulse'] } });
    expect(html).not.toContain('Test Signal No.1');       // demo title gone
    expect(html).toContain('Test Title');
    expect(configOf(html).releaseId).toBe('nz-test-1');
  });

  it('applies the selected theme palette', () => {
    const html = buildExperienceHTML({ ...base, template: 'transmission' });
    expect(configOf(html).theme.primary).toBe('#F0A84B');
  });
});

describe('template ↔ catalog contract', () => {
  it('every game the Studio offers exists in the template engine', () => {
    for (const g of GAME_CATALOG) {
      // GAME_META keys and the GAMES registry must both know this id
      expect(ULTRA_HTML, `GAME_META missing '${g.id}'`).toMatch(new RegExp(`${g.id}:\\s*\\{name:`));
      expect(ULTRA_HTML, `GAMES registry missing '${g.id}'`).toMatch(new RegExp(`${g.id}:${g.id}Game`));
    }
  });

  it('template gates the Games tab on the play block', () => {
    expect(ULTRA_HTML).toContain("if(!PLAY || !PLAY.games || !PLAY.games.length) return;");
  });
});
