// Assembles a Journey experience document.
//
// The road counterpart of `transcendence.js`. Journey uses the same analysis
// pipeline (energy, sections, duration) but interprets it as a 3D road
// experience instead of a terrain flyover. No lyrics, no terrain heightmap —
// audio energy drives road elevation and marker placement.

import { audioSourceTags, escapeHtml, escapeJsonPayload, fillMarkers, timecode } from '../experiences/journey/markers.js';

export const JOURNEY_TEMPLATE = 'journey-v1';
export const JOURNEY_SCHEMA = '1.0.0';
export const QUALITY_PROFILES = ['cinematic', 'balanced', 'lite'];

/** The art direction a creator can set, and its defaults. */
export const DEFAULT_ART_DIRECTION = {
  roadParticleCount: 20000,
  atmoParticleCount: 3000,
  markerParticleCount: 800,
  pathRadius: 100,
  circleSpacing: 200,
  yRange: 26,
  fogDensity: 0.0025,
  sideOffset: 4,
  forwardOffset: 5,
  cameraHeight: 2.5,
  lookAhead: 0.05,
  topColor: [0.64, 0.68, 0.88],
  midColor: [0.72, 0.76, 0.92],
  bottomColor: [0.88, 0.90, 0.96],
  groundColor: [0.92, 0.93, 0.96],
  roadColor: [0.18, 0.18, 0.22],
  markerColor: [0.58, 0.65, 0.95],
};

/** Clamp art direction to ranges that look good. */
export function normalizeArtDirection(input = {}) {
  const number = (value, fallback, min, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };
  const color3 = (value, fallback) => {
    if (!Array.isArray(value) || value.length !== 3) return fallback;
    return value.map((v, i) => number(v, fallback[i], 0, 1));
  };
  return {
    roadParticleCount: number(input.roadParticleCount, 20000, 5000, 40000),
    atmoParticleCount: number(input.atmoParticleCount, 3000, 500, 8000),
    markerParticleCount: number(input.markerParticleCount, 800, 200, 2000),
    pathRadius: number(input.pathRadius, 100, 50, 200),
    circleSpacing: number(input.circleSpacing, 200, 100, 400),
    yRange: number(input.yRange, 26, 5, 60),
    fogDensity: number(input.fogDensity, 0.0025, 0.001, 0.01),
    sideOffset: number(input.sideOffset, 4, 1, 12),
    forwardOffset: number(input.forwardOffset, 5, 2, 15),
    cameraHeight: number(input.cameraHeight, 2.5, 1, 10),
    lookAhead: number(input.lookAhead, 0.05, 0.01, 0.15),
    topColor: color3(input.topColor, DEFAULT_ART_DIRECTION.topColor),
    midColor: color3(input.midColor, DEFAULT_ART_DIRECTION.midColor),
    bottomColor: color3(input.bottomColor, DEFAULT_ART_DIRECTION.bottomColor),
    groundColor: color3(input.groundColor, DEFAULT_ART_DIRECTION.groundColor),
    roadColor: color3(input.roadColor, DEFAULT_ART_DIRECTION.roadColor),
    markerColor: color3(input.markerColor, DEFAULT_ART_DIRECTION.markerColor),
  };
}

let cachedSources = null;

/**
 * The four raw sources, loaded once per session.
 */
