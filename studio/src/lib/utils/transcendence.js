// Assembles a Transcendence experience document.
//
// The mirror of `buildExperienceHTML()` for the other experience system. Two
// differences matter:
//
//   - Nothing is inlined as base64. The audio and the terrain are package
//     components referenced by relative path, so a Transcendence package is the
//     size of its media rather than 1.4x the size of its media.
//   - The document is assembled from four separate sources — the prebuilt
//     template (three + gsap), the stylesheet, the twelve runtime modules and the
//     payloads. Everything except the template is imported raw, so editing a
//     runtime module is picked up by the dev server without a build step.
//
// The raw imports are loaded on demand: they total about 850 KB, and a creator
// who never chooses Transcendence should never download them.

import { audioSourceTags, escapeHtml, escapeJsonPayload, fillMarkers, timecode } from '../experiences/transcendence/markers.js';
import { buildLyricLines } from '../experiences/transcendence/landmarks.js';
import { generateSequence } from '../experiences/transcendence/sequence.js';
import { buildWorldData } from '../experiences/transcendence/world-data.js';

export const TRANSCENDENCE_TEMPLATE = 'transcendence-v1';
export const TRANSCENDENCE_SCHEMA = '4.0.0';
export const QUALITY_PROFILES = ['cinematic', 'balanced', 'lite', 'essential'];
export const PALETTES = ['alabaster', 'oxide', 'frost', 'evergreen'];

/** The art direction a creator can set, and its defaults. */
export const DEFAULT_ART_DIRECTION = {
  heightScale: 1,
  ridgeEmphasis: 1,
  timeScale: 1,
  terracing: true,
  terraceStep: 1.5,
  palette: 'alabaster',
  sunElevation: 31.5,
  sunAzimuth: -146.31,
  flightAltitude: 1,
  worldStability: 0.7,
  musicResponse: 0.3,
};

/** Clamp art direction to ranges the world actually looks good in. */
export function normalizeArtDirection(input = {}) {
  const number = (value, fallback, min, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };
  return {
    heightScale: number(input.heightScale, 1, 0.4, 2.2),
    ridgeEmphasis: number(input.ridgeEmphasis, 1, 0, 2.5),
    timeScale: number(input.timeScale, 1, 0.5, 2),
    terracing: input.terracing !== false,
    terraceStep: number(input.terraceStep, 1.5, 0.5, 6),
    palette: PALETTES.includes(input.palette) ? input.palette : 'alabaster',
    sunElevation: number(input.sunElevation, DEFAULT_ART_DIRECTION.sunElevation, 8, 88),
    sunAzimuth: number(input.sunAzimuth, DEFAULT_ART_DIRECTION.sunAzimuth, -180, 180),
    flightAltitude: number(input.flightAltitude, 1, 0.5, 2.5),
    worldStability: number(input.worldStability, 0.7, 0, 1),
    musicResponse: number(input.musicResponse, 0.3, 0, 1),
  };
}

let cachedSources = null;

/**
 * The four raw sources, loaded once per session.
 *
 * Vite turns each `?raw` import into a lazy chunk, so this is also the boundary
 * that keeps 850 KB out of the initial Studio bundle.
 */
