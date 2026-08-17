/* The authored sequence — a flight through the recording.
 *
 * The arc is authored per object and injected, not compiled into the engine.
 *
 * The reference edition ships a hand-authored 104-second arc in which every
 * `time` is a measured musical event from its analysis payload — a vocal-phrase
 * onset, a section boundary, a breath, the loudest frame of the slice. Studio
 * generates an arc from the creator's own analysis instead. Both express
 * interpretation, not signal routing: "the voice raises a ridge and the line is
 * cut into it" is a cue; "band 3 scales mesh 7" is not, and does not appear
 * anywhere in this runtime.
 *
 * The shot vocabulary below is shared by every arc, which is what stops the two
 * producers from drifting into two different camera languages.
 */
const SEQUENCE = (() => {
  const node = document.querySelector('#sequence-payload');
  const parsed = node ? JSON.parse(node.textContent) : null;
  if (!Array.isArray(parsed) || !parsed.length) {
    throw new Error('Transcendence runtime: no authored sequence was injected.');
  }
  return parsed.slice().sort((a, b) => a.time - b.time);
})();

/* Camera shots.
 *
 * Every shot is expressed *relative to the playhead*, never in absolute world
 * coordinates: the camera's Z is always derived from where the recording has
 * reached, so the flight cannot drift out of sync with the music.
 *
 *   band     lateral position on the frequency axis, −1 lowest … +1 highest
 *   alt      altitude above the ground beneath the camera
 *   lead     units behind (+) the playhead
 *   look     how far forward the camera looks
 *   lookBand lateral aim
 *   lookAlt  aim height relative to the ground there
 *
 * Reduced motion holds `still` instead of travelling the rail; each still is
 * composed to work as a photograph.
 */
