// Generates the authored arc for a Studio-made Transcendence object.
//
// This module exists because the reference edition's arc is not portable. Its 21
// cues are hand-written about one 1902 disc — "a man in a room in 1902 speaks the
// title into the horn" — with times measured from that recording. A creator's
// track has different sections, a different length and a different singer.
//
// What *is* portable is the shape: a descent from the whole record laid out below,
// a flight through its harmonic country, lines cut where the voice raises ridges,
// a climb to the loudest moment, and a condensation back to the object. And the
// camera vocabulary is portable, because consecutive shots in that order chain —
// each shot's `from` framing is the previous shot's `to`, so the flight is
// continuous rather than a series of cuts.
//
// So the itinerary is authored once, here, and the *timing* is measured from the
// creator's own track: every step snaps to the nearest real musical event — a
// section boundary or a vocal-phrase onset — when one is close enough, and falls
// back to its proportional position when none is.
//
// This is an honest halfway house, and the limit should be stated plainly: the
// shape of the flight is authored by Noizes, not measured from the record. Only
// the moments are measured. The reference edition can claim its whole arc was
// measured; an object built here cannot.

/**
 * The canonical itinerary, with each step's proportional position in the arc and
 * the world settings the reference uses for that beat. `snap` is how far, as a
 * fraction of the arc, a step may move to land on a measured event.
 */
export const ITINERARY = [
  { id: 'atlas', phase: 'atlas', shot: 'atlas', at: 0.000, snap: 0, world: { air: 0.30, relief: 1, atmosphere: 1.25, ahead: 0.72 } },
  { id: 'survey', phase: 'atlas', shot: 'atlas', at: 0.006, snap: 0.01, world: { air: 0.35, relief: 1, atmosphere: 1.2, ahead: 0.70 } },
  { id: 'descent', phase: 'descent', shot: 'descent', at: 0.044, snap: 0.03, world: { air: 0.55, relief: 1, atmosphere: 1.05, ahead: 0.62 } },
  { id: 'ranges', phase: 'flight', shot: 'ranges', at: 0.077, snap: 0.04, attention: true, world: { air: 0.75, relief: 1, atmosphere: 0.95, ahead: 0.55 } },
  { id: 'expanse', phase: 'flight', shot: 'expanse', at: 0.146, snap: 0.05, world: { air: 0.85, relief: 1.04, atmosphere: 0.9, ahead: 0.5 } },
  { id: 'voice', phase: 'voice', shot: 'vocalRidge', at: 0.179, snap: 0.07, voice: true, world: { air: 0.9, relief: 1.06, atmosphere: 0.85, ahead: 0.45 } },
  { id: 'breath', phase: 'flight', shot: 'erasure', at: 0.284, snap: 0.05, world: { air: 0.8, relief: 1, atmosphere: 1.05, ahead: 0.5 } },
  { id: 'second', phase: 'voice', shot: 'traverse', at: 0.300, snap: 0.06, voice: true, world: { air: 0.9, relief: 1.08, atmosphere: 0.85, ahead: 0.42 } },
  { id: 'summit', phase: 'summit', shot: 'summit', at: 0.356, snap: 0.05, world: { air: 1, relief: 1.16, atmosphere: 0.78, ahead: 0.38 } },
  { id: 'sustain', phase: 'flight', shot: 'sustain', at: 0.412, snap: 0.05, world: { air: 0.95, relief: 1.06, atmosphere: 0.88, ahead: 0.42 } },
  { id: 'open', phase: 'flight', shot: 'sustain', at: 0.462, snap: 0.05, world: { air: 0.68, relief: 0.94, atmosphere: 1.2, ahead: 0.5 } },
  { id: 'approach', phase: 'flight', shot: 'valleyEnter', at: 0.558, snap: 0.05, world: { air: 0.9, relief: 1.04, atmosphere: 0.9, ahead: 0.4 } },
  { id: 'trough', phase: 'voice', shot: 'trough', at: 0.622, snap: 0.06, voice: true, world: { air: 0.95, relief: 1.06, atmosphere: 0.85, ahead: 0.35 } },
  { id: 'closePass', phase: 'flight', shot: 'closePass', at: 0.680, snap: 0.04, world: { air: 0.95, relief: 1.08, atmosphere: 0.82, ahead: 0.32 } },
  { id: 'rise', phase: 'flight', shot: 'rise', at: 0.726, snap: 0.05, world: { air: 0.85, relief: 1, atmosphere: 0.95, ahead: 0.42 } },
  { id: 'high', phase: 'voice', shot: 'crest', at: 0.760, snap: 0.06, voice: true, world: { air: 0.90, relief: 1.1, atmosphere: 0.88, ahead: 0.38 } },
  { id: 'reveal', phase: 'flight', shot: 'reveal', at: 0.800, snap: 0.04, world: { air: 0.85, relief: 1.06, atmosphere: 0.92, ahead: 0.42 } },
  { id: 'ascend', phase: 'convergence', shot: 'ascend', at: 0.846, snap: 0.04, world: { air: 1, relief: 1.2, atmosphere: 0.72, ahead: 0.28 } },
  { id: 'apex', phase: 'apex', shot: 'apex', at: 0.880, snap: 0.05, apex: true, world: { air: 0.95, relief: 1.24, atmosphere: 0.68, ahead: 0.2 } },
  { id: 'return', phase: 'atlas', shot: 'atlasReturn', at: 0.909, snap: 0.02, world: { air: 0.7, relief: 1.1, atmosphere: 0.95, ahead: 0.32 } },
  { id: 'condense', phase: 'condense', shot: 'condense', at: 0.952, snap: 0.02, world: { air: 0.4, relief: 0.9, atmosphere: 1.15, ahead: 0.4 } },
  { id: 'residue', phase: 'residue', shot: 'specimen', at: 0.971, snap: 0, world: { air: 0.28, relief: 0.9, atmosphere: 1, ahead: 0.4 } },
  { id: 'complete', phase: 'complete', shot: 'specimen', at: 1.000, snap: 0, terminal: true, world: { air: 0.25, relief: 0.9, atmosphere: 1, ahead: 0.4 } },
];