export async function loadTranscendenceSources() {
  if (cachedSources) return cachedSources;
  const [template, styles, ...modules] = await Promise.all([
    import('../templates/TRANSCENDENCE.html?raw'),
    import('../experiences/transcendence/styles.css?raw'),
    import('../experiences/transcendence/runtime/01-prelude.js?raw'),
    import('../experiences/transcendence/runtime/02-analysis.js?raw'),
    import('../experiences/transcendence/runtime/03-clock.js?raw'),
    import('../experiences/transcendence/runtime/04-sequence.js?raw'),
    import('../experiences/transcendence/runtime/05-shaders.js?raw'),
    import('../experiences/transcendence/runtime/06-landmarks.js?raw'),
    import('../experiences/transcendence/runtime/07-world.js?raw'),
    import('../experiences/transcendence/runtime/08-camera.js?raw'),
    import('../experiences/transcendence/runtime/09-audio.js?raw'),
    import('../experiences/transcendence/runtime/10-essential.js?raw'),
    import('../experiences/transcendence/runtime/11-systems.js?raw'),
    import('../experiences/transcendence/runtime/12-app.js?raw'),
  ]);
  const names = [
    '01-prelude.js', '02-analysis.js', '03-clock.js', '04-sequence.js', '05-shaders.js',
    '06-landmarks.js', '07-world.js', '08-camera.js', '09-audio.js', '10-essential.js',
    '11-systems.js', '12-app.js',
  ];
  assertTemplatePrebuilt(template.default);
  cachedSources = {
    template: template.default,
    styles: styles.default,
    runtime: modules
      .map((module, index) => `\n/* ==== ${names[index]} ==== */\n${module.default}`)
      .join('\n'),
  };
  return cachedSources;
}

/** Test seam: supply the sources directly instead of importing them. */
export function __setTranscendenceSources(sources) {
  cachedSources = sources;
}

/**
 * Build the Transcendence document.
 *
 * @param {object} input
 * @param {object} input.identity         release identity (title, artist, year…)
 * @param {object} input.edition          the fixed edition record
 * @param {object} input.analysis         payload from `analyseTrack`
 * @param {object} input.track            { track_id, title, primary_artist, audio, terrain }
 * @param {Array}  input.timedLines       lyric lines from the Lyrics step
 * @param {Array}  input.landmarks        creator placements
 * @param {object} input.artDirection
 * @param {object} [input.terrainData]    { rgba, width, height } from analysis stage
 * @param {object} [input.worldData]      prebuilt deterministic geography data
 * @param {number} [input.arcEndSeconds]  defaults to the whole track
 * @param {object} [input.credits]        { line } for the sheet header
 * @param {boolean} [input.debug]         include the cue inspector
 *
 * @returns {Promise<{ html: string, sequence: Array, analysis: object, config: object, arcEnd: number, snapped: number }>}
 */
