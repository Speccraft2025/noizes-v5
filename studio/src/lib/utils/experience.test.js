import { describe, it, expect } from 'vitest';
import { buildExperienceHTML, buildGuide, buildGifts } from './experience.js';
import { GAME_CATALOG, EASTER_EGG_TRIGGERS } from '../stores/package.js';
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

describe('buildGuide — collector note (gift node)', () => {
  it('adds a gift node before end when collector note is present', () => {
    const guide = buildGuide({ collectorNote: 'Thank you for listening.' });
    const ids = guide.nodes.map((n) => n.id);
    expect(ids).toContain('gift');
    expect(ids.indexOf('gift')).toBe(ids.indexOf('end') - 1);
    expect(guide.nodes.find((n) => n.id === 'gift').body).toBe('Thank you for listening.');
  });

  it('omits the gift node when collector note is empty', () => {
    const guide = buildGuide({ collectorNote: '' });
    expect(guide.nodes.map((n) => n.id)).not.toContain('gift');
  });

  it('omits the gift node when collector note is undefined', () => {
    const guide = buildGuide({});
    expect(guide.nodes.map((n) => n.id)).not.toContain('gift');
  });

  it('drops gift node from authored guide when collector note is absent', () => {
    const guide = buildGuide({
      collectorNote: '',
      authored: {
        nodes: [
          { id: 'listen', type: 'listen', label: 'Listen', view: 'view-player' },
          { id: 'gift', type: 'gift', label: 'Secret Note', view: 'intro' },
        ],
      },
    });
    expect(guide.nodes.map((n) => n.id)).toEqual(['listen']);
  });

  it('preserves gift node in authored guide when collector note is present', () => {
    const guide = buildGuide({
      collectorNote: 'You found it.',
      authored: {
        nodes: [
          { id: 'listen', type: 'listen', label: 'Listen', view: 'view-player' },
          { id: 'gift', type: 'gift', label: 'Secret Note', view: 'intro' },
        ],
      },
    });
    expect(guide.nodes.map((n) => n.id)).toEqual(['listen', 'gift']);
    expect(guide.nodes[1].body).toBe('You found it.');
  });
});

describe('buildGifts', () => {
  it('returns null when all gift fields are empty', () => {
    expect(buildGifts({})).toBeNull();
    expect(buildGifts({ collector_note: '', dedication: '', easter_eggs: [] })).toBeNull();
  });

  it('includes only non-empty fields', () => {
    const gifts = buildGifts({ collector_note: 'Hello', dedication: '', easter_eggs: [] });
    expect(gifts).toEqual({ collector_note: 'Hello' });
  });

  it('includes dedication when present', () => {
    const gifts = buildGifts({ dedication: 'For my mother' });
    expect(gifts).toEqual({ dedication: 'For my mother' });
  });

  it('filters easter eggs with empty messages', () => {
    const gifts = buildGifts({
      easter_eggs: [
        { id: 'e1', message: 'Secret!', trigger: 'after_full_listen' },
        { id: 'e2', message: '', trigger: 'cover_tap', taps: 5 },
      ],
    });
    expect(gifts.easter_eggs).toHaveLength(1);
    expect(gifts.easter_eggs[0].message).toBe('Secret!');
  });

  it('normalizes easter egg trigger values', () => {
    const gifts = buildGifts({
      easter_eggs: [
        { id: 'e1', message: 'Time egg', trigger: 'at_timestamp', track_index: 2, seconds: 90 },
        { id: 'e2', message: 'Tap egg', trigger: 'cover_tap', taps: 5 },
        { id: 'e3', message: 'Listen egg', trigger: 'after_full_listen' },
      ],
    });
    expect(gifts.easter_eggs[0]).toEqual({ id: 'e1', message: 'Time egg', trigger: 'at_timestamp', track_index: 2, seconds: 90 });
    expect(gifts.easter_eggs[1]).toEqual({ id: 'e2', message: 'Tap egg', trigger: 'cover_tap', taps: 5 });
    expect(gifts.easter_eggs[2]).toEqual({ id: 'e3', message: 'Listen egg', trigger: 'after_full_listen' });
  });

  it('clamps cover_tap taps to 3–20', () => {
    const gifts = buildGifts({ easter_eggs: [{ id: 'e1', message: 'x', trigger: 'cover_tap', taps: 1 }] });
    expect(gifts.easter_eggs[0].taps).toBe(3);
    const gifts2 = buildGifts({ easter_eggs: [{ id: 'e2', message: 'x', trigger: 'cover_tap', taps: 50 }] });
    expect(gifts2.easter_eggs[0].taps).toBe(20);
  });

  it('trims whitespace from all text fields', () => {
    const gifts = buildGifts({ collector_note: '  hello  ', dedication: '  for you  ', easter_eggs: [{ id: 'e1', message: '  secret  ', trigger: 'after_full_listen' }] });
    expect(gifts.collector_note).toBe('hello');
    expect(gifts.dedication).toBe('for you');
    expect(gifts.easter_eggs[0].message).toBe('secret');
  });
});

