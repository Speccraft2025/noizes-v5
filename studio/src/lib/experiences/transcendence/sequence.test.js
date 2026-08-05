import { describe, it, expect } from 'vitest';
import { apexTime, generateSequence, ITINERARY, measuredAnchors } from './sequence.js';

const analysis = ({ duration = 240, sections = [], phrases = [], vocal = [] } = {}) => ({
  duration_seconds: duration,
  sections,
  phrases: phrases.map(([start, end, peak_voice = 0.5]) => ({ start, end, peak_voice })),
  vocal_phrases: vocal.map(([start, end, peak = 0.7]) => ({ start, end, peak })),
});

const times = cues => cues.map(cue => cue.time);

describe('measuredAnchors', () => {
  it('separates vocal onsets from structural boundaries', () => {
    const { voice, structural } = measuredAnchors(analysis({
      sections: [30, 90], phrases: [[10, 20]], vocal: [[18.5, 29]],
    }));
    expect(voice).toEqual([18.5]);
    expect(structural).toEqual([10, 30, 90]);
  });

  it('copes with a payload that measured nothing', () => {
    expect(measuredAnchors({})).toEqual({ voice: [], structural: [] });
  });
});

describe('apexTime', () => {
  it('picks the loudest sustained moment', () => {
    const at = apexTime(analysis({ vocal: [[20, 30, 0.6], [80, 95, 0.95], [140, 150, 0.7]] }), 999);
    expect(at).toBe(80);
  });

  it('falls back when nothing was measured', () => {
    expect(apexTime({}, 42)).toBe(42);
  });
});

describe('generateSequence', () => {
  const built = generateSequence({
    analysis: analysis({
      duration: 240,
      sections: [12, 36, 64, 100, 138, 176, 205],
      phrases: [[8, 30], [40, 70], [104, 140]],
      vocal: [[43.5, 58], [107.2, 130], [150.5, 168], [182.4, 198]],
    }),
  });

  it('opens at zero and closes on the arc end', () => {
    expect(built.cues[0].time).toBe(0);
    expect(built.cues[0].phase).toBe('atlas');
    expect(built.cues.at(-1).time).toBe(240);
    expect(built.cues.at(-1).terminal).toBe(true);
  });

  it('produces strictly increasing times', () => {
    const t = times(built.cues);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
  });

  it('follows the authored camera itinerary so consecutive shots chain', () => {
    // The generator must never reorder the shot vocabulary: each shot's `from`
    // framing is the previous shot's `to`, and reordering them would turn the
    // flight into a series of jumps.
    const order = ITINERARY.map(step => step.shot);
    const produced = built.cues.map(cue => cue.shot);
    let cursor = -1;
    for (const shot of produced) {
      const next = order.indexOf(shot, cursor + 1);
      expect(next, `${shot} out of itinerary order`).toBeGreaterThan(cursor - 1);
      cursor = Math.max(cursor, next);
    }
  });

  it('anchors most cues to measured events rather than to proportions', () => {
    expect(built.snapped).toBeGreaterThan(4);
    const anchored = built.cues.filter(cue => cue.anchored_to.startsWith('measured'));
    expect(anchored.length).toBe(built.snapped);
  });

  it('puts the apex on the loudest measured moment when the itinerary allows it', () => {
    const late = generateSequence({
      analysis: analysis({
        duration: 240,
        sections: [12, 36, 64, 100, 138, 176],
        vocal: [[43.5, 58, 0.6], [107.2, 130, 0.7], [211.4, 228, 0.98]],
      }),
    });
    const apex = late.cues.find(cue => cue.phase === 'apex');
    expect(apex.anchored_to).toBe('measured-peak');
    expect(apex.time).toBe(211.4);
  });

  it('falls back to proportional — and says so — when the peak lands too early', () => {
    // The itinerary puts the apex at 88% of the arc. A track whose loudest moment
    // is at 76% cannot have both, because reordering the shots would break the
    // camera chain. The cue must not claim a measurement it did not use.
    const apex = built.cues.find(cue => cue.phase === 'apex');
    expect(apex).toBeTruthy();
    expect(apex.anchored_to).toBe('proportional');
    expect(apex.time).not.toBe(182.4);
  });

  it('lands voice beats on real vocal onsets', () => {
    const voiceCues = built.cues.filter(cue => cue.phase === 'voice' && cue.anchored_to === 'measured-vocal-onset');
    expect(voiceCues.length).toBeGreaterThan(0);
    for (const cue of voiceCues) {
      expect([43.5, 107.2, 150.5, 182.4]).toContain(cue.time);
    }
  });

  it('gives every cue a title, a scene and world settings', () => {
    for (const cue of built.cues) {
      expect(cue.title, cue.id).toBeTruthy();
      expect(cue.scene, cue.id).toBeTruthy();
      expect(cue.world.air, cue.id).toBeTypeOf('number');
      expect(cue.world.relief, cue.id).toBeTypeOf('number');
    }
  });

  it('says nothing about any particular recording in its prose', () => {
    const prose = built.cues.map(cue => `${cue.title} ${cue.scene}`).join(' ');
    for (const term of ['1902', 'violin', 'tenor', 'Macdonough', 'shellac', 'horn']) {
      expect(prose, `generated prose mentions ${term}`).not.toContain(term);
    }
  });

  it('respects a shorter authored arc than the track', () => {
    const short = generateSequence({
      analysis: analysis({ duration: 240, sections: [12, 36, 64] }),
      arcEndSeconds: 60,
    });
    expect(short.arcEnd).toBe(60);
    expect(short.cues.at(-1).time).toBe(60);
    for (const cue of short.cues) expect(cue.time).toBeLessThanOrEqual(60);
  });

  it('never lets the arc run past the track', () => {
    const clamped = generateSequence({ analysis: analysis({ duration: 30 }), arcEndSeconds: 500 });
    expect(clamped.arcEnd).toBe(30);
  });

  it('compresses onto a short track without stacking two cues on one instant', () => {
    for (const duration of [3, 6, 8, 15, 40]) {
      const short = generateSequence({ analysis: analysis({ duration }) });
      const t = times(short.cues);
      expect(t.length, `${duration}s produced no cues`).toBeGreaterThan(1);
      for (let i = 1; i < t.length; i++) {
        expect(t[i], `${duration}s: cue ${i} collides`).toBeGreaterThan(t[i - 1]);
      }
      expect(short.cues.at(-1).terminal).toBe(true);
      expect(short.cues.at(-1).time).toBe(duration);
    }
  });

  it('refuses a track with no measured duration', () => {
    expect(() => generateSequence({ analysis: { duration_seconds: 0 } })).toThrow(/duration/i);
  });
});

