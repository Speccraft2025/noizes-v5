import { describe, expect, it } from 'vitest';
import ULTRA_HTML from './ULTRA.html?raw';

/**
 * Playback and lyrics are one screen.
 *
 * They used to be two views you tabbed between, which meant the words were
 * never on screen with the record singing them. 'view-lyrics' still exists as
 * a name — authored guides, saved resume state and the hidden tab bar all
 * refer to it — but it now resolves to the same stage with the full lyric
 * sheet raised.
 */

function slice(from, to) {
  const start = ULTRA_HTML.indexOf(from);
  const end = ULTRA_HTML.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error(`section not found: ${from}`);
  return ULTRA_HTML.slice(start, end);
}

describe('the stage', () => {
  it('carries playback and the live lyric in one view', () => {
    const stage = slice('<!-- ── THE STAGE', '<!-- ── RELEASE TRACKLIST');
    for (const id of ['p-cover-thumb', 'p-title', 'lyric-current', 'lyric-prev', 'lyric-next', 'btn-play', 'prog-outer']) {
      expect(stage, `${id} must live on the stage`).toContain(`id="${id}"`);
    }
    // …and only one of them, inside the single player view.
    expect(ULTRA_HTML.match(/id="lyric-current"/g)).toHaveLength(1);
  });

  it('no longer ships a separate lyrics view to tab away to', () => {
    expect(ULTRA_HTML).not.toContain('<div class="view" id="view-lyrics"');
  });

  it('still answers to view-lyrics, by raising the sheet on the same stage', () => {
    const fn = slice('function switchView(target){', '\ndocument.querySelectorAll(\'.tab\')');
    expect(fn).toContain("target==='view-lyrics'");
    expect(fn).toContain("target='view-player'");
    expect(fn).toContain('openLyricSheet(true)');
  });

  it('offers play, seek, skip, volume, balance and take-switching together', () => {
    const stage = slice('<!-- ── THE STAGE', '<!-- ── RELEASE TRACKLIST');
    for (const id of ['btn-prev', 'btn-next', 'btn-play', 'vol', 'pan', 'btn-mute', 'btn-pan-reset', 'version-switch']) {
      expect(stage, `transport is missing ${id}`).toContain(`id="${id}"`);
    }
  });

  it('drives progress from a frame loop, not from timeupdate alone', () => {
    // timeupdate fires ~4×/s. A progress bar and a lyric that is meant to land
    // on the beat cannot be driven from it without looking stepped.
    expect(ULTRA_HTML).toContain('frame=requestAnimationFrame(tick)');
    const tick = slice('function tick(){', '  frame=requestAnimationFrame(tick);\n})();');
    expect(tick).toContain('setProgress(at/duration,at)');
    expect(tick).toContain('updateLyrics(');
    expect(tick, 'a paused, still stage must not burn a frame budget')
      .toContain('if(audio.paused&&!transitioning)return;');
  });

  it('hides the lyric half of the stage for an instrumental', () => {
    expect(ULTRA_HTML).toContain("stage.dataset.lyrics=C.lyrics.length?'on':'off'");
    expect(ULTRA_HTML).toMatch(/\.stage\[data-lyrics="off"\] \.stage-lyrics\{display:none/);
  });
});

describe('the record closes on something', () => {
  it('ships a closing page built from the object’s own credits', () => {
    const fn = slice('function defaultClosingMoment(){', 'function advanceTrack(){');
    expect(fn).toContain("placement:'after_final_track'");
    expect(fn).toContain('rights.copyright');
    expect(fn).toContain('rights.credits');
    expect(fn).toContain("type:'credits'");
  });

  it('uses it only when the artist authored no closing moment of their own', () => {
    const fn = slice('function advanceTrack(){', 'audio.addEventListener(\'loadedmetadata\'');
    // visitedMomentIds only grows when a moment is actually accepted, so an
    // authored closer — or one that already played — suppresses the default.
    expect(fn).toContain('var queuedBefore=visitedMomentIds.length;');
    expect(fn).toContain("queueReleaseMoments('after_final_track'");
    expect(fn).toContain('if(visitedMomentIds.length===queuedBefore)queueJourneyMoment(defaultClosingMoment())');
  });

  it('returns to the gate once the closing pages have finished, not during', () => {
    const fn = slice('function advanceTrack(){', 'audio.addEventListener(\'loadedmetadata\'');
    expect(fn, 'the gate must wait for the credits to play out')
      .toContain('onJourneyQueueDrained(showClosingGate)');
  });

  it('restarts a finished object rather than resuming its silent last second', () => {
    const handler = slice("document.getElementById('enter-object').addEventListener", 'localStorage.removeItem(resumeKey)');
    expect(handler).toContain('if(releaseCompleted)');
    expect(handler).toContain('completedTrackIds=[]');
    expect(handler).toContain('visitedMomentIds=[]');
    expect(handler).toContain('loadTrack(0,{position:0,autoplay:false})');
  });
});

describe('a package mounted at zero size still works', () => {
  it('waits for a viewport instead of throwing out of the whole script', () => {
    // getImageData on a zero-width canvas throws, and an uncaught throw here
    // aborts every statement after it — no audio element, no transport, no
    // experience. A gallery iframe that has not been laid out hits this.
    const draw = slice('  function draw(){', '  draw();');
    expect(draw).toContain('if(vw < 2 || vh < 2) return;');
    expect(draw, 'the grain is decorative and must never throw').toContain('catch(ignore){}');
  });

  it('repaints once the container finally has a size', () => {
    const iife = slice('  var lastW = 0, lastH = 0;', '/* ═══════════════════════════════════════════════════\n   2. TAB NAVIGATION');
    expect(iife).toContain('ResizeObserver');
    expect(iife).toContain('observe(document.documentElement)');
  });
});
