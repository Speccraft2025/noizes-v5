import { generateMacroWorld } from '../transcendence-v2/world/generateMacroWorld.js';
import { sampleHeight } from '../transcendence-v2/world/buildTerrainMesh.js';
import { extractGeographicHierarchy } from '../transcendence-v2/world/extractGeographicHierarchy.js';
import { buildGeographicJourney } from '../transcendence-v2/journey/buildGeographicJourney.js';

export const TRANSCENDENCE_V2_SCHEMA = '5.0.0';
export const TRANSCENDENCE_V2_QUALITY_PROFILES = ['cinematic', 'balanced', 'lite', 'essential'];
export const APPROVED_V17_ART_DIRECTION = Object.freeze({
  preset: 'approved-v17-green-gold',
  palette: 'evergreen',
  surface: 'weathered-matte',
  fog: 'restrained-green-depth',
  lighting: 'low-gold-oblique',
  grain: 'fine',
  cameraShake: false,
});

let cachedSources = null;

export function buildTrackGeography({ trackId = '', analysis = {}, terrainData } = {}) {
  if (!terrainData?.rgba?.length) throw new Error('Transcendence V2 needs raw terrain samples from the current analysis run.');
  const profile = spectralProfile(terrainData);
  const seed = stableSeed(trackId, terrainData.rgba);
  const world = generateMacroWorld({ seed, spectralProfile: profile });
  const geography = extractGeographicHierarchy(world);
  const journey = buildGeographicJourney(world, geography, (x, z) => sampleHeight(world, x, z));
  return {
    worldData: { ...world, landmarks: geography, journey },
    geography,
    journey,
    analysis: { ...analysis, transcendence_v2: { seed, spectral_profile: profile } },
  };
}

export async function buildTranscendenceV2HTML(input) {
  const built = input.worldData
    ? {
        worldData: input.worldData,
        geography: input.geography || input.worldData.landmarks,
        journey: input.journey || input.worldData.journey,
        analysis: input.analysis,
      }
    : buildTrackGeography(input);
  return assembleTranscendenceHTML(input, built, {
    version: 'transcendence-v2',
    label: 'TRANSCENDENCE V2',
    titleLabel: 'Transcendence V2',
    sequencePrefix: 'v2',
  });
}

export async function assembleTranscendenceHTML(input, built, experience) {
  const { template, styles, runtime, three } = await loadTranscendenceV2Sources();
  const duration = Number(input.analysis?.duration_seconds) || 0;
  const world = { ...built.worldData };
  delete world.landmarks;
  delete world.journey;
  const config = {
    version: experience.version,
    ...(experience.configLabel ? { label: experience.configLabel } : {}),
    mode: 'geographic-journey',
    title: input.identity?.title || input.track?.title || 'Untitled',
    artist: input.identity?.artist || input.track?.primary_artist || '',
    trackId: input.track?.track_id || 'track-01',
    audioPath: input.track?.audio?.src || '',
    audioMime: input.track?.audio?.mime || 'audio/mpeg',
    durationSeconds: duration,
    qualityProfile: input.qualityProfile || 'balanced',
    artDirection: { ...APPROVED_V17_ART_DIRECTION, ...(input.artDirection || {}), cameraShake: false },
    directionTracks: input.directionTracks || {},
    worldData: world,
    geography: built.geography,
    journey: built.journey,
  };
  if (!config.audioPath) throw new Error(`${experience.label} needs a packaged audio component to reference.`);
  const html = template
    .split('/* TXV2_CSS */').join(styles)
    .split('/* THREE_RUNTIME */').join(three)
    .split('/* TXV2_CONFIG */').join(escapeJson(config))
    .split('/* TXV2_RUNTIME */').join(runtime)
    .split('/* TXV2_TITLE */').join(escapeHtml(`${config.title} · ${experience.titleLabel || experience.label}`));
  const sequence = built.journey.keyframes.map((frame, index) => ({
    time: Number((frame.at * duration).toFixed(3)),
    id: `${experience.sequencePrefix}-${String(index + 1).padStart(2, '0')}`,
    phase: frame.chapter,
    shot: frame.state,
    anchored_to: frame.landmarkId,
  }));
  return {
    html,
    sequence,
    analysis: built.analysis,
    config,
    arcEnd: duration,
    snapped: sequence.length,
    worldData: built.worldData,
    geography: built.geography,
    journey: built.journey,
  };
}