export async function buildTranscendenceHTML(input) {
  const { template, styles, runtime } = await loadTranscendenceSources();
  const {
    identity = {}, edition = {}, analysis, track = {}, timedLines = [], landmarks = [],
    artDirection = {}, terrainData = null, worldData = null, arcEndSeconds = null, creditLine = '', debug = false,
  } = input;

  if (!analysis) throw new Error('Transcendence needs an analysis payload. Run the analysis first.');
  if (!track.audio?.src) throw new Error('Transcendence needs a packaged audio component to reference.');
  if (!track.terrain) throw new Error('Transcendence needs a packaged terrain component to reference.');

  const art = normalizeArtDirection(artDirection);
  const bandCentresHz = analysis.parameters?.terrain?.band_centres_hz ?? [];
  const duration = Number(analysis.duration_seconds) || 0;

  // The runtime reads lyric geometry out of the analysis payload, so the creator's
  // placements are joined onto the measurement here — the one place where measured
  // and authored data meet.
  const lyrics = buildLyricLines({ timedLines, landmarks, bandCentresHz, durationSeconds: duration });
  const shipped = { ...analysis, lyrics };
  const geography = worldData ?? (terrainData ? buildWorldData({ terrainData, durationSeconds: duration }) : null);

  const { cues, snapped, arcEnd } = generateSequence({
    analysis: shipped,
    landmarks: landmarks.length ? landmarks : lyrics.map((line, index) => ({ line: index, time: line.aligned_seconds, band: line.terrain_band })),
    arcEndSeconds,
    worldData: geography,
  });

  const config = {
    version: '1.0.0',
    slice: { track: track.track_id || 'track-01', start: 0, end: Number(arcEnd.toFixed(3)) },
    assets: {
      terrain: track.terrain,
      // These two are the reference edition's procedural textures. A Studio
      // package does not ship them, and the shaders are written so a null map
      // degrades to the analytic surface rather than to a black frame.
      dustGrain: track.dustGrain || '',
      blueNoise: track.blueNoise || '',
    },
    artDirection: art,
    worldData: geography,
  };

  const title = identity.title || track.title || 'Untitled';
  const artist = identity.artist || track.primary_artist || '';
  const trackLabel = track.title && track.title !== title ? track.title : 'Sonic Terrain';

  const html = fillMarkers(template, {
    css: styles,
    // three and gsap are already inlined in the prebuilt template.
    three: '', gsap: '',
    runtime,
    analysis: escapeJsonPayload(shipped),
    edition: escapeJsonPayload(publicEdition(edition, identity)),
    config: escapeJsonPayload(config),
    sequence: escapeJsonPayload(cues),
    debugPanel: debug ? debugPanelHtml(arcEnd) : null,
    title: escapeHtml(title),
    subtitle: escapeHtml(trackLabel),
    credit: escapeHtml(creditLine || artist),
    durationLabel: timecode(arcEnd),
    arcEnd: String(Number(arcEnd.toFixed(2))),
    thresholdTitle: escapeHtml(artist ? `${title} — ${artist}` : title),
    thresholdAction: 'Press and hold to enter the recording',
    thresholdHint: 'Below you is the whole track: time runs to the horizon, frequency runs left to right, elevation is loudness. Holding the gesture begins the flight.',
    openingTitle: 'The sealed object',
    openingScene: 'The whole recording lies below in the dark, unlit and untravelled.',
    // Weaker than the reference edition's claim, and true. See landmarks.js.
    lyricProvenance: 'Each line was placed on the terrain by the artist, at a time and a frequency band of their choosing. The terrain itself is measured from the recording; where the words sit on it is an authored decision, recorded as such in the package’s analysis file.',
    audioSources: audioSourceTags([{ src: track.audio.src, type: track.audio.mime || 'audio/mpeg' }]),
  });

  return { html, sequence: cues, analysis: shipped, config, arcEnd, snapped, worldData: geography };
}

/**
 * Fail loudly on a template that was never prebuilt.
 *
 * `buildTranscendenceHTML` passes empty strings for the three and gsap markers
 * because the prebuild has already filled them. If it had not, that would quietly
 * produce a package with no renderer at all — a black page in a collector's hands.
 * Checked once when the sources load, so the error names the fix.
 */
export function assertTemplatePrebuilt(template) {
  for (const token of ['/* THREE_RUNTIME */', '/* GSAP_RUNTIME */']) {
    if (template.includes(token)) {
      throw new Error(
        `TRANSCENDENCE.html still contains ${token}. Run "npm run build:transcendence-template".`,
      );
    }
  }
  if (!template.includes('window.THREE=Object.assign')) {
    throw new Error('TRANSCENDENCE.html has no Three.js runtime inlined. Run "npm run build:transcendence-template".');
  }
}

function publicEdition(edition, identity) {
  return {
    edition_id: edition.edition_id || '',
    name: edition.edition_name || 'First Edition',
    copy: edition.edition_size ? `001 / ${edition.edition_size}` : '',
    release_id: identity.release_id || '',
    principle: 'Audio supplies the terrain. Analysis supplies the physics. The artist supplies the meaning. Nothing in this landscape was modelled: it is the measured shape of the recording, flown through in sync with its own playback.',
  };
}

function debugPanelHtml(arcEnd) {
  return `<section id="debug" hidden aria-label="Developer cue inspector">
    <div class="debug-jumps"></div>
    <label>Time <input id="debug-time" type="range" min="0" max="${Number(arcEnd.toFixed(2))}" step="0.05" value="0"></label>
    <output id="debug-output"></output>
  </section>`;
}
