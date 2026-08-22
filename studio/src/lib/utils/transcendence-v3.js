import { sampleHeight } from '../transcendence-v2/world/buildTerrainMesh.js';
import { extractGeographicHierarchy } from '../transcendence-v2/world/extractGeographicHierarchy.js';
import { buildSpectralWorld } from '../transcendence-v3/world/buildSpectralWorld.js';
import { buildSpectralJourney } from '../transcendence-v3/journey/buildSpectralJourney.js';
import { APPROVED_V17_ART_DIRECTION, assembleTranscendenceHTML } from './transcendence-v2.js';

export const TRANSCENDENCE_V3_SCHEMA = '6.0.0';
export const TRANSCENDENCE_V3_QUALITY_PROFILES = ['cinematic', 'balanced', 'lite', 'essential'];

export function buildTrackSpectralGeography({ trackId = '', analysis = {}, terrainData } = {}) {
  const world = buildSpectralWorld({ trackId, analysis, terrainData });
  const geography = extractGeographicHierarchy(world);
  const journey = buildSpectralJourney(world, geography, (x, z) => sampleHeight(world, x, z));
  return {
    worldData: { ...world, landmarks: geography, journey },
    geography,
    journey,
    analysis: {
      ...analysis,
      transcendence_v3: {
        seed: world.seed,
        mapping: world.spectralField.worldMapping,
        field: { width: world.spectralField.width, height: world.spectralField.height, channels: world.spectralField.channels },
        fidelity: world.fidelity,
      },
    },
  };
}

export async function buildTranscendenceV3HTML(input) {
  const built = input.worldData
    ? {
        worldData: input.worldData,
        geography: input.geography || input.worldData.landmarks,
        journey: input.journey || input.worldData.journey,
        analysis: input.analysis,
      }
    : buildTrackSpectralGeography({ trackId: input.track?.track_id, analysis: input.analysis, terrainData: input.terrainData });
  return assembleTranscendenceHTML({
    ...input,
    artDirection: { ...APPROVED_V17_ART_DIRECTION, ...(input.artDirection || {}), cameraShake: false },
  }, built, {
    version: 'transcendence-v3',
    label: 'TRANSCENDENCE V3',
    configLabel: 'TRANSCENDENCE V3',
    titleLabel: 'Transcendence V3',
    sequencePrefix: 'v3',
  });
}
