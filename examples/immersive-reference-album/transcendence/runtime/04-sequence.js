/* The authored sequence — a flight through the recording.
 *
 * Every `time` below is a *measured* musical event from
 * analysis/track-01.analysis.json: a vocal-phrase onset, a section boundary, a
 * breath, or the loudest frame of the slice. None of them were placed by ear.
 *
 * Cues express interpretation, not signal routing. "The voice raises a ridge
 * and the line is cut into it" is a cue; "band 3 scales mesh 7" is not, and
 * does not appear anywhere in this runtime.
 */

const SEQUENCE = [
  {
    time: 0.0, id: 'atlas', phase: 'atlas', shot: 'atlas',
    title: 'The track, entire',
    scene: 'The whole recording lies below as a single continent of sound. Time runs away toward the horizon; frequency runs left to right, the low register a dark massif on the left, the high register a pale frost at the right-hand edge. Nothing here was modelled — this is the shape of the record itself.',
    world: { air: 0.30, relief: 1, atmosphere: 1.25, ahead: 0.72 },
  },
  {
    time: 0.4, id: 'announcer', phase: 'atlas', shot: 'atlas',
    title: 'The announcer',
    scene: 'The first sound on this record is not the song. A man in a room in 1902 speaks the title into the horn, and his three short syllables raise the first three ridges in the landscape below.',
    world: { air: 0.35, relief: 1, atmosphere: 1.2, ahead: 0.70 },
  },
  {
    time: 4.6, id: 'descent', phase: 'descent', shot: 'descent',
    title: 'Descent',
    scene: 'The violin plays its first sustained tone, alone. The tone becomes a long unbroken range running away into the distance, and the view falls toward it.',
    world: { air: 0.55, relief: 1, atmosphere: 1.05, ahead: 0.62 },
  },
  {
    time: 8.0, id: 'ranges', phase: 'flight', shot: 'ranges',
    title: 'Between the ranges',
    scene: 'Flying in the trough between two harmonic ranges. Each range is one partial of the violin’s tone; they run parallel into the distance and rise and fall together as the player’s vibrato moves them.',
    world: { air: 0.75, relief: 1, atmosphere: 0.95, ahead: 0.55 },
    attention: true,
  },
  {
    time: 15.2, id: 'expanse', phase: 'flight', shot: 'expanse',
    title: 'Expanse',
    scene: 'The violin reaches its brightest register. High-frequency country rises at the right of the world — thin, crystalline and unstable — and the horizon pulls away.',
    world: { air: 0.85, relief: 1.04, atmosphere: 0.9, ahead: 0.5 },
  },
  {
    time: 18.65, id: 'voice', phase: 'voice', shot: 'vocalRidge',
    title: 'The voice raises a ridge',
    scene: 'Measured onset of the tenor’s first entry. A new range lifts out of the plain at six hundred hertz — the singer’s own strongest partial — and the first line of the song is cut into its flank as the words are sung.',
    world: { air: 0.9, relief: 1.06, atmosphere: 0.85, ahead: 0.45 },
    lyric: 0, engrave: true,
  },
  {
    time: 29.5, id: 'erasure', phase: 'flight', shot: 'erasure',
    title: 'Breath',
    scene: 'The singer breathes. The ridge he was raising falls away to nothing and the country opens out. What was written stays cut into the rock behind.',
    world: { air: 0.8, relief: 1, atmosphere: 1.05, ahead: 0.5 },
  },
  {
    time: 31.25, id: 'second', phase: 'voice', shot: 'traverse',
    title: 'Second line',
    scene: 'The voice returns and the range resumes. The view banks across the frequency axis, crossing from the low massif toward the singer’s own country, and the second line is cut as it passes.',
    world: { air: 0.9, relief: 1.08, atmosphere: 0.85, ahead: 0.42 },
    lyric: 1, engrave: true,
  },
  {
    time: 37.0, id: 'summit', phase: 'summit', shot: 'summit',
    title: 'Summit',
    scene: 'The loudest frame of the passage. Every range in the world reaches its greatest elevation at once, the light hardens, and the shadows of the ridges run the full length of the valley.',
    world: { air: 1, relief: 1.16, atmosphere: 0.78, ahead: 0.38 },
  },
  {
    time: 42.9, id: 'sustain', phase: 'flight', shot: 'sustain',
    title: 'Sustain',
    scene: 'The long sustained passage. The country becomes steady and enormous, and the flight is allowed to be quiet for a while.',
    world: { air: 0.95, relief: 1.06, atmosphere: 0.88, ahead: 0.42 },
  },
  {
    time: 48.0, id: 'breath', phase: 'flight', shot: 'sustain',
    title: 'Thin air',
    scene: 'A breath in the recording. The haze thins, the ground falls quiet, and for a moment the horizon is very far away.',
    world: { air: 0.68, relief: 0.94, atmosphere: 1.2, ahead: 0.5 },
  },
  {
    time: 58.0, id: 'approach', phase: 'flight', shot: 'approach',
    title: 'Into the trough',
    scene: 'The view drops until the harmonic walls stand above it on both sides. At this altitude the individual partials of the voice are cliffs.',
    world: { air: 0.9, relief: 1.04, atmosphere: 0.9, ahead: 0.4 },
  },
  {
    time: 64.71, id: 'third', phase: 'voice', shot: 'trough',
    title: 'Third line — ground level',
    scene: 'The third line is cut at ground level, read along the wall of the singer’s own ridge as the flight passes it. The rock is made of one sustained note.',
    world: { air: 0.95, relief: 1.06, atmosphere: 0.85, ahead: 0.35 },
    lyric: 2, engrave: true,
  },
  {
    time: 75.5, id: 'rise', phase: 'flight', shot: 'rise',
    title: 'Rise',
    scene: 'A breath. The view climbs out of the trough and the whole width of the recording is visible again — the low massif, the inhabited middle country, the frost at the edge.',
    world: { air: 0.85, relief: 1, atmosphere: 0.95, ahead: 0.42 },
  },
  {
    time: 79.04, id: 'fourth', phase: 'voice', shot: 'highTraverse',
    title: 'Fourth line',
    scene: 'The longest line of the verse, cut along the crest of the range and read from above.',
    world: { air: 0.95, relief: 1.1, atmosphere: 0.85, ahead: 0.35 },
    lyric: 3, engrave: true,
  },
  {
    time: 88.0, id: 'converge', phase: 'convergence', shot: 'ascend',
    title: 'Ascent',
    scene: 'The climb begins. Every system aims at one thing: the light hardens, the air clears, the ranges align, and the whole massif of the verse comes into view at once.',
    world: { air: 1, relief: 1.2, atmosphere: 0.72, ahead: 0.28 },
  },
  {
    time: 91.5, id: 'apex', phase: 'apex', shot: 'apex',
    title: 'Apex',
    scene: 'The largest low-frequency event in the passage. From here the entire sung verse is one continuous landform, four lines cut along its length, and the country that made it is legible end to end.',
    world: { air: 0.95, relief: 1.24, atmosphere: 0.68, ahead: 0.2 },
  },
  {
    time: 94.5, id: 'return', phase: 'atlas', shot: 'atlasReturn',
    title: 'The track, entire, again',
    scene: 'The measured end of the sung passage. The flight rises back to the altitude it began at, and the ground that has been travelled is lit while the rest of the record stays dark.',
    world: { air: 0.7, relief: 1.1, atmosphere: 0.95, ahead: 0.32 },
  },
  {
    time: 99.0, id: 'condense', phase: 'condense', shot: 'condense',
    title: 'Condensation',
    scene: 'The world contracts. The continent draws in on itself until the whole recording will fit in the hand.',
    world: { air: 0.4, relief: 0.9, atmosphere: 1.15, ahead: 0.4 },
  },
  {
    time: 101.0, id: 'specimen', phase: 'residue', shot: 'specimen',
    title: 'The specimen',
    scene: 'What is left is a relief object: the complete track as a landscape specimen, its surface the same data the world was made from. The part you listened to is lit; the rest of the record remains in shadow.',
    world: { air: 0.28, relief: 0.9, atmosphere: 1.0, ahead: 0.4 },
  },
  {
    time: 104.0, id: 'complete', phase: 'complete', shot: 'specimen',
    title: 'Final state',
    scene: 'The transport holds inside the record’s own near-silence. The specimen keeps turning. This is what is left of the recording having happened to you.',
    world: { air: 0.25, relief: 0.9, atmosphere: 1.0, ahead: 0.4 },
    terminal: true,
  },
];

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
