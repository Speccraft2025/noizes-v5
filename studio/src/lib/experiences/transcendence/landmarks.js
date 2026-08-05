// Lyric landmarks: where each line is cut into the terrain.
//
// The reference edition *measures* both coordinates — it fits each line to a
// detected vocal phrase and finds the band the singer's strongest partial
// occupies. Studio does not (decision D3). Here the creator places each line by
// hand, starting from the timing the Lyrics step already knows and a mid band.
//
// That difference is recorded in every entry (`alignment_method`) and in the
// document's own provenance note, because it changes what the object may claim.
// "Measured, not decorated" belongs to the reference build; an object authored
// here can only say the creator chose where the words sit.

/** Where an unplaced line starts out on the frequency axis. */
export const DEFAULT_BAND_FRACTION = 0.45;

/** Milliseconds, as the Lyrics step stores them, to seconds. */
const toSeconds = ms => (Number(ms) || 0) / 1000;

/**
 * The default placement for a set of lyric lines: the timing the Lyrics step
 * already has, at a mid band. A line with no timing falls to the centre of the
 * track rather than to zero, so it is somewhere a creator will actually see it.
 *
 * @param {Array<{ t: number, text: string }>} timedLines
 * @param {{ durationSeconds: number, bands: number }} track
 * @returns {Array<{ line: number, time: number, band: number }>}
 */
export function defaultLandmarks(timedLines, { durationSeconds, bands = 128 }) {
  const midBand = Math.round((bands - 1) * DEFAULT_BAND_FRACTION);
  return (timedLines || []).map((line, index) => {
    const declared = toSeconds(line.t);
    const inRange = declared > 0 && declared < durationSeconds;
    return {
      line: index,
      time: Number((inRange ? declared : durationSeconds / 2).toFixed(3)),
      band: midBand,
    };
  });
}

/**
 * Build the `lyrics` array the runtime reads.
 *
 * The runtime needs, per line: `text`, `aligned_seconds`, `phrase_end_seconds`,
 * `terrain_band` and `terrain_band_hz`. Everything else here exists so a reader
 * of the shipped package can audit where the words came from and how far the
 * creator moved them.
 *
 * @param {object} input
 * @param {Array}  input.timedLines   from the Lyrics step, `t` in milliseconds
 * @param {Array}  input.landmarks    creator placements: [{ line, time, band }]
 * @param {Array<number>} input.bandCentresHz  from the analysis payload
 * @param {number} input.durationSeconds
 */
export function buildLyricLines({ timedLines = [], landmarks = [], bandCentresHz = [], durationSeconds = 0 }) {
  const bands = bandCentresHz.length || 128;
  const placementByLine = new Map();
  for (const landmark of landmarks) {
    if (Number.isInteger(landmark?.line)) placementByLine.set(landmark.line, landmark);
  }
  const fallback = defaultLandmarks(timedLines, { durationSeconds, bands });

  return timedLines.map((line, index) => {
    const placement = placementByLine.get(index) ?? fallback[index];
    const declared = toSeconds(line.t);
    const aligned = clamp(Number(placement?.time) || 0, 0, durationSeconds);
    const band = clampInt(Number(placement?.band ?? fallback[index]?.band ?? 0), 0, bands - 1);

    // How long the line is held. There is no measured phrase to end it, so the
    // next line's placement ends it, capped so one line cannot own the whole
    // track and floored so a fast section still reads.
    const nextAligned = nextPlacement(timedLines, placementByLine, fallback, index, durationSeconds);
    const span = clamp(nextAligned - aligned, 1.5, 12);

    return {
      text: String(line.text ?? ''),
      declared_seconds: Number(declared.toFixed(3)),
      aligned_seconds: Number(aligned.toFixed(3)),
      drift_seconds: Number((aligned - declared).toFixed(3)),
      phrase_end_seconds: Number(Math.min(durationSeconds, aligned + span).toFixed(3)),
      terrain_band: band,
      terrain_band_hz: Number((bandCentresHz[band] ?? 0).toFixed(1)),
      alignment_method: 'creator-placed',
    };
  });
}

function nextPlacement(timedLines, placementByLine, fallback, index, durationSeconds) {
  for (let i = index + 1; i < timedLines.length; i++) {
    const candidate = placementByLine.get(i) ?? fallback[i];
    const time = Number(candidate?.time);
    if (Number.isFinite(time)) return time;
  }
  return durationSeconds;
}

/**
 * Problems a creator must fix before export, in the creator's own terms.
 * The export validator repeats these checks against the built package; this one
 * exists so the Experience step can say so before they get that far.
 */
export function landmarkProblems({ lyricLines = [], durationSeconds = 0 }) {
  const problems = [];
  for (const [index, line] of lyricLines.entries()) {
    if (line.aligned_seconds < 0 || line.aligned_seconds > durationSeconds) {
      problems.push(`Line ${index + 1} sits outside the track.`);
    }
  }
  // Source order is the one thing a creator must not be able to break: a lyric
  // read out of order is a different song.
  for (let i = 1; i < lyricLines.length; i++) {
    if (lyricLines[i].aligned_seconds < lyricLines[i - 1].aligned_seconds) {
      problems.push(`Line ${i + 1} is placed before line ${i}. Lines must stay in the order they are sung.`);
      break;
    }
  }
  return problems;
}

const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
const clampInt = (value, min, max) => Math.round(clamp(value, min, max));