/** The minimum gap between consecutive cues, in seconds. */
const MIN_GAP = 0.35;
// Cue times are rounded to milliseconds, so a gap of exactly MIN_GAP can measure
// 0.34999999999999432. Compare with a tolerance below the rounding, or cues get
// dropped for being a nanosecond too close.
const GAP_EPSILON = 1e-6;
// How far a cue may be nudged off its measured anchor before it stops being
// entitled to claim one. Beyond this the package says "proportional", because a
// package that overstates what was measured is worse than one that measures less.
const ANCHOR_TOLERANCE = 0.05;

const SCENES = {
  atlas: 'The whole recording lies below as a single continent of sound. Time runs away toward the horizon; frequency runs left to right, the low register a dark massif on the left, the high register a pale frost at the right-hand edge. Nothing here was modelled — this is the shape of the record itself.',
  survey: 'The opening of the record raises the first ridges in the landscape below. Whatever the first sound on this recording is, it is already geography.',
  descent: 'The view falls toward the country the recording makes. Sustained tones become long unbroken ranges running away into the distance.',
  ranges: 'Flying in the trough between two harmonic ranges. Each range is one partial of the sound above it; they run parallel into the distance and rise and fall together as the performance moves them.',
  expanse: 'The recording reaches into its brightest register. High-frequency country rises at the right of the world — thin, crystalline and unstable — and the horizon pulls away.',
  voice: 'A sustained melodic source enters. A new range lifts out of the plain at its own strongest partial, and a line of the song is cut into its flank.',
  breath: 'The sustained source falls away and the country opens out. What was written stays cut into the rock behind.',
  second: 'The melodic source returns and the range resumes. The view banks across the frequency axis, crossing from the low massif toward the singer’s own country.',
  summit: 'The loudest sustained passage so far. The ranges reach their full height and the light rakes along their length.',
  sustain: 'Held ground. The landscape neither builds nor falls away; the flight simply travels it.',
  open: 'The recording thins and the country opens. Fewer partials, lower relief, more air between the ranges.',
  approach: 'The flight descends into a valley between mountains, individual ridgelines resolving as the terrain rises around the viewer.',
  trough: 'Deep between mountains, peaks towering on both sides, reading a line off the flank of the ridge that carries it.',
  closePass: 'The flight banks close to a mountain flank. The terrain fills the viewport, passing within arm\'s reach.',
  rise: 'The view climbs away from the valley floor and the whole shape of the ranges becomes visible again.',
  high: 'The camera crests a ridge. The landscape beyond is revealed — a new vista opening across the ranges.',
  reveal: 'The ridge falls away and the country beyond opens out. What was hidden by the mountain is now landscape.',
  ascend: 'The climb toward the loudest moment in the recording. Relief steepens beneath the flight.',
  apex: 'The measured peak of the recording. Every range is at its full height at once.',
  return: 'The world recedes back to the atlas view it opened in, now travelled.',
  condense: 'The landscape condenses back toward the object it came from.',
  residue: 'What is left: the pressed artefact, and the lines that were cut into it.',
  complete: 'The recording has stopped. The terrain remains exactly as the record shaped it.',
};