const SHOTS = {
  atlas: {
    from: { band: -0.05, alt: 210, lead: 120, look: 620, lookBand: 0.0, lookAlt: -60, fov: 52, roll: 0 },
    to:   { band: -0.02, alt: 176, lead: 90, look: 560, lookBand: 0.02, lookAlt: -50, fov: 50, roll: -0.3 },
    ease: 'inOutSine', still: 0.4,
  },
  descent: {
    from: { band: -0.02, alt: 176, lead: 90, look: 560, lookBand: 0.02, lookAlt: -50, fov: 50, roll: -0.3 },
    to:   { band: -0.18, alt: 46, lead: 26, look: 300, lookBand: -0.12, lookAlt: 6, fov: 47, roll: 0.4 },
    ease: 'inOutQuint', still: 0.62,
  },
  ranges: {
    from: { band: -0.18, alt: 34, lead: 22, look: 300, lookBand: -0.14, lookAlt: 8, fov: 47, roll: 0.4 },
    to:   { band: -0.10, alt: 26, lead: 18, look: 320, lookBand: -0.06, lookAlt: 10, fov: 45, roll: -0.35 },
    ease: 'inOutSine', still: 0.5,
  },
  expanse: {
    from: { band: -0.10, alt: 26, lead: 18, look: 320, lookBand: -0.06, lookAlt: 10, fov: 45, roll: -0.35 },
    to:   { band: 0.10, alt: 62, lead: 30, look: 420, lookBand: 0.22, lookAlt: -6, fov: 52, roll: 0.5 },
    ease: 'outCubic', still: 0.55,
  },
  vocalRidge: {
    // The one framing from which the first cut line reads as text: slightly
    // above and behind the singer's own ridge, looking along it.
    from: { band: 0.02, alt: 44, lead: 26, look: 340, lookBand: -0.10, lookAlt: 0, fov: 48, roll: 0.3 },
    to:   { band: -0.20, alt: 20, lead: 16, look: 250, lookBand: -0.15, lookAlt: 6, fov: 42, roll: 0 },
    ease: 'inOutCubic', still: 0.72,
  },
  erasure: {
    from: { band: -0.20, alt: 20, lead: 16, look: 250, lookBand: -0.15, lookAlt: 6, fov: 42, roll: 0 },
    to:   { band: -0.30, alt: 52, lead: 30, look: 400, lookBand: -0.05, lookAlt: -4, fov: 50, roll: -0.4 },
    ease: 'inOutSine', still: 0.5,
  },
  traverse: {
    from: { band: -0.42, alt: 40, lead: 26, look: 300, lookBand: -0.20, lookAlt: 4, fov: 45, roll: 0.6 },
    to:   { band: 0.06, alt: 25, lead: 18, look: 270, lookBand: -0.13, lookAlt: 6, fov: 43, roll: -0.6 },
    ease: 'inOutSine', still: 0.45,
  },
  summit: {
    from: { band: 0.06, alt: 25, lead: 18, look: 270, lookBand: -0.13, lookAlt: 6, fov: 43, roll: -0.6 },
    to:   { band: -0.06, alt: 42, lead: 24, look: 380, lookBand: -0.10, lookAlt: 0, fov: 48, roll: 0.25 },
    ease: 'inOutCubic', still: 0.6,
  },
  sustain: {
    from: { band: -0.06, alt: 42, lead: 24, look: 380, lookBand: -0.10, lookAlt: 0, fov: 48, roll: 0.25 },
    to:   { band: -0.24, alt: 30, lead: 20, look: 340, lookBand: -0.16, lookAlt: 5, fov: 46, roll: -0.3 },
    ease: 'inOutSine', still: 0.5,
  },
  approach: {
    from: { band: -0.24, alt: 30, lead: 20, look: 340, lookBand: -0.16, lookAlt: 5, fov: 46, roll: -0.3 },
    to:   { band: -0.14, alt: 9.5, lead: 12, look: 190, lookBand: -0.14, lookAlt: 7, fov: 40, roll: 0 },
    ease: 'inOutQuint', still: 0.68,
  },
  trough: {
    // Ground level, between two harmonic walls, reading the line off the flank.
    from: { band: -0.145, alt: 8.0, lead: 11, look: 170, lookBand: -0.145, lookAlt: 6, fov: 38, roll: 0 },
    to:   { band: -0.150, alt: 7.2, lead: 9, look: 160, lookBand: -0.150, lookAlt: 5.5, fov: 37, roll: 0.15 },
    ease: 'inOutSine', still: 0.5,
  },
  rise: {
    from: { band: -0.150, alt: 7.2, lead: 9, look: 160, lookBand: -0.150, lookAlt: 5.5, fov: 37, roll: 0.15 },
    to:   { band: -0.10, alt: 78, lead: 36, look: 460, lookBand: -0.04, lookAlt: -14, fov: 52, roll: -0.4 },
    ease: 'inOutQuint', still: 0.7,
  },
  highTraverse: {
    from: { band: -0.10, alt: 78, lead: 36, look: 460, lookBand: -0.04, lookAlt: -14, fov: 52, roll: -0.4 },
    to:   { band: -0.16, alt: 40, lead: 22, look: 300, lookBand: -0.15, lookAlt: -2, fov: 44, roll: 0.3 },
    ease: 'inOutCubic', still: 0.6,
  },
  ascend: {
    from: { band: -0.16, alt: 40, lead: 22, look: 300, lookBand: -0.15, lookAlt: -2, fov: 44, roll: 0.3 },
    to:   { band: -0.05, alt: 150, lead: 60, look: 620, lookBand: 0.0, lookAlt: -48, fov: 54, roll: -0.5 },
    ease: 'inOutQuint', still: 0.62,
  },
  apex: {
    from: { band: -0.05, alt: 150, lead: 60, look: 620, lookBand: 0.0, lookAlt: -48, fov: 54, roll: -0.5 },
    to:   { band: 0.0, alt: 230, lead: 130, look: 780, lookBand: 0.0, lookAlt: -110, fov: 56, roll: 0 },
    ease: 'outCubic', still: 0.55, impact: 0.3,
  },
  atlasReturn: {
    from: { band: 0.0, alt: 230, lead: 130, look: 780, lookBand: 0.0, lookAlt: -110, fov: 56, roll: 0 },
    to:   { band: 0.0, alt: 300, lead: 260, look: 900, lookBand: 0.0, lookAlt: -190, fov: 54, roll: 0.2 },
    ease: 'inOutSine', still: 0.5,
  },
  condense: {
    from: { band: 0.0, alt: 300, lead: 260, look: 900, lookBand: 0.0, lookAlt: -190, fov: 54, roll: 0.2 },
    to:   { band: 0.0, alt: 340, lead: 320, look: 900, lookBand: 0.0, lookAlt: -240, fov: 46, roll: 0 },
    ease: 'inOutCubic', still: 0.5,
  },
  specimen: {
    // The residue is held in the near field; the world behind it has gone.
    from: { band: 0.0, alt: 340, lead: 320, look: 900, lookBand: 0.0, lookAlt: -240, fov: 30, roll: 0 },
    to:   { band: 0.0, alt: 340, lead: 320, look: 900, lookBand: 0.0, lookAlt: -240, fov: 28, roll: -0.15 },
    ease: 'inOutSine', still: 0.5, specimen: true,
  },
  closePass: {
    from: { band: -0.12, alt: 5.8, lead: 8, look: 110, lookBand: -0.18, lookAlt: 3.5, fov: 56, roll: 0.7 },
    to:   { band: -0.22, alt: 4.2, lead: 5, look: 85, lookBand: -0.24, lookAlt: 2.0, fov: 62, roll: -0.5 },
    ease: 'inOutCubic', still: 0.55,
  },
  monumentalWide: {
    from: { band: 0.0, alt: 280, lead: 180, look: 800, lookBand: -0.08, lookAlt: -80, fov: 42, roll: 0.3 },
    to:   { band: -0.04, alt: 320, lead: 220, look: 900, lookBand: 0.0, lookAlt: -120, fov: 38, roll: 0 },
    ease: 'inOutSine', still: 0.45,
  },
  corridor: {
    from: { band: -0.15, alt: 6.5, lead: 10, look: 140, lookBand: -0.15, lookAlt: 4, fov: 48, roll: 0.2 },
    to:   { band: -0.15, alt: 5.0, lead: 7, look: 100, lookBand: -0.16, lookAlt: 3, fov: 52, roll: -0.3 },
    ease: 'inOutSine', still: 0.5,
  },
};