describe('generateSequence — lyric landmarks', () => {
  const base = analysis({
    duration: 200,
    sections: [20, 60, 110, 160],
    vocal: [[35.5, 50], [96.2, 118], [140.4, 158]],
  });

  it('carries every placed line onto a cue', () => {
    const landmarks = [
      { line: 0, time: 36, band: 60 },
      { line: 1, time: 97, band: 64 },
      { line: 2, time: 141, band: 58 },
    ];
    const { cues } = generateSequence({ analysis: base, landmarks });
    const carried = cues.filter(cue => cue.lyric !== undefined).map(cue => cue.lyric);
    expect(carried.sort()).toEqual([0, 1, 2]);
    for (const cue of cues.filter(c => c.lyric !== undefined)) {
      expect(cue.engrave).toBe(true);
    }
  });

  it('prefers a voice-phase cue as the host', () => {
    const { cues } = generateSequence({ analysis: base, landmarks: [{ line: 0, time: 36, band: 60 }] });
    const host = cues.find(cue => cue.lyric === 0);
    expect(host.phase).toBe('voice');
  });

  it('creates a cue for a line placed far from every existing one', () => {
    const { cues } = generateSequence({ analysis: base, landmarks: [{ line: 4, time: 74.5, band: 60 }] });
    const host = cues.find(cue => cue.lyric === 4);
    expect(host).toBeTruthy();
    expect(Math.abs(host.time - 74.5)).toBeLessThanOrEqual(1);
    expect(host.anchored_to).toBe('creator-placed');
  });

  it('never gives one cue two lines', () => {
    const landmarks = [0, 1, 2, 3, 4, 5].map(line => ({ line, time: 30 + line * 12, band: 60 }));
    const { cues } = generateSequence({ analysis: base, landmarks });
    const hosts = cues.filter(cue => cue.lyric !== undefined);
    expect(new Set(hosts.map(cue => cue.lyric)).size).toBe(hosts.length);
    expect(hosts.length).toBe(6);
  });

  it('keeps placed lines in the order they were placed', () => {
    const landmarks = [0, 1, 2, 3].map(line => ({ line, time: 30 + line * 25, band: 60 }));
    const { cues } = generateSequence({ analysis: base, landmarks });
    const carried = cues.filter(cue => cue.lyric !== undefined).map(cue => cue.lyric);
    expect(carried).toEqual([0, 1, 2, 3]);
  });

  it('clamps a landmark placed past the end of the track', () => {
    const { cues, arcEnd } = generateSequence({ analysis: base, landmarks: [{ line: 0, time: 9999, band: 60 }] });
    const host = cues.find(cue => cue.lyric === 0);
    expect(host).toBeTruthy();
    expect(host.time).toBeLessThan(arcEnd);
  });

  it('ignores a landmark with no usable time instead of breaking the arc', () => {
    const { cues } = generateSequence({ analysis: base, landmarks: [{ line: 0, time: null, band: 60 }] });
    expect(cues.some(cue => cue.lyric !== undefined)).toBe(false);
    const t = times(cues);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
  });
});
