import { describe, expect, it } from 'vitest';
import ULTRA_HTML from './ULTRA.html?raw';

/**
 * Exercises the journey queue that ships inside ULTRA.html.
 *
 * The template is one big inline script, so it is not importable. Rather than
 * assert on its source text — which passes happily while the behaviour is
 * wrong — this slices out the journey section and *runs* it against stub DOM
 * and stub timers, so the tests fail for the same reason a listener would
 * notice something is broken.
 *
 * The bug being pinned: opening moments are authored to play BEFORE the first
 * track, and the runtime used to queue them and then start the audio in the
 * same breath, so a listener heard them talking over the song.
 */

/** The self-contained journey block, from its state down to journeyTrackChanged. */
function journeySource() {
  const start = ULTRA_HTML.indexOf('var journeyConfig = C.journey');
  const end = ULTRA_HTML.indexOf('function fmt(s){', start);
  if (start < 0 || end < 0) throw new Error('journey section not found in ULTRA.html');
  return ULTRA_HTML.slice(start, end);
}

function fakeElement() {
  const classes = new Set();
  return {
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
      contains: (c) => classes.has(c),
    },
    dataset: {},
    style: {},
    textContent: '',
    removeAttribute() {},
    set src(v) { this._src = v; },
    get src() { return this._src; },
  };
}

/** Boots the journey runtime with controllable time. */
function boot({ releaseMoments = [], trackJourneys = [], coverSrc = '' } = {}) {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, fakeElement());
      return elements.get(id);
    },
  };

  // A manual timer queue, so tests advance time explicitly instead of waiting.
  let now = 0;
  let seq = 0;
  let timers = [];
  const win = {
    setTimeout(fn, ms) {
      const id = ++seq;
      timers.push({ id, at: now + (Number(ms) || 0), fn });
      return id;
    },
    clearTimeout(id) { timers = timers.filter((t) => t.id !== id); },
  };
  function advance(ms) {
    const target = now + ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers = timers.filter((t) => t !== due);
      now = due.at;
      due.fn();
    }
    now = target;
  }

  const played = [];
  const C = { coverSrc, journey: { release_moments: releaseMoments, track_journeys: trackJourneys } };

  const factory = new Function(
    'C', 'document', 'window', 'persistPlayback', 'currentTrack',
    `${journeySource()}
     return {
       queueReleaseMoments: queueReleaseMoments,
       onJourneyQueueDrained: onJourneyQueueDrained,
       flushJourneyDrainCallbacks: flushJourneyDrainCallbacks,
       journeyTrackChanged: journeyTrackChanged,
       synchronizeTrackJourney: synchronizeTrackJourney,
       setStarted: function(v){ journeyStarted = v; },
       state: function(){ return { showing: journeyMomentShowing, queued: journeyMomentQueue.length }; },
       shownTitle: function(){ return document.getElementById('journey-moment-title').textContent; },
     };`,
  );

  const api = factory(C, document, win, () => {}, () => ({ track_id: 't1', disc_number: 1 }));
  api.setStarted(true);
  return {
    ...api, advance, played, play: () => played.push('play'),
    el: (id) => document.getElementById(id),
    host: () => document.getElementById('journey-moment'),
  };
}

const opening = (n) =>
  Array.from({ length: n }, (_, i) => ({
    moment_id: `m${i}`,
    type: 'opening',
    title: `Opening ${i + 1}`,
    placement: 'before_first_track',
    order: i,
    duration_ms: 3000,
  }));