const TITLES = {
  atlas: 'The track, entire', survey: 'The opening', descent: 'Descent',
  ranges: 'Between the ranges', expanse: 'Expanse', voice: 'A voice raises a ridge',
  breath: 'Breath', second: 'The line resumes', summit: 'Summit', sustain: 'Held ground',
  open: 'The country opens', approach: 'Into the valley', trough: 'In the trough',
  closePass: 'Close pass', rise: 'Rise', high: 'The crest',
  reveal: 'The reveal', ascend: 'The climb', apex: 'Apex',
  return: 'The atlas, travelled', condense: 'Condensation', residue: 'The residue',
  complete: 'Complete',
};

/**
 * Measured moments a cue may snap to, most musically meaningful first.
 * @returns {{ voice: number[], structural: number[] }}
 */
export function measuredAnchors(analysis) {
  const voice = (analysis.vocal_phrases || []).map(phrase => phrase.start);
  const structural = [
    ...(analysis.sections || []),
    ...(analysis.phrases || []).map(phrase => phrase.start),
  ].sort((a, b) => a - b);
  return { voice, structural };
}

/** The loudest sustained moment, used as the apex. */
export function apexTime(analysis, fallback) {
  const candidates = [
    ...(analysis.vocal_phrases || []).map(p => ({ t: p.start, weight: p.peak })),
    ...(analysis.phrases || []).map(p => ({ t: p.start, weight: p.peak_voice })),
  ].filter(candidate => Number.isFinite(candidate.t) && Number.isFinite(candidate.weight));
  if (!candidates.length) return fallback;
  return candidates.reduce((best, candidate) => (candidate.weight > best.weight ? candidate : best)).t;
}

const nearest = (values, target, tolerance) => {
  let best = null, bestDistance = Infinity;
  for (const value of values) {
    const distance = Math.abs(value - target);
    if (distance < bestDistance && distance <= tolerance) { bestDistance = distance; best = value; }
  }
  return best;
};

/**
 * Build the arc.
 *
 * @param {object}   analysis        the payload from `analyseTrack`
 * @param {Array}    landmarks       creator placements: [{ line, time, band }]
 * @param {number}   [arcEndSeconds] defaults to the whole track
 * @returns {{ cues: Array, snapped: number, arcEnd: number }}
 */
export function generateSequence({ analysis, landmarks = [], arcEndSeconds = null }) {
  const duration = Number(analysis?.duration_seconds) || 0;
  if (!(duration > 0)) throw new Error('Cannot build an arc for a track with no measured duration.');
  const arcEnd = Math.min(duration, Number(arcEndSeconds) > 0 ? Number(arcEndSeconds) : duration);

  const anchors = measuredAnchors(analysis);
  const apex = apexTime(analysis, arcEnd * 0.88);
  // The apex owns its moment. Without this, the `ascend` beat immediately before it
  // can snap onto the measured peak, and then the apex itself gets pushed off the
  // one event in the whole track it exists to land on.
  const reserved = (values) => values.filter((value) => value !== apex);
  const voice = reserved(anchors.voice);
  const structural = reserved(anchors.structural);

  const cues = [];
  let snapped = 0;
  let previous = -Infinity;

  // The terminal cue is placed last, at the arc end, and never competes for room.
  // On a short track the 21-step itinerary cannot all fit at MIN_GAP spacing, so
  // steps that would run past the end are dropped rather than piled onto the final
  // instant — two cues at the same time would break a cue engine that reduces the
  // whole sequence from the beginning on every frame.
  const terminalStep = ITINERARY.find((step) => step.terminal);
  const lastRoom = arcEnd - MIN_GAP;

  for (const step of ITINERARY) {
    if (step.terminal) continue;
    const target = step.at * arcEnd;
    const tolerance = step.snap * arcEnd;

    // A voice beat wants a real vocal onset; a structural beat will take a section
    // boundary or a phrase start. The apex is measured outright.
    let time = target;
    let anchoredTo = 'proportional';
    if (step.apex && Number.isFinite(apex)) {
      time = apex;
      anchoredTo = 'measured-peak';
    } else if (tolerance > 0) {
      // A voice beat prefers a real vocal onset and a structural beat prefers a
      // boundary, but either will take the other rather than sit on a proportion.
      // The label always names the pool the hit actually came from — a cue that
      // snapped to a phrase boundary must not claim it found the singer.
      const first = step.voice
        ? { times: voice, label: 'measured-vocal-onset' }
        : { times: structural, label: 'measured-boundary' };
      const second = step.voice
        ? { times: structural, label: 'measured-boundary' }
        : { times: voice, label: 'measured-vocal-onset' };
      for (const pool of [first, second]) {
        const hit = nearest(pool.times, target, tolerance);
        if (hit != null) { time = hit; anchoredTo = pool.label; break; }
      }
    }

    // Monotonic and separated, whatever the snapping did. The itinerary order is
    // never rearranged to reach an anchor — the shots have to chain.
    const wanted = time;
    time = step.at === 0 ? 0 : Math.max(previous + MIN_GAP, time);
    if (time > lastRoom) continue;   // no room left before the arc ends
    // Moved off the anchor to keep the order? Then it is no longer anchored to it.
    if (Math.abs(time - wanted) > ANCHOR_TOLERANCE) anchoredTo = 'proportional';
    previous = time;

    cues.push({
      time: Number(time.toFixed(3)),
      id: step.id,
      phase: step.phase,
      shot: step.shot,
      title: TITLES[step.id],
      scene: SCENES[step.id],
      world: { ...step.world },
      anchored_to: anchoredTo,
      ...(step.apex ? { priority: 2 } : {}),
      ...(step.attention ? { attention: true } : {}),
    });
  }

  attachLandmarks(cues, landmarks, lastRoom);

  cues.push({
    time: Number(arcEnd.toFixed(3)),
    id: terminalStep.id,
    phase: terminalStep.phase,
    shot: terminalStep.shot,
    title: TITLES[terminalStep.id],
    scene: SCENES[terminalStep.id],
    world: { ...terminalStep.world },
    anchored_to: 'arc-end',
    terminal: true,
  });

  const ordered = enforceStrictOrder(cues, arcEnd);
  // Counted from what actually shipped, not from what was attempted: the timeline
  // publishes this number as a claim about the object.
  snapped = ordered.filter((cue) => cue.anchored_to.startsWith('measured')).length;
  for (const cue of ordered) delete cue.priority;
  return { cues: ordered, snapped, arcEnd };
}