describe('EASTER_EGG_TRIGGERS catalog', () => {
  it('has unique ids', () => {
    const ids = EASTER_EGG_TRIGGERS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every trigger has a name and hint', () => {
    for (const t of EASTER_EGG_TRIGGERS) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.hint.length).toBeGreaterThan(0);
    }
  });
});

describe('buildExperienceHTML — gifts block', () => {
  it('bakes gifts into NZ_CONFIG when extras have gift content', () => {
    const cfg = configOf(buildExperienceHTML({
      ...base,
      extras: { collector_note: 'Thank you', dedication: 'For you', easter_eggs: [] },
    }));
    expect(cfg.gifts).toEqual({ collector_note: 'Thank you', dedication: 'For you' });
  });

  it('omits gifts from NZ_CONFIG when extras are empty', () => {
    const cfg = configOf(buildExperienceHTML({ ...base, extras: {} }));
    expect(cfg.gifts).toBeNull();
  });

  it('bakes easter eggs into the gifts block', () => {
    const cfg = configOf(buildExperienceHTML({
      ...base,
      extras: { easter_eggs: [{ id: 'e1', message: 'Hidden', trigger: 'cover_tap', taps: 10 }] },
    }));
    expect(cfg.gifts.easter_eggs).toHaveLength(1);
    expect(cfg.gifts.easter_eggs[0].trigger).toBe('cover_tap');
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

  it('uses an immersive entry, spatial menu, and shared Note Wall view instead of visible tabs', () => {
    expect(ULTRA_HTML).toContain('id="enter-object"');
    expect(ULTRA_HTML).toContain('id="guide-drawer" aria-label="Experience menu"');
    expect(ULTRA_HTML).toContain('data-menu-view="view-player"');
    expect(ULTRA_HTML).toContain('id="view-notes"');
    expect(ULTRA_HTML).toMatch(/\.tabs\{[\s\S]*?display:none/);
  });

  it('ships the release playback engine, tracklist, standby handoff, and resume state', () => {
    expect(ULTRA_HTML).toContain('id="view-tracklist"');
    expect(ULTRA_HTML).toContain('id="audio-next"');
    expect(ULTRA_HTML).toContain('window.NZ_PLAYBACK=');
    expect(ULTRA_HTML).toContain("playbackSettings.mode==='crossfade'");
    expect(ULTRA_HTML).toContain("playbackSettings.mode==='gapless'");
    expect(ULTRA_HTML).toContain("'nz-release-resume:'");
  });

  it('ships synchronized Journey Moments and persists their visited state', () => {
    expect(ULTRA_HTML).toContain('id="journey-moment"');
    expect(ULTRA_HTML).toContain('window.NZ_JOURNEY=');
    expect(ULTRA_HTML).toContain('journey_moments_visited');
    expect(ULTRA_HTML).toContain('synchronizeTrackJourney');
  });

  it('ships distinct Archive and release-copy History object spaces', () => {
    expect(ULTRA_HTML).toContain('id="view-archive"');
    expect(ULTRA_HTML).toContain('id="view-history"');
    expect(ULTRA_HTML).toContain('window.NZ_ARCHIVE=');
    expect(ULTRA_HTML).toContain('window.NZ_HISTORY=');
    expect(ULTRA_HTML).toContain('never become separate ownership chains');
  });

  it('keeps every generated inline script syntactically valid', () => {
    const html = buildExperienceHTML({ ...base, play: { games: ['pulse'] } });
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
    expect(scripts.length).toBeGreaterThan(1);
    for (const source of scripts) expect(() => new Function(source)).not.toThrow();
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