describe('journey moment queue', () => {
  it('shows one moment at a time, not all at once', () => {
    const j = boot({ releaseMoments: opening(3) });
    j.queueReleaseMoments('before_first_track', '', 1);

    expect(j.state().showing).toBe(true);
    expect(j.shownTitle()).toBe('Opening 1');
    expect(j.state().queued).toBe(2);          // the rest wait their turn
  });

  it('advances through moments in authored order', () => {
    const j = boot({ releaseMoments: opening(3) });
    j.queueReleaseMoments('before_first_track', '', 1);

    expect(j.shownTitle()).toBe('Opening 1');
    j.advance(3000 + 900);
    expect(j.shownTitle()).toBe('Opening 2');
    j.advance(3000 + 900);
    expect(j.shownTitle()).toBe('Opening 3');
  });

  it('respects the order field rather than array position', () => {
    const j = boot({
      releaseMoments: [
        { moment_id: 'b', title: 'Second', placement: 'before_first_track', order: 2, duration_ms: 3000 },
        { moment_id: 'a', title: 'First', placement: 'before_first_track', order: 1, duration_ms: 3000 },
      ],
    });
    j.queueReleaseMoments('before_first_track', '', 1);
    expect(j.shownTitle()).toBe('First');
  });

  it('ignores moments belonging to another placement', () => {
    const j = boot({
      releaseMoments: [
        { moment_id: 'a', title: 'Opener', placement: 'before_first_track', duration_ms: 3000 },
        { moment_id: 'z', title: 'Closer', placement: 'after_final_track', duration_ms: 3000 },
      ],
    });
    j.queueReleaseMoments('before_first_track', '', 1);
    expect(j.shownTitle()).toBe('Opener');
    j.advance(3000 + 900);
    expect(j.state().showing).toBe(false);      // the closer must not follow on
    expect(j.state().queued).toBe(0);
  });

  it('never shows the same moment twice', () => {
    const j = boot({ releaseMoments: opening(1) });
    j.queueReleaseMoments('before_first_track', '', 1);
    j.queueReleaseMoments('before_first_track', '', 1);
    expect(j.state().queued).toBe(0);           // the repeat was rejected
  });
});

describe('playback waits for the opening moments', () => {
  it('does not start the music while an opening moment is on screen', () => {
    const j = boot({ releaseMoments: opening(3) });
    j.queueReleaseMoments('before_first_track', '', 1);
    j.onJourneyQueueDrained(j.play);

    expect(j.played).toEqual([]);               // the bug: this used to be ['play']
    j.advance(3000 + 900);
    expect(j.played).toEqual([]);               // still moment 2
    j.advance(3000 + 900);
    expect(j.played).toEqual([]);               // still moment 3
    j.advance(3000 + 900);
    expect(j.played).toEqual(['play']);         // only now
  });

  it('starts immediately when no opening moments were authored', () => {
    const j = boot({ releaseMoments: [] });
    j.queueReleaseMoments('before_first_track', '', 1);
    j.onJourneyQueueDrained(j.play);
    expect(j.played).toEqual(['play']);         // nothing to wait for
  });

  it('fires the callback exactly once', () => {
    const j = boot({ releaseMoments: opening(2) });
    j.queueReleaseMoments('before_first_track', '', 1);
    j.onJourneyQueueDrained(j.play);

    j.advance(60000);
    expect(j.played).toEqual(['play']);
  });

  it('is actually wired up by enterObject', () => {
    // The tests above prove the mechanism works; this proves the entry point
    // uses it. enterObject touches audio and half the DOM, so it cannot be
    // executed here — but the one line that regressed can still be pinned.
    const enter = ULTRA_HTML.slice(
      ULTRA_HTML.indexOf('function enterObject('),
      ULTRA_HTML.indexOf('document.getElementById(\'enter-object\')'),
    );
    expect(enter, 'enterObject not found').toBeTruthy();
    expect(enter).toContain("queueReleaseMoments('before_first_track'");
    expect(enter).toContain('onJourneyQueueDrained(playCurrent)');
    // journeyTrackChanged only fires before_track when a previous track
    // exists, so the opening track needs its own queueing here or a
    // single-track release drops those moments entirely.
    expect(enter).toContain("queueReleaseMoments('before_track'");

    // The regression: playCurrent() called straight after queueing the
    // opening moments, so the music started underneath them.
    const guarded = enter.replace(/else\s*playCurrent\(\);/, '');
    expect(guarded, 'playCurrent must not be called unconditionally')
      .not.toMatch(/if\(shouldPlay!==false\)playCurrent\(\)/);
  });

  it('does not strand playback if a moment is still showing when flushed', () => {
    const j = boot({ releaseMoments: opening(2) });
    j.queueReleaseMoments('before_first_track', '', 1);
    j.onJourneyQueueDrained(j.play);

    j.flushJourneyDrainCallbacks();             // premature flush must be a no-op
    expect(j.played).toEqual([]);

    j.advance(60000);
    expect(j.played).toEqual(['play']);         // and the callback survives it
  });
});

/**
 * A moment authored around the music takes the whole display; a moment timed
 * inside a track cannot, because it would hide the lyric it was written
 * against. `placement` is the discriminator: release moments carry one,
 * track-timed moments carry only `at_ms`.
 */