/**
 * Hang each creator-placed lyric landmark on a cue.
 *
 * Preference order is deliberate: a `voice`-phase cue first, because that is the
 * framing from which a cut line reads as text; then any nearby cue; then a new
 * cue of its own. A landmark must never be silently dropped — the creator put it
 * there on purpose.
 */
function attachLandmarks(cues, landmarks, arcEnd) {
  const ordered = landmarks
    .filter(landmark => Number.isFinite(landmark?.time))
    .map(landmark => ({ ...landmark, time: Math.max(0, Math.min(arcEnd, landmark.time)) }))
    .sort((a, b) => a.time - b.time);

  for (const landmark of ordered) {
    const taken = cue => cue.lyric !== undefined;
    const within = (cue, window) => Math.abs(cue.time - landmark.time) <= window && !cue.terminal;

    let host = cues.find(cue => cue.phase === 'voice' && !taken(cue) && within(cue, 6))
      ?? cues.find(cue => !taken(cue) && within(cue, 3));

    if (!host) {
      host = {
        time: Number(landmark.time.toFixed(3)),
        id: `line-${landmark.line}`,
        phase: 'voice',
        shot: 'vocalRidge',
        title: 'A line is cut',
        scene: SCENES.voice,
        world: { air: 0.9, relief: 1.06, atmosphere: 0.85, ahead: 0.45 },
        anchored_to: 'creator-placed',
      };
      cues.push(host);
    }
    host.lyric = landmark.line;
    host.engrave = true;
  }

  cues.sort((a, b) => a.time - b.time);
}

/**
 * Guarantee strictly increasing cue times, terminal last.
 *
 * `attachLandmarks` can insert a cue anywhere, so ordering is settled here rather
 * than trusted from the construction above. A cue that cannot be separated from
 * its neighbour without passing the terminal is dropped — but never one carrying a
 * lyric, because the creator placed that deliberately; that one displaces the
 * plain cue beside it instead.
 */
function enforceStrictOrder(cues, arcEnd) {
  const terminal = cues.find((cue) => cue.terminal);
  // A cue carrying a lyric outranks the apex, which outranks a plain flight beat:
  // the creator's placement is the one thing here nobody else chose.
  const rank = (cue) => (cue.lyric !== undefined ? 3 : cue.priority ?? 1);
  const body = cues.filter((cue) => !cue.terminal).sort((a, b) => a.time - b.time);

  const kept = [];
  for (const cue of body) {
    const previous = kept[kept.length - 1];
    if (!previous) { kept.push(cue); continue; }
    if (cue.time - previous.time >= MIN_GAP - GAP_EPSILON) { kept.push(cue); continue; }
    if (rank(cue) > rank(previous)) kept[kept.length - 1] = cue;
  }

  const withinArc = kept.filter((cue) => cue.time <= arcEnd - MIN_GAP + GAP_EPSILON);
  return terminal ? [...withinArc, terminal] : withinArc;
}
