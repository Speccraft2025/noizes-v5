import { sampleMacroHeight } from './buildTerrainMesh.js';

const TAU = Math.PI * 2;

export function extractGeographicHierarchy(world) {
  const summits = detectSummits(world);
  const peaks = summits.slice(0, 8).map((summit, index) => ({
    ...summit,
    id: stableId('peak', index),
    type: 'peak',
    summitId: summit.id,
    navigation: radialNavigation(summit.position, 180),
  }));
  const ranges = world.ranges.map((range, index) => rangeLandmark(world, range, index));
  const troughs = world.troughs.map((trough, index) => troughLandmark(world, trough, index));
  const basins = world.basins.map((basin, index) => basinLandmark(world, basin, index));
  const ridges = ranges.flatMap((range) => splitRidge(range));
  const passes = detectPasses(world, summits);

  return {
    schema: world.generation >= 3 ? 'transcendence-geography-v3' : 'transcendence-geography-v2',
    scale: 'macro',
    surfaceFeatures: {
      mesoArticulation: true,
      microArticulation: true,
      journeyEligible: false,
      note: 'Surface detail remains visual articulation and is not enumerated as geographic landmarks.',
    },
    journeyLandmarks: { ranges, peaks, troughs, basins, summits, ridges, passes },
    counts: {
      ranges: ranges.length,
      peaks: peaks.length,
      troughs: troughs.length,
      basins: basins.length,
      summits: summits.length,
      ridges: ridges.length,
      passes: passes.length,
    },
  };
}

function detectSummits(world) {
  const candidates = [];
  const step = 140;
  const marginX = world.width * 0.14;
  const marginZ = world.depth * 0.14;

  for (let z = -world.depth / 2 + marginZ; z <= world.depth / 2 - marginZ; z += step) {
    for (let x = -world.width / 2 + marginX; x <= world.width / 2 - marginX; x += step) {
      const height = sampleMacroHeight(world, x, z);
      if (!isLocalMaximum(world, x, z, height, step * 1.7)) continue;
      const metrics = measureProminence(world, x, z, height, 420);
      if (metrics.prominence < 105 || metrics.persistence < 0.66) continue;
      candidates.push({ x, z, elevation: height, ...metrics });
    }
  }

  const selected = separated(candidates, 620, 12);
  return selected.map((candidate, index) => ({
    id: stableId('summit', index),
    type: 'summit',
    position: point(candidate.x, candidate.elevation, candidate.z),
    prominence: round(candidate.prominence),
    extent: round(candidate.extent),
    persistence: round(candidate.persistence, 3),
    ...(spectralSourceAt(world, candidate.x, candidate.z, 'detected-summit') ? { spectralSource: spectralSourceAt(world, candidate.x, candidate.z, 'detected-summit') } : {}),
    navigation: radialNavigation(point(candidate.x, candidate.elevation, candidate.z), 180),
  }));
}

function isLocalMaximum(world, x, z, height, radius) {
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * TAU;
    if (sampleMacroHeight(world, x + Math.cos(angle) * radius, z + Math.sin(angle) * radius) >= height) return false;
  }
  return true;
}

function measureProminence(world, x, z, height, radius) {
  const rings = [0.55, 0.8, 1, 1.3];
  const drops = rings.map((scale) => {
    const samples = ringSamples(world, x, z, radius * scale, 20);
    return height - median(samples);
  });
  const positive = drops.filter((drop) => drop > 55).length;
  return {
    prominence: median(drops),
    extent: radius * rings[Math.max(0, positive - 1)],
    persistence: positive / rings.length,
  };
}

function rangeLandmark(world, range, index) {
  const elevation = sampleMacroHeight(world, range.x, range.z);
  const left = sampleMacroHeight(world, range.x - range.dirZ * range.width * 2, range.z + range.dirX * range.width * 2);
  const right = sampleMacroHeight(world, range.x + range.dirZ * range.width * 2, range.z - range.dirX * range.width * 2);
  return {
    id: stableId('range', index),
    type: 'range',
    position: point(range.x, elevation, range.z),
    direction: point(range.dirX, 0, range.dirZ),
    length: round(range.length * 2.5),
    extent: round(range.width * 2.3),
    prominence: round(elevation - Math.max(left, right)),
    persistence: 1,
    ...(range.spectralSource ? { spectralSource: range.spectralSource } : {}),
    navigation: axisNavigation(range, elevation, 0.42),
  };
}

function troughLandmark(world, trough, index) {
  const elevation = sampleMacroHeight(world, trough.x, trough.z);
  const left = sampleMacroHeight(world, trough.x - trough.dirZ * trough.width * 1.45, trough.z + trough.dirX * trough.width * 1.45);
  const right = sampleMacroHeight(world, trough.x + trough.dirZ * trough.width * 1.45, trough.z - trough.dirX * trough.width * 1.45);
  return {
    id: stableId('trough', index),
    type: 'trough',
    position: point(trough.x, elevation, trough.z),
    direction: point(trough.dirX, 0, trough.dirZ),
    length: round(trough.length * 2.4),
    extent: round(trough.width * 2.2),
    prominence: round(Math.min(left, right) - elevation),
    persistence: 1,
    ...(trough.spectralSource ? { spectralSource: trough.spectralSource } : {}),
    navigation: axisNavigation(trough, elevation, 0.42),
  };
}

