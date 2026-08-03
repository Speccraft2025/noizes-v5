import { describe, expect, it } from 'vitest';
import ULTRA_HTML from './ULTRA.html?raw';

/**
 * Switching between takes of the same performance must carry the playhead.
 *
 * The whole point of the feature is that a listener hears the acapella from
 * where they were, not from the top. So these run the real switching code
 * against a stub audio element rather than asserting on source text.
 *
 * The clamp is the subtle bit: seeking past the end of a media element
 * silently lands at 0, which looks exactly like the restart being avoided.
 */

function versionSource() {
  const start = ULTRA_HTML.indexOf('/* ── Switchable sources');
  const end = ULTRA_HTML.indexOf('function renderPlayerTitle(', start);
  if (start < 0 || end < 0) throw new Error('version-switch section not found in ULTRA.html');
  return ULTRA_HTML.slice(start, end);
}

function fakeChip() {
  const attrs = {};
  return {
    attrs,
    listeners: {},
    set type(v) { attrs.type = v; },
    set className(v) { attrs.className = v; },
    set textContent(v) { attrs.textContent = v; },
    get textContent() { return attrs.textContent; },
    set disabled(v) { attrs.disabled = v; },
    setAttribute(k, v) { attrs[k] = v; },
    getAttribute(k) { return attrs[k] ?? null; },
    addEventListener(name, fn) { this.listeners[name] = fn; },
  };
}

function boot({ versions, duration = 60, position = 0, paused = true }) {
  const host = { hidden: false, innerHTML: '', children: [], appendChild(c) { this.children.push(c); } };
  const document = {
    getElementById: (id) => (id === 'version-switch' ? host : null),
    createElement: () => fakeChip(),
  };

  const loadListeners = [];
  const audio = {
    src: versions.find((v) => v.is_primary)?.src ?? versions[0]?.src ?? '',
    currentTime: position,
    duration,
    paused,
    played: false,
    pause() { this.paused = true; },
    play() { this.played = true; this.paused = false; return { catch() {} }; },
    load() { /* resolved explicitly by the test via settle() */ },
    addEventListener(name, fn) { if (name === 'loadedmetadata') loadListeners.push(fn); },
    removeEventListener(name, fn) {
      const i = loadListeners.indexOf(fn);
      if (i >= 0) loadListeners.splice(i, 1);
    },
  };

  const track = { track_id: 't1', versions };
  const factory = new Function(
    'document', 'audio', 'currentTrack', 'cancelTransition', 'persistPlayback',
    `${versionSource()}
     return {
       switchAudioVersion: switchAudioVersion,
       renderVersionSwitch: renderVersionSwitch,
       activeVersionId: activeVersionId,
     };`,
  );

  const api = factory(document, audio, () => track, () => {}, () => {});
  // Simulate the browser finishing the load of the new source.
  const settle = (newDuration) => {
    if (newDuration !== undefined) audio.duration = newDuration;
    [...loadListeners].forEach((fn) => fn());
  };
  return { ...api, audio, host, track, settle };
}

const takes = [
  { version_id: 'v-main', role: 'primary_master', title: 'Main', is_primary: true, src: 'a/main.wav' },
  { version_id: 'v-acap', role: 'acapella', title: 'Acapella', is_primary: false, src: 'a/acap.wav' },
];

describe('switching takes', () => {
  it('lands on the exact same position', () => {
    const j = boot({ versions: takes, position: 12.5 });
    j.switchAudioVersion('v-acap');
    j.settle();

    expect(j.audio.src).toBe('a/acap.wav');
    expect(j.audio.currentTime).toBe(12.5);
  });

  it('keeps playing if it was playing, and stays paused if it was not', () => {
    const playing = boot({ versions: takes, position: 5, paused: false });
    playing.switchAudioVersion('v-acap');
    playing.settle();
    expect(playing.audio.played).toBe(true);

    const idle = boot({ versions: takes, position: 5, paused: true });
    idle.switchAudioVersion('v-acap');
    idle.settle();
    expect(idle.audio.played).toBe(false);
    expect(idle.audio.currentTime).toBe(5);
  });

  it('clamps rather than restarting when the alternate is shorter', () => {
    // Seeking past the end lands at 0 — indistinguishable from a restart,
    // which is the exact failure this feature exists to avoid.
    const j = boot({ versions: takes, position: 59.5, duration: 60 });
    j.switchAudioVersion('v-acap');
    j.settle(58);                            // the acapella is 2s shorter

    expect(j.audio.currentTime).toBeLessThanOrEqual(58);
    expect(j.audio.currentTime).toBeGreaterThan(57);
    expect(j.audio.currentTime).not.toBe(0);
  });

  it('survives a source whose duration is unknown', () => {
    const j = boot({ versions: takes, position: 8 });
    j.switchAudioVersion('v-acap');
    j.settle(NaN);
    expect(j.audio.currentTime).toBe(8);
  });

  it('ignores a switch to the take already playing', () => {
    const j = boot({ versions: takes, position: 4 });
    j.switchAudioVersion('v-main');          // already active
    expect(j.audio.src).toBe('a/main.wav');
    expect(j.audio.currentTime).toBe(4);
  });

  it('ignores an unknown version id rather than muting the track', () => {
    const j = boot({ versions: takes, position: 4 });
    j.switchAudioVersion('v-nope');
    expect(j.audio.src).toBe('a/main.wav');
  });

  it('refuses a second switch while one is still loading', () => {
    // Two overlapping loads would race, and the loser would win the seek.
    const j = boot({ versions: takes, position: 10 });
    j.switchAudioVersion('v-acap');
    j.switchAudioVersion('v-main');          // must be ignored mid-flight
    j.settle();
    expect(j.audio.src).toBe('a/acap.wav');
    expect(j.audio.currentTime).toBe(10);
  });
});

describe('the switcher control', () => {
  it('defaults to the primary take', () => {
    const j = boot({ versions: takes });
    expect(j.activeVersionId(j.track)).toBe('v-main');
  });

  it('falls back to the first take when none is marked primary', () => {
    const unmarked = takes.map((v) => ({ ...v, is_primary: false }));
    const j = boot({ versions: unmarked });
    expect(j.activeVersionId(j.track)).toBe('v-main');
  });

  it('stays hidden when there is only one take', () => {
    const j = boot({ versions: [takes[0]] });
    j.renderVersionSwitch();
    expect(j.host.hidden).toBe(true);
    expect(j.host.children).toHaveLength(0);
  });

  it('marks exactly one chip pressed', () => {
    const j = boot({ versions: takes });
    j.renderVersionSwitch();

    const pressed = j.host.children.filter((c) => c.getAttribute('aria-pressed') === 'true');
    expect(j.host.children).toHaveLength(2);
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toBe('Main');
  });
});