export function __setTranscendenceV2Sources(sources) {
  cachedSources = sources;
}

async function loadTranscendenceV2Sources() {
  if (cachedSources) return cachedSources;
  const [template, styles, core, main, ...modules] = await Promise.all([
    import('../transcendence-v2/experience.html?raw'),
    import('../transcendence-v2/styles.css?raw'),
    import('../../../node_modules/three/build/three.core.min.js?raw'),
    import('../../../node_modules/three/build/three.module.min.js?raw'),
    import('../transcendence-v2/world/generateMacroWorld.js?raw'),
    import('../transcendence-v2/world/buildTerrainMesh.js?raw'),
    import('../transcendence-v2/world/extractGeographicHierarchy.js?raw'),
    import('../transcendence-v2/render/lighting.js?raw'),
    import('../transcendence-v2/render/atmosphere.js?raw'),
    import('../transcendence-v2/camera/shotTypes.js?raw'),
    import('../transcendence-v2/journey/buildGeographicJourney.js?raw'),
    import('../transcendence-v2/camera/terrainClearance.js?raw'),
    import('../transcendence-v2/camera/cameraDirector.js?raw'),
    import('../transcendence-v2/render/renderer.js?raw'),
    import('../transcendence-v2/runtime/TranscendenceV2.js?raw'),
    import('../transcendence-v2/runtime/boot.js?raw'),
  ]);
  cachedSources = {
    template: template.default,
    styles: styles.default,
    three: buildThreeRuntime(core.default, main.default),
    runtime: modules.map((module) => module.default.replace(/^import .*$/gm, '').replace(/^export /gm, '')).join('\n'),
  };
  return cachedSources;
}

function spectralProfile(terrainData) {
  const rgba = terrainData.rgba;
  let sum = 0;
  let delta = 0;
  let previous = rgba[0] || 0;
  let samples = 0;
  const stride = Math.max(4, Math.floor(rgba.length / 16384 / 4) * 4);
  for (let index = 0; index < rgba.length; index += stride) {
    const value = rgba[index];
    sum += value;
    delta += Math.abs(value - previous);
    previous = value;
    samples += 1;
  }
  return {
    articulation: round(0.78 + (sum / Math.max(samples, 1) / 255) * 0.5),
    detail: round(0.72 + (delta / Math.max(samples, 1) / 255) * 1.2),
  };
}

function stableSeed(trackId, bytes) {
  let hash = 2166136261;
  const text = String(trackId);
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  const stride = Math.max(1, Math.floor(bytes.length / 4096));
  for (let index = 0; index < bytes.length; index += stride) hash = Math.imul(hash ^ bytes[index], 16777619);
  return hash >>> 0;
}

function buildThreeRuntime(coreSource, mainSource) {
  const convertExport = (source) => {
    const match = source.match(/export\{([^}]*)\};?\s*$/);
    if (!match) throw new Error('Unable to inline the Three.js runtime.');
    const entries = match[1].split(',').map((entry) => {
      const parts = entry.trim().split(/\s+as\s+/);
      return `${JSON.stringify(parts[1] || parts[0])}:${parts[0]}`;
    });
    return { body: source.slice(0, match.index), object: entries.join(',') };
  };
  const core = convertExport(coreSource);
  const importMatch = mainSource.match(/import\{([^}]*)\}from"\.\/three\.core\.min\.js";/);
  if (!importMatch) throw new Error('Unable to inline the Three.js core runtime.');
  const destructured = importMatch[1].split(',').map((entry) => {
    const parts = entry.trim().split(/\s+as\s+/);
    return parts.length === 2 ? `${parts[0]}:${parts[1]}` : parts[0];
  }).join(',');
  const prepared = mainSource.replace(importMatch[0], `const{${destructured}}=window.__THREE_CORE__;`)
    .replace(/export\{[^}]*\}from"\.\/three\.core\.min\.js";/, '');
  const main = convertExport(prepared);
  return `(()=>{${core.body}window.__THREE_CORE__={${core.object}};})();${main.body}window.THREE=Object.assign(window.__THREE_CORE__,{${main.object}});delete window.__THREE_CORE__;`;
}

function escapeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
