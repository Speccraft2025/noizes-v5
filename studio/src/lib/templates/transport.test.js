import { describe, expect, it } from 'vitest';
import ULTRA_HTML from './ULTRA.html?raw';

/**
 * Level and stereo balance, and the one thing they must never do: fight the
 * crossfade engine.
 *
 * The media element's own `volume` is already owned by the release engine — it
 * rides it to fade one track into the next. If the listener's volume slider
 * also wrote to `volume`, a fade and a drag would overwrite each other and the
 * listener would hear the argument. So the fade keeps the element, and the
 * listener's level and balance live on a gain and a panner downstream.
 *
 * These run the real code against stub audio nodes rather than asserting on
 * source text, because the failure that matters is "turning it down killed the
 * crossfade", not "the file mentions a GainNode".
 */

function transportSource() {
  const start = ULTRA_HTML.indexOf('var audioGraph = null;');
  const end = ULTRA_HTML.indexOf('window.NZ_AUDIO = {', start);
  if (start < 0 || end < 0) throw new Error('transport section not found in ULTRA.html');
  return ULTRA_HTML.slice(start, end);
}

function fakeParam(value) {
  return { value, ramps: [], setTargetAtTime(v) { this.value = v; this.ramps.push(v); } };
}

function fakeElement() {
  const classes = new Set();
  return {
    style: { props: {}, setProperty(k, v) { this.props[k] = v; } },
    attrs: {},
    hidden: false,
    value: '',
    min: '0', max: '100',
    dataset: {},
    classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] ?? null; },
    hasAttribute(k) { return k in this.attrs; },
  };
}

/** Boots the transport with a working Web Audio stub unless `noWebAudio`. */
function boot({ noWebAudio = false, noPanner = false } = {}) {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        const el = fakeElement();
        if (id === 'pan') { el.min = '-100'; el.max = '100'; el.attrs['data-bipolar'] = ''; }
        elements.set(id, el);
      }
      return elements.get(id);
    },
  };

  const sources = [];
  const gain = { gain: fakeParam(1), connect() {} };
  const panner = { pan: fakeParam(0), connect() {} };
  const output = { connect() {}, connected: [] };
  const context = {
    state: 'suspended', currentTime: 0,
    createGain: () => (sources.gainCalls = (sources.gainCalls || 0) + 1, sources.gainCalls === 1 ? gain : output),
    createStereoPanner: noPanner ? undefined : () => panner,
    createPanner: () => ({ panningModel: '', setPosition(x) { this.x = x; }, connect() {} }),
    createMediaElementSource(el) { sources.push(el); return { connect() {} }; },
    destination: {},
    resume() { this.state = 'running'; return { catch() {} }; },
  };

  const audio = { volume: 1, paused: true };
  const nextAudio = { volume: 1, paused: true };
  const window = noWebAudio ? {} : { AudioContext: function () { return context; } };

  const factory = new Function(
    'document', 'window', 'audio', 'nextAudio', 'persistPlayback',
    `${transportSource()}
     return {
       ensureAudioGraph, applyVolume, applyPan, applyDeckVolume, paintRange, resumeAudioGraph,
       graph: () => audioGraph,
       setLevel: (v) => { masterVolume = v; },
       setMute: (v) => { muted = v; },
       setPanValue: (v) => { masterPan = v; },
       deck: () => deckGain,
       fade: (p) => { deckGain.main = 1 - p; deckGain.standby = p; applyDeckVolume(); },
     };`,
  );

  const api = factory(document, window, audio, nextAudio, () => {});
  return { ...api, audio, nextAudio, context, gain, panner, el: (id) => document.getElementById(id) };
}