describe('a moment gets the display or a band, never both', () => {
  const releaseMoment = {
    moment_id: 'r1', type: 'story', placement: 'before_first_track',
    title: 'Before you press play', duration_ms: 4000,
  };
  const trackMoment = {
    moment_id: 't-1', type: 'lyrics', at_ms: 7000,
    title: 'That line', duration_ms: 4000,
  };

  it('gives a release moment the whole page', () => {
    const j = boot({ releaseMoments: [releaseMoment] });
    j.queueReleaseMoments('before_first_track', '', 1);
    expect(j.host().dataset.scope).toBe('chapter');
  });

  it('keeps an in-track moment to a band over the stage', () => {
    const j = boot({ trackJourneys: [{ track_id: 't1', moments: [trackMoment] }] });
    j.journeyTrackChanged(null, { track_id: 't1', disc_number: 1 });
    j.synchronizeTrackJourney(0, 8000);
    expect(j.host().dataset.scope).toBe('inline');
  });

  it('opens a slot on the stage for the band, and closes it after', () => {
    // Without the slot the band lands on top of the words it annotates —
    // exactly the floating-card behaviour this replaced.
    const j = boot({ trackJourneys: [{ track_id: 't1', moments: [trackMoment] }] });
    j.journeyTrackChanged(null, { track_id: 't1', disc_number: 1 });
    j.synchronizeTrackJourney(0, 8000);
    expect(j.el('stage').dataset.moment).toBe('on');

    j.advance(4000 + 900);
    expect(j.el('stage').dataset.moment).toBe('off');
  });

  it('never opens the stage slot for a full-page moment', () => {
    const j = boot({ releaseMoments: [releaseMoment] });
    j.queueReleaseMoments('before_first_track', '', 1);
    expect(j.el('stage').dataset.moment).toBe('off');
  });

  it('holds each page for exactly the duration Studio set', () => {
    // "Force timed": the page has no skip, so the clock is the only way out
    // and it has to match what the artist chose.
    const j = boot({ releaseMoments: [{ ...releaseMoment, duration_ms: 6500 }] });
    j.queueReleaseMoments('before_first_track', '', 1);

    expect(j.el('journey-moment-timer').style.animationDuration).toBe('6500ms');
    j.advance(6400);
    expect(j.state().showing).toBe(true);
    j.advance(200);
    expect(j.state().showing).toBe(false);
  });

  it('floors an unset or absurdly short duration rather than flashing a page', () => {
    const j = boot({ releaseMoments: [{ ...releaseMoment, duration_ms: 10 }] });
    j.queueReleaseMoments('before_first_track', '', 1);
    expect(j.el('journey-moment-timer').style.animationDuration).toBe('3000ms');
  });

  it('dresses a text-only page in the cover rather than leaving it blank', () => {
    const j = boot({ releaseMoments: [releaseMoment], coverSrc: 'cover.jpg' });
    j.queueReleaseMoments('before_first_track', '', 1);
    expect(j.el('journey-moment-bg').style.backgroundImage).toBe('url("cover.jpg")');
  });

  it('prefers the moment’s own visual when it has one', () => {
    const j = boot({
      releaseMoments: [{ ...releaseMoment, asset_src: 'moment.jpg' }],
      coverSrc: 'cover.jpg',
    });
    j.queueReleaseMoments('before_first_track', '', 1);
    expect(j.el('journey-moment-bg').style.backgroundImage).toBe('url("moment.jpg")');
  });

  it('carries the moment type onto the page so it can be shaped', () => {
    const j = boot({ releaseMoments: [{ ...releaseMoment, type: 'title_reveal' }] });
    j.queueReleaseMoments('before_first_track', '', 1);
    expect(j.host().dataset.type).toBe('title_reveal');
  });
});

describe('legacy placement behaviour is unchanged', () => {
  it('does not strand playback if a moment is still showing when flushed', () => {
    const j = boot({ releaseMoments: opening(2) });
    j.queueReleaseMoments('before_first_track', '', 1);
    j.onJourneyQueueDrained(j.play);

    j.flushJourneyDrainCallbacks();             // premature flush must be a no-op
    expect(j.played).toEqual([]);

    j.advance(60000);
    expect(j.played).toEqual(['play']);         // and the callback survives it
  });
});