/* CueEngine — reduces the authored sequence to a world state for any time.
 *
 * The reduction reads the sequence from the beginning every time rather than
 * remembering what it did last frame. That is deliberate: seeking backwards,
 * seeking forwards and playing straight through all produce identical state,
 * which is what makes the determinism test meaningful.
 */
class CueEngine {
  constructor(sequence, analysis) {
    this.sequence = sequence;
    this.analysis = analysis;
    this.lastIndex = -1;
  }

  indexAt(seconds) {
    let index = 0;
    for (let i = 0; i < this.sequence.length; i++) {
      if (this.sequence[i].time <= seconds + 1e-6) index = i; else break;
    }
    return index;
  }

  /** Pure reduction: state at `seconds` depends on nothing but `seconds`. */
  reduce(seconds) {
    const index = this.indexAt(seconds);
    const cue = this.sequence[index];
    const next = this.sequence[index + 1] || null;
    const span = next ? next.time - cue.time : 4;
    const progress = clamp01((seconds - cue.time) / Math.max(0.001, span));

    const blend = {};
    for (const key of ['air', 'relief', 'atmosphere', 'ahead']) {
      const a = cue.world[key] ?? 0;
      const b = next ? (next.world[key] ?? a) : a;
      blend[key] = mix(a, b, ease.inOutSine(progress));
    }

    return {
      index, cue, next, progress, seconds,
      phase: cue.phase,
      shot: cue.shot,
      world: blend,
      attentionEnabled: this.sequence.slice(0, index + 1).some(c => c.attention),
      engraveWindow: this.engraveWindowAt(seconds),
      landmarks: this.landmarksAt(seconds),
      terminal: !!cue.terminal,
    };
  }

  /** Which lyric line, if any, is currently being cut, and how far in. */
  engraveWindowAt(seconds) {
    for (let i = this.sequence.length - 1; i >= 0; i--) {
      const cue = this.sequence[i];
      if (cue.lyric === undefined || cue.time > seconds) continue;
      const line = this.analysis.lyrics[cue.lyric];
      const end = line.phrase_end_seconds ?? line.aligned_seconds + 8;
      if (seconds > end + 0.5) return null;
      return { lyric: cue.lyric, line, start: cue.time, end, progress: clamp01((seconds - cue.time) / Math.max(0.001, end - cue.time)) };
    }
    return null;
  }

  /**
   * Per-line cut depth. A line is written as it is sung and then stays: rock
   * does not forget.
   */
  landmarksAt(seconds) {
    const out = [0, 0, 0, 0];
    for (const cue of this.sequence) {
      if (cue.lyric === undefined) continue;
      const line = this.analysis.lyrics[cue.lyric];
      const end = line.phrase_end_seconds ?? line.aligned_seconds + 7;
      out[cue.lyric] = clamp01((seconds - cue.time) / Math.max(0.6, (end - cue.time) * 0.75));
    }
    return out;
  }

  crossed(index) {
    if (index === this.lastIndex) return false;
    this.lastIndex = index;
    return true;
  }
}