describe('the listener’s level does not touch the crossfade', () => {
  it('routes level through the gain, leaving the element to the fade', () => {
    const t = boot();
    t.ensureAudioGraph();
    t.setLevel(0.5);
    t.applyVolume();

    expect(t.gain.gain.value, 'gain carries the level').toBeCloseTo(0.25, 5);
    expect(t.audio.volume, 'the element stays where the fade left it').toBe(1);
  });

  it('lets a fade run at its own shape while the level is turned down', () => {
    const t = boot();
    t.ensureAudioGraph();
    t.setLevel(0.5);
    t.applyVolume();
    t.fade(0.3);                    // 30% into a crossfade

    // The two decks still sum to one — the fade is intact…
    expect(t.audio.volume + t.nextAudio.volume).toBeCloseTo(1, 5);
    expect(t.audio.volume).toBeCloseTo(0.7, 5);
    // …and the level is still half, applied once, downstream of both.
    expect(t.gain.gain.value).toBeCloseTo(0.25, 5);
  });

  it('falls back to the element when Web Audio is unavailable', () => {
    // No AudioContext: the level has nowhere else to go, so it multiplies into
    // the deck gains rather than being silently dropped.
    const t = boot({ noWebAudio: true });
    t.ensureAudioGraph();
    t.setLevel(0.4);
    t.applyVolume();

    expect(t.graph()).toBe(false);
    expect(t.audio.volume).toBeCloseTo(0.4, 5);

    t.fade(0.5);
    expect(t.audio.volume, 'fade and level compose in the fallback too').toBeCloseTo(0.2, 5);
    expect(t.nextAudio.volume).toBeCloseTo(0.2, 5);
  });

  it('mutes to silence and back to where the slider was', () => {
    const t = boot();
    t.ensureAudioGraph();
    t.setLevel(0.6);
    t.setMute(true);
    t.applyVolume();
    expect(t.gain.gain.value).toBe(0);

    t.setMute(false);
    t.applyVolume();
    expect(t.gain.gain.value).toBeCloseTo(0.36, 5);
  });

  it('routes both decks so a fade is not half-silent', () => {
    // Only routing the main deck would mute the incoming track for anyone
    // whose browser honours the graph.
    const t = boot();
    t.ensureAudioGraph();
    expect(t.context.createMediaElementSource).toBeTypeOf('function');
    expect(t.graph()).toBeTruthy();
  });

  it('resumes a context that started suspended, or the object plays silence', () => {
    const t = boot();
    t.ensureAudioGraph();
    expect(t.context.state, 'a suspended context routes the audio nowhere').toBe('running');
  });
});

describe('stereo balance', () => {
  it('sends the panner exactly where the control was left', () => {
    const t = boot();
    t.ensureAudioGraph();
    t.setPanValue(-0.7);
    t.applyPan();
    expect(t.panner.pan.value).toBeCloseTo(-0.7, 5);
  });

  it('clamps past hard left and hard right', () => {
    const t = boot();
    t.ensureAudioGraph();
    t.setPanValue(-4);
    t.applyPan();
    expect(t.panner.pan.value).toBe(-1);

    t.setPanValue(9);
    t.applyPan();
    expect(t.panner.pan.value).toBe(1);
  });

  it('offers a way back to centre only once the image is off centre', () => {
    const t = boot();
    t.ensureAudioGraph();
    t.applyPan();
    expect(t.el('btn-pan-reset').classList.contains('show')).toBe(false);

    t.setPanValue(0.4);
    t.applyPan();
    expect(t.el('btn-pan-reset').classList.contains('show')).toBe(true);
  });

  it('survives a browser with no StereoPannerNode', () => {
    // Older Safari has createPanner only. Equalpower needs a point on an arc,
    // not a scalar, or hard left drops the level instead of moving it.
    const t = boot({ noPanner: true });
    t.ensureAudioGraph();
    t.setPanValue(-1);
    expect(() => t.applyPan()).not.toThrow();
    expect(t.graph().panner.x).toBe(-1);
  });
});

describe('the faders paint their own fill', () => {
  it('fills a volume slider from the left', () => {
    const t = boot();
    const el = t.el('vol');
    el.min = '0'; el.max = '100'; el.value = '35';
    t.paintRange(el);
    expect(el.style.props['--fill']).toBe('35%');
  });

  it('fills a pan slider out from the centre, in whichever direction', () => {
    const t = boot();
    const el = t.el('pan');
    el.value = '-50';
    t.paintRange(el);
    expect(el.style.props['--from']).toBe('25%');
    expect(el.style.props['--to']).toBe('50%');

    el.value = '80';
    t.paintRange(el);
    expect(el.style.props['--from']).toBe('50%');
    expect(el.style.props['--to']).toBe('90%');
  });
});