function basinLandmark(world, basin, index) {
  const elevation = sampleMacroHeight(world, basin.x, basin.z);
  const rim = ringSamples(world, basin.x, basin.z, Math.min(basin.radiusX, basin.radiusZ) * 1.15, 24);
  return {
    id: stableId('basin', index),
    type: 'basin',
    position: point(basin.x, elevation, basin.z),
    extent: round(Math.sqrt(basin.radiusX * basin.radiusZ)),
    prominence: round(median(rim) - elevation),
    persistence: 1,
    ...(basin.spectralSource ? { spectralSource: basin.spectralSource } : {}),
    navigation: radialNavigation(point(basin.x, elevation, basin.z), basin.radiusX * 0.55),
  };
}

function splitRidge(range) {
  const sections = range.length > 3000 ? 2 : 1;
  return Array.from({ length: sections }, (_, index) => {
    const along = sections === 1 ? 0 : (index === 0 ? -0.24 : 0.24) * range.length;
    return {
      ...range,
      id: `${range.id}-ridge-${String(index + 1).padStart(2, '0')}`,
      type: 'ridge',
      parentRangeId: range.id,
      position: point(
        range.position.x + range.direction.x * along,
        range.position.y,
        range.position.z + range.direction.z * along,
      ),
      length: round(range.length / sections),
      navigation: axisNavigation({
        x: range.position.x,
        z: range.position.z,
        dirX: range.direction.x,
        dirZ: range.direction.z,
        length: range.length / sections,
      }, range.position.y, 0.35),
    };
  });
}

function detectPasses(world, summits) {
  const candidates = [];
  for (let a = 0; a < summits.length; a += 1) {
    for (let b = a + 1; b < summits.length; b += 1) {
      const first = summits[a].position;
      const second = summits[b].position;
      const distance = Math.hypot(second.x - first.x, second.z - first.z);
      if (distance < 520 || distance > 1550) continue;
      let saddle = null;
      for (let step = 5; step < 20; step += 1) {
        const t = step / 24;
        const x = first.x + (second.x - first.x) * t;
        const z = first.z + (second.z - first.z) * t;
        const elevation = sampleMacroHeight(world, x, z);
        if (!saddle || elevation < saddle.elevation) saddle = { x, z, elevation };
      }
      const descent = Math.min(first.y, second.y) - saddle.elevation;
      if (descent > 70 && descent < 360) candidates.push({ ...saddle, descent, distance });
    }
  }
  return separated(candidates, 520, 6).map((candidate, index) => ({
    id: stableId('pass', index),
    type: 'pass',
    position: point(candidate.x, candidate.elevation, candidate.z),
    prominence: round(candidate.descent),
    extent: round(candidate.distance * 0.22),
    persistence: 0.75,
    navigation: radialNavigation(point(candidate.x, candidate.elevation, candidate.z), 150),
  }));
}

function separated(candidates, minDistance, limit) {
  const selected = [];
  for (const candidate of candidates.sort((a, b) => (b.prominence ?? b.descent) - (a.prominence ?? a.descent))) {
    if (selected.every((entry) => Math.hypot(entry.x - candidate.x, entry.z - candidate.z) >= minDistance)) selected.push(candidate);
    if (selected.length === limit) break;
  }
  return selected;
}

function ringSamples(world, x, z, radius, count) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * TAU;
    return sampleMacroHeight(world, x + Math.cos(angle) * radius, z + Math.sin(angle) * radius);
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function stableId(type, index) {
  return `${type}-${String(index + 1).padStart(3, '0')}`;
}

function axisNavigation(feature, elevation, fraction) {
  const distance = feature.length * fraction;
  return {
    safeEntry: point(feature.x - feature.dirX * distance, elevation, feature.z - feature.dirZ * distance),
    safeExit: point(feature.x + feature.dirX * distance, elevation, feature.z + feature.dirZ * distance),
    minimumClearance: 120,
  };
}

function radialNavigation(position, radius) {
  return {
    safeEntry: point(position.x - radius, position.y, position.z),
    safeExit: point(position.x + radius, position.y, position.z),
    minimumClearance: 140,
  };
}

function spectralSourceAt(world, x, z, kind) {
  const mapping = world.spectralField?.worldMapping;
  if (!mapping) return null;
  const progress = (x - mapping.timeStartX) / Math.max(mapping.timeEndX - mapping.timeStartX, 0.001);
  const bandFraction = (z - mapping.lowBandZ) / Math.max(mapping.highBandZ - mapping.lowBandZ, 0.001);
  const centres = world.spectralField.source?.bandCentresHz ?? [];
  const bandIndex = Math.max(0, Math.min(centres.length - 1, Math.round(bandFraction * Math.max(centres.length - 1, 0))));
  return {
    kind,
    seconds: round(Math.max(0, Math.min(1, progress)) * mapping.durationSeconds, 3),
    bandFraction: round(Math.max(0, Math.min(1, bandFraction)), 4),
    bandIndex,
    hz: centres[bandIndex] ?? null,
  };
}

function point(x, y, z) {
  return { x: round(x), y: round(y), z: round(z) };
}

function round(value, precision = 1) {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}
