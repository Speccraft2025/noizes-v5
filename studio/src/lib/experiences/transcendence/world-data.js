export const WORLD_SCALE = Object.freeze({
  timeScale: 26,
  bandWidth: 420,
});

export const LANDMARK_TYPES = ['peak', 'trough', 'ridge', 'pass', 'summit', 'basin'];
export const JOURNEY_PHASES = ['AERIAL_OVERVIEW', 'PEAK_TRAVERSE', 'DESCENT', 'TROUGH', 'ASCENT', 'CREST', 'REVEAL', 'SECOND_TROUGH'];
export const CAMERA_SHOT_STATES = ['AERIAL', 'APPROACH', 'PEAK', 'DESCEND', 'TROUGH', 'CLIMB', 'CREST', 'REVEAL'];

const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);

function sampleChannel(rgba, width, height, x, y, channel = 0) {
  const px = clamp(Math.round(x), 0, width - 1);
  const py = clamp(Math.round(y), 0, height - 1);
  return rgba[(py * width + px) * 4 + channel] / 255;
}

function sampleHeight(rgba, width, height, x, y) {
  const energy = sampleChannel(rgba, width, height, x, y, 0);
  const ridge = sampleChannel(rgba, width, height, x, y, 3);
  return energy * 0.8 + ridge * 0.7;
}

function terrainPoint({ rgba, width, height, durationSeconds }, x, y) {
  const seconds = (x / Math.max(1, width - 1)) * durationSeconds;
  const bandIndex = height - 1 - y;
  const bandFraction = bandIndex / Math.max(1, height - 1);
  const worldX = (bandFraction - 0.5) * WORLD_SCALE.bandWidth;
  const worldZ = -seconds * WORLD_SCALE.timeScale;
  const elevation = sampleHeight(rgba, width, height, x, y);
  return { x, y, seconds, bandIndex, bandFraction, worldX, worldZ, elevation };
}

function mergeNearby(candidates, radiusX, radiusY, prefer) {
  const merged = [];
  const taken = new Array(candidates.length).fill(false);
  for (let i = 0; i < candidates.length; i++) {
    if (taken[i]) continue;
    let best = candidates[i];
    taken[i] = true;
    for (let j = i + 1; j < candidates.length; j++) {
      if (taken[j]) continue;
      const candidate = candidates[j];
      if (Math.abs(candidate.x - best.x) > radiusX || Math.abs(candidate.y - best.y) > radiusY) continue;
      taken[j] = true;
      if (prefer(candidate, best)) best = candidate;
    }
    merged.push(best);
  }
  return merged;
}

function stableLandmarkId(type, index) {
  return `${type}-${String(index + 1).padStart(3, '0')}`;
}

