import { describe, it, expect } from 'vitest';
import { buildExperienceHTML, buildGuide } from './experience.js';
import { GAME_CATALOG } from '../stores/package.js';
import ULTRA_HTML from '../templates/ULTRA.html?raw';

const base = {
  identity: { artist: 'Test Artist', title: 'Test Title', release_id: 'nz-test-1', year: '2026' },
  edition: { edition_type: 'First Edition' },
  rights: {},
  lyrics: [{ t: 0, text: 'line one' }],
  template: 'ultra-v2',
};

function configOf(html) {
  // NZ_CONFIG is injected as a JSON object assigned to window.NZ_CONFIG
  const m = html.match(/window\.NZ_CONFIG = (\{[\s\S]*?\});\n/);
  expect(m, 'injected NZ_CONFIG not found').toBeTruthy();
  return JSON.parse(m[1]);
}

describe('buildGuide — Studio authoring', () => {
  it('preserves creator order and labels while dropping unavailable moments', () => {
    const guide = buildGuide({
      hasLyrics: false,
      hasPlay: true,
      authored: {
        allowFreeExplore: false,
        nodes: [
          { id: 'play', type: 'interactive', label: 'Enter the rhythm', view: 'view-games' },
          { id: 'lyrics', type: 'lyrics', label: 'Read along', view: 'view-lyrics' },
          { id: 'listen', type: 'listen', label: 'Hear it', view: 'view-player' },
        ],
      },
    });
    expect(guide.allowFreeExplore).toBe(false);
    expect(guide.nodes.map((node) => node.id)).toEqual(['play', 'listen']);
    expect(guide.nodes[0].label).toBe('Enter the rhythm');
  });
});

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

  it('preserves an explicit intensity of 0 (falsy but valid)', () => {
    const cfg = configOf(buildExperienceHTML({ ...base, play: { games: ['bloom'], intensity: 0 } }));
    expect(cfg.play.intensity).toBe(0);
  });

  it('rejects a malformed play block (games not an array)', () => {
    const cfg = configOf(buildExperienceHTML({ ...base, play: { games: 'pulse' } }));
    expect(cfg.play).toBeNull();
    expect(cfg.features).not.toContain('play');
  });

  it('features lists lyrics and play together when both are present', () => {
    const cfg = configOf(buildExperienceHTML({ ...base, play: { games: ['rush'] } }));
    expect(cfg.features).toEqual(['lyrics', 'play']);
  });
});

describe('buildExperienceHTML — injection integrity', () => {
  it('replaces the demo config entirely', () => {
    const html = buildExperienceHTML({ ...base, play: { games: ['pulse'] } });
    expect(html).not.toContain('Test Signal No.1');       // demo title gone
    expect(html).toContain('Test Title');
    expect(configOf(html).releaseId).toBe('nz-test-1');
  });

  it('locks archived theme selections to the ULTRA immersive player', () => {
    const html = buildExperienceHTML({ ...base, template: 'transmission' });
    expect(configOf(html).template).toBe('ultra-v2');
    expect(configOf(html).theme.primary).toBe('#7B5CF0');
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

describe('buildExperienceHTML — script-breakout escaping (XSS regression)', () => {
  it('escapes </script> in creator-controlled fields so it cannot terminate the config script tag', () => {
    const html = buildExperienceHTML({
      ...base,
      identity: { ...base.identity, artist: 'Evil</script><script>alert(1)</script>' },
      lyrics: [{ t: 0, text: '</script><img src=x onerror=alert(1)>' }],
    });
    // The injected config block must not contain a literal closing script tag
    // inside a JSON string — "<" is emitted as < instead.
    const startIdx = html.indexOf('window.NZ_CONFIG =');
    const endIdx = html.indexOf('<\/script>', startIdx);
    const block = html.slice(startIdx, endIdx);
    expect(block).not.toContain('</script>');
    expect(block).toContain('\\u003c');
  });

  it('escaped config still parses to the identical values', () => {
    const artist = 'A</script>B<C';
    const html = buildExperienceHTML({ ...base, identity: { ...base.identity, artist } });
    const m = html.match(/window\.NZ_CONFIG = (\{[\s\S]*?\});\n/);
    expect(JSON.parse(m[1]).artist).toBe(artist);
  });
});