export async function loadJourneySources() {
  if (cachedSources) return cachedSources;
  const [template, styles, ...modules] = await Promise.all([
    import('../templates/JOURNEY.html?raw'),
    import('../experiences/journey/styles.css?raw'),
    import('../experiences/journey/runtime/01-prelude.js?raw'),
    import('../experiences/journey/runtime/02-world.js?raw'),
    import('../experiences/journey/runtime/03-audio.js?raw'),
    import('../experiences/journey/runtime/04-camera.js?raw'),
    import('../experiences/journey/runtime/05-app.js?raw'),
  ]);
  const names = [
    '01-prelude.js', '02-world.js', '03-audio.js', '04-camera.js', '05-app.js',
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
export function __setJourneySources(sources) {
  cachedSources = sources;
}

/**
 * Build the Journey document.
 *
 * @param {object} input
 * @param {object} input.identity         release identity (title, artist, year…)
 * @param {object} input.edition          the fixed edition record
 * @param {object} input.analysis         payload from `analyseTrack`
 * @param {object} input.track            { track_id, title, primary_artist, audio }
 * @param {object} input.artDirection
 * @param {number} [input.arcEndSeconds]  defaults to the whole track
 * @param {string} [input.creditLine]     for the sheet header
 * @param {boolean} [input.debug]         include the debug panel
 *
 * @returns {Promise<{ html: string, analysis: object, config: object, arcEnd: number }>}
 */
export async function buildJourneyHTML(input) {
  const { template, styles, runtime } = await loadJourneySources();
  const {
    identity = {}, edition = {}, analysis, track = {},
    artDirection = {}, arcEndSeconds = null, creditLine = '', debug = false,
  } = input;

  if (!analysis) throw new Error('Journey needs an analysis payload. Run the analysis first.');
  if (!track.audio?.src) throw new Error('Journey needs a packaged audio component to reference.');

  const art = normalizeArtDirection(artDirection);
  const duration = Number(analysis.duration_seconds) || 0;
  const arcEnd = arcEndSeconds != null ? Math.min(arcEndSeconds, duration) : duration;

  const sections = analysis.sections || [];
  const sequence = sections.map((sec, i) => ({
    index: i,
    start: sec.start,
    label: sec.label || `Section ${i + 1}`,
  }));

  const config = {
    version: '1.0.0',
    slice: { track: track.track_id || 'track-01', start: 0, end: Number(arcEnd.toFixed(3)) },
    artDirection: art,
  };

  const title = identity.title || track.title || 'Untitled';
  const artist = identity.artist || track.primary_artist || '';

  const html = fillMarkers(template, {
    css: styles,
    three: '', gsap: '',
    runtime,
    analysis: escapeJsonPayload(analysis),
    edition: escapeJsonPayload(publicEdition(edition, identity)),
    config: escapeJsonPayload(config),
    sequence: escapeJsonPayload(sequence),
    debugPanel: debug ? debugPanelHtml(arcEnd) : null,
    title: escapeHtml(title),
    subtitle: escapeHtml(track.title && track.title !== title ? track.title : 'Road'),
    credit: escapeHtml(creditLine || artist),
    durationLabel: timecode(arcEnd),
    arcEnd: String(Number(arcEnd.toFixed(2))),
    thresholdTitle: escapeHtml(artist ? `${title} — ${artist}` : title),
    thresholdAction: 'Enter',
    thresholdHint: 'A road carved by the recording stretches out below. Press to begin the ride.',
    audioSources: audioSourceTags([{ src: track.audio.src, type: track.audio.mime || 'audio/mpeg' }]),
  });

  return { html, sequence, analysis, config, arcEnd };
}

/**
 * Fail loudly on a template that was never prebuilt.
 */
export function assertTemplatePrebuilt(template) {
  for (const token of ['/* THREE_RUNTIME */', '/* GSAP_RUNTIME */']) {
    if (template.includes(token)) {
      throw new Error(
        `JOURNEY.html still contains ${token}. Run "npm run build:journey-template".`,
      );
    }
  }
  if (!template.includes('window.THREE=Object.assign')) {
    throw new Error('JOURNEY.html has no Three.js runtime inlined. Run "npm run build:journey-template".');
  }
}

function publicEdition(edition, identity) {
  return {
    edition_id: edition.edition_id || '',
    name: edition.edition_name || 'First Edition',
    copy: edition.edition_size ? `001 / ${edition.edition_size}` : '',
    release_id: identity.release_id || '',
    principle: 'Audio supplies the road. Analysis supplies the shape. The recording is the journey. Nothing in this landscape was modelled: it is the measured form of the track, ridden through in sync with its own playback.',
  };
}

function debugPanelHtml(arcEnd) {
  return `<section id="debug" hidden aria-label="Developer inspector">
    <label>Time <input id="debug-time" type="range" min="0" max="${Number(arcEnd.toFixed(2))}" step="0.05" value="0"></label>
    <output id="debug-output"></output>
  </section>`;
}