export function extractTerrainLandmarks({ rgba, width, height, durationSeconds }) {
  if (!(rgba instanceof Uint8Array) || width < 3 || height < 3 || !(durationSeconds > 0)) {
    return { landmarks: [], summary: { counts: {} } };
  }

  const peaks = [];
  const troughs = [];
  const ridges = [];
  const basins = [];
  const passes = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = terrainPoint({ rgba, width, height, durationSeconds }, x, y);
      const neighbours = [
        terrainPoint({ rgba, width, height, durationSeconds }, x - 1, y - 1),
        terrainPoint({ rgba, width, height, durationSeconds }, x, y - 1),
        terrainPoint({ rgba, width, height, durationSeconds }, x + 1, y - 1),
        terrainPoint({ rgba, width, height, durationSeconds }, x - 1, y),
        terrainPoint({ rgba, width, height, durationSeconds }, x + 1, y),
        terrainPoint({ rgba, width, height, durationSeconds }, x - 1, y + 1),
        terrainPoint({ rgba, width, height, durationSeconds }, x, y + 1),
        terrainPoint({ rgba, width, height, durationSeconds }, x + 1, y + 1),
      ];
      const higher = neighbours.filter((n) => center.elevation > n.elevation);
      const lower = neighbours.filter((n) => center.elevation < n.elevation);
      const maxNeighbour = Math.max(...neighbours.map((n) => n.elevation));
      const minNeighbour = Math.min(...neighbours.map((n) => n.elevation));
      const prominence = center.elevation - minNeighbour;
      const depth = maxNeighbour - center.elevation;
      const ridgeSalience = sampleChannel(rgba, width, height, x, y, 3);

      if (higher.length === neighbours.length && prominence > 0.06) {
        peaks.push({ ...center, type: 'peak', prominence, depth: 0, salience: ridgeSalience });
        if (prominence > 0.12) basins.push(null);
      }
      if (lower.length === neighbours.length && depth > 0.05) {
        troughs.push({ ...center, type: 'trough', prominence: 0, depth, salience: ridgeSalience });
      }

      const dx = sampleHeight(rgba, width, height, x + 1, y) - sampleHeight(rgba, width, height, x - 1, y);
      const dy = sampleHeight(rgba, width, height, x, y + 1) - sampleHeight(rgba, width, height, x, y - 1);
      const slope = Math.hypot(dx, dy);
      const lateralContrast = Math.abs(
        sampleHeight(rgba, width, height, x - 1, y) - sampleHeight(rgba, width, height, x + 1, y)
      );
      if (ridgeSalience > 0.45 && slope < 0.08 && lateralContrast > 0.07) {
        ridges.push({ ...center, type: 'ridge', prominence, depth, salience: ridgeSalience });
      }
      if (depth < 0.03 && prominence < 0.03 && lateralContrast > 0.08 && ridgeSalience > 0.25) {
        passes.push({ ...center, type: 'pass', prominence, depth, salience: ridgeSalience });
      }
      if (depth > 0.08 && ridgeSalience < 0.18 && center.elevation < 0.4) {
        basins.push({ ...center, type: 'basin', prominence: 0, depth, salience: ridgeSalience });
      }
    }
  }

  const mergedPeaks = mergeNearby(peaks, 10, 6, (a, b) => a.prominence > b.prominence);
  const mergedTroughs = mergeNearby(troughs, 10, 6, (a, b) => a.depth > b.depth);
  const mergedRidges = mergeNearby(ridges, 12, 4, (a, b) => a.salience > b.salience);
  const mergedPasses = mergeNearby(passes, 14, 5, (a, b) => a.salience > b.salience);
  const mergedBasins = mergeNearby(basins.filter(Boolean), 14, 8, (a, b) => a.depth > b.depth);

  const summits = mergedPeaks
    .slice()
    .sort((a, b) => b.prominence - a.prominence)
    .slice(0, Math.max(1, Math.min(3, mergedPeaks.length)))
    .map((peak) => ({ ...peak, type: 'summit' }));

  const typed = {
    peak: mergedPeaks,
    trough: mergedTroughs,
    ridge: mergedRidges,
    pass: mergedPasses,
    summit: summits,
    basin: mergedBasins,
  };

  const landmarks = [];
  for (const type of LANDMARK_TYPES) {
    const items = (typed[type] || [])
      .slice()
      .sort((a, b) => a.seconds - b.seconds || b.elevation - a.elevation);
    items.forEach((item, index) => {
      landmarks.push({
        id: stableLandmarkId(type, index),
        type,
        seconds: Number(item.seconds.toFixed(3)),
        band: Number(item.bandFraction.toFixed(4)),
        world: {
          x: Number(item.worldX.toFixed(3)),
          y: Number((item.elevation * 30).toFixed(3)),
          z: Number(item.worldZ.toFixed(3)),
        },
        prominence: Number((item.prominence || 0).toFixed(4)),
        depth: Number((item.depth || 0).toFixed(4)),
        salience: Number((item.salience || 0).toFixed(4)),
        safe_entry: {
          x: Number(item.worldX.toFixed(3)),
          y: Number(((item.elevation * 30) + (type === 'trough' || type === 'basin' ? 8 : 18)).toFixed(3)),
          z: Number((item.worldZ + 70).toFixed(3)),
        },
        safe_exit: {
          x: Number(item.worldX.toFixed(3)),
          y: Number(((item.elevation * 30) + (type === 'trough' || type === 'basin' ? 8 : 18)).toFixed(3)),
          z: Number((item.worldZ - 70).toFixed(3)),
        },
      });
    });
  }

  return {
    landmarks,
    summary: {
      counts: Object.fromEntries(LANDMARK_TYPES.map((type) => [type, landmarks.filter((item) => item.type === type).length])),
    },
  };
}

function landmarkByType(landmarks, type) {
  return landmarks.filter((item) => item.type === type).sort((a, b) => a.seconds - b.seconds);
}

function firstAfter(list, seconds) {
  return list.find((item) => item.seconds > seconds) || null;
}

function nearestBefore(list, seconds) {
  const eligible = list.filter((item) => item.seconds < seconds);
  return eligible[eligible.length - 1] || null;
}

export function planGeographicJourney(landmarks, durationSeconds) {
  const peaks = landmarkByType(landmarks, 'peak');
  const troughs = landmarkByType(landmarks, 'trough');
  const crests = landmarkByType(landmarks, 'pass').concat(landmarkByType(landmarks, 'ridge')).sort((a, b) => a.seconds - b.seconds);
  const reveals = landmarkByType(landmarks, 'basin');
  const aerialPeak = peaks[0] || landmarkByType(landmarks, 'summit')[0] || null;
  const firstTrough = aerialPeak ? firstAfter(troughs, aerialPeak.seconds) : troughs[0] || null;
  const climbPeak = firstTrough ? firstAfter(peaks, firstTrough.seconds) : firstAfter(peaks, 0);
  const crest = climbPeak ? firstAfter(crests, climbPeak.seconds) || nearestBefore(crests, climbPeak.seconds + 8) : crests[0] || null;
  const reveal = crest ? firstAfter(reveals, crest.seconds) || firstAfter(troughs, crest.seconds) : reveals[0] || null;
  const secondTrough = reveal ? firstAfter(troughs, reveal.seconds) : firstAfter(troughs, (firstTrough?.seconds || 0) + 6);

  const draft = [
    { phase: 'AERIAL_OVERVIEW', landmark_id: aerialPeak?.id || null, shot: 'AERIAL', time: Math.max(0, (aerialPeak?.seconds || durationSeconds * 0.08) - 6) },
    { phase: 'PEAK_TRAVERSE', landmark_id: aerialPeak?.id || null, shot: 'PEAK', time: aerialPeak?.seconds || durationSeconds * 0.18 },
    { phase: 'DESCENT', landmark_id: firstTrough?.id || null, shot: 'DESCEND', time: aerialPeak && firstTrough ? (aerialPeak.seconds + firstTrough.seconds) * 0.5 : durationSeconds * 0.28 },
    { phase: 'TROUGH', landmark_id: firstTrough?.id || null, shot: 'TROUGH', time: firstTrough?.seconds || durationSeconds * 0.4 },
    { phase: 'ASCENT', landmark_id: climbPeak?.id || crest?.id || null, shot: 'CLIMB', time: firstTrough && climbPeak ? (firstTrough.seconds + climbPeak.seconds) * 0.5 : durationSeconds * 0.56 },
    { phase: 'CREST', landmark_id: crest?.id || climbPeak?.id || null, shot: 'CREST', time: crest?.seconds || climbPeak?.seconds || durationSeconds * 0.66 },
    { phase: 'REVEAL', landmark_id: reveal?.id || null, shot: 'REVEAL', time: reveal?.seconds || durationSeconds * 0.76 },
    { phase: 'SECOND_TROUGH', landmark_id: secondTrough?.id || null, shot: 'APPROACH', time: secondTrough?.seconds || durationSeconds * 0.88 },
  ];
  const route = [];
  let previous = -1;
  for (const step of draft) {
    const time = Number(clamp(step.time, previous + 1, durationSeconds).toFixed(3));
    route.push({ ...step, time });
    previous = time;
  }

  return {
    route,
    shots: CAMERA_SHOT_STATES,
  };
}

export function buildWorldData({ terrainData, durationSeconds }) {
  const { landmarks, summary } = extractTerrainLandmarks({ ...terrainData, durationSeconds });
  const journey = planGeographicJourney(landmarks, durationSeconds);
  return {
    version: '2.0.0',
    scale: WORLD_SCALE,
    summary,
    landmarks,
    journey,
  };
}
