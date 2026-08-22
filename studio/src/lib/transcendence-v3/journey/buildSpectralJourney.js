import { finalizeGeographicJourney } from '../../transcendence-v2/journey/buildGeographicJourney.js';

const SEQUENCE = ['AERIAL_OVERVIEW', 'APPROACH', 'PEAK_TRAVERSE', 'DESCENT', 'TROUGH', 'ASCENT', 'CREST', 'REVEAL', 'SECOND_TROUGH'];

export function buildSpectralJourney(world, geography, sampleHeightAt) {
  const landmarks = geography.journeyLandmarks;
  const ranges = chronological(landmarks.ranges);
  const troughs = chronological(landmarks.troughs);
  const peaks = chronological(landmarks.peaks);
  const firstRange = ranges[0];
  const firstPeak = nearestAfter(peaks, firstRange.position.x, firstRange);
  const firstTrough = nearestAfter(troughs, firstPeak.position.x, troughs[0]);
  const dividingRange = nearestAfter(ranges, firstTrough.position.x, ranges[Math.min(1, ranges.length - 1)]);
  const secondTrough = nearestAfter(troughs, dividingRange.position.x, troughs[troughs.length - 1]);
  const duration = world.spectralField.worldMapping.durationSeconds;

  const timing = monotonicTiming([
    0,
    sourceProgress(firstRange, duration, 0.14),
    sourceProgress(firstRange, duration, 0.22),
    sourceProgress(firstPeak, duration, 0.31),
    midpointProgress(firstPeak, firstTrough, duration, 0.39),
    sourceProgress(firstTrough, duration, 0.47),
    sourceProgress(firstTrough, duration, 0.57) + 0.055,
    midpointProgress(firstTrough, dividingRange, duration, 0.68),
    sourceProgress(dividingRange, duration, 0.76),
    sourceProgress(dividingRange, duration, 0.82) + 0.055,
    midpointProgress(dividingRange, secondTrough, duration, 0.91),
    Math.max(sourceProgress(secondTrough, duration, 0.97), 0.97),
  ]);

  const firstDirection = directionOf(firstRange);
  const troughDirection = directionOf(firstTrough);
  const crestDirection = directionOf(dividingRange);
  const secondDirection = directionOf(secondTrough);
  const aerialCenter = averagePoint(ranges.slice(0, 3));

  const keyframes = [
    frame(timing[0], 'AERIAL', firstRange, aerialCenter.x - 2600, aerialCenter.z - 2800, 4300, 61, 650, 'AERIAL'),
    frame(timing[1], 'AERIAL', firstRange, firstRange.position.x - firstDirection.x * 2300, firstRange.position.z - firstDirection.z * 2300 - 1200, 2500, 58, 520, 'AERIAL'),
    frame(timing[2], 'APPROACH', firstRange, firstRange.navigation.safeEntry.x, firstRange.navigation.safeEntry.z, 1050, 54, 340, 'APPROACH'),
    frame(timing[3], 'PEAK', firstPeak, firstPeak.position.x - firstDirection.x * 180, firstPeak.position.z - firstDirection.z * 180, 270, 49, 190, 'PEAK'),
    frame(timing[4], 'DESCEND', firstTrough, firstTrough.navigation.safeEntry.x, firstTrough.navigation.safeEntry.z, 235, 48, 155, 'DESCEND'),
    frame(timing[5], 'TROUGH', firstTrough, firstTrough.position.x - troughDirection.x * firstTrough.extent * 0.25, firstTrough.position.z - troughDirection.z * firstTrough.extent * 0.25, 175, 47, 150, 'TROUGH'),
    frame(timing[6], 'TROUGH', firstTrough, firstTrough.navigation.safeExit.x, firstTrough.navigation.safeExit.z, 165, 47, 145, 'TROUGH'),
    frame(timing[7], 'CLIMB', dividingRange, dividingRange.navigation.safeEntry.x, dividingRange.navigation.safeEntry.z, 240, 49, 165, 'CLIMB'),
    frame(timing[8], 'CREST', dividingRange, dividingRange.position.x, dividingRange.position.z, 390, 52, 215, 'CREST'),
    frame(timing[9], 'REVEAL', secondTrough, dividingRange.position.x + crestDirection.x * 420, dividingRange.position.z + crestDirection.z * 420, 470, 56, 255, 'REVEAL'),
    frame(timing[10], 'DESCEND', secondTrough, secondTrough.navigation.safeEntry.x, secondTrough.navigation.safeEntry.z, 245, 51, 160, 'DESCEND'),
    frame(timing[11], 'TROUGH', secondTrough, secondTrough.position.x + secondDirection.x * secondTrough.extent * 0.18, secondTrough.position.z + secondDirection.z * secondTrough.extent * 0.18, 180, 48, 155, 'SECOND_TROUGH'),
  ];
  for (const keyframe of keyframes) {
    keyframe.position.x = clamp(keyframe.position.x, -world.width * 0.43, world.width * 0.43);
    keyframe.position.z = clamp(keyframe.position.z, -world.depth * 0.43, world.depth * 0.43);
  }

  return finalizeGeographicJourney({
    schema: 'transcendence-journey-v3-spectral',
    sourceTiming: 'measured-spectrogram-seconds',
    landmarkIds: [firstRange.id, firstPeak.id, firstTrough.id, dividingRange.id, secondTrough.id],
    sequence: SEQUENCE,
    keyframes,
  }, sampleHeightAt);
}

function frame(at, state, landmark, x, z, height, fov, clearance, chapter) {
  return { at, state, chapter, landmarkId: landmark.id, sourceSeconds: landmark.spectralSource?.seconds ?? null, position: { x, y: height, z }, fov, clearance };
}

function chronological(items) {
  return [...items].sort((a, b) => (a.spectralSource?.seconds ?? a.position.x) - (b.spectralSource?.seconds ?? b.position.x));
}

function nearestAfter(items, x, fallback) {
  return items.find((item) => item.position.x > x + 120) ?? items.find((item) => item.position.x > x - 300) ?? fallback ?? items[0];
}

function sourceProgress(landmark, duration, fallback) {
  const seconds = landmark?.spectralSource?.seconds;
  return Number.isFinite(seconds) ? seconds / Math.max(duration, 0.001) : fallback;
}

function midpointProgress(first, second, duration, fallback) {
  const a = sourceProgress(first, duration, fallback - 0.04);
  const b = sourceProgress(second, duration, fallback + 0.04);
  return (a + b) * 0.5;
}

function monotonicTiming(values) {
  const output = [0];
  for (let index = 1; index < values.length - 1; index += 1) {
    const minimum = output[index - 1] + 0.055;
    const maximum = 1 - (values.length - 1 - index) * 0.055;
    output.push(clamp(values[index], minimum, maximum));
  }
  output.push(1);
  return output;
}

function directionOf(landmark) {
  const direction = landmark.direction ?? { x: 1, z: 0 };
  const length = Math.hypot(direction.x, direction.z) || 1;
  return { x: direction.x / length, z: direction.z / length };
}

function averagePoint(landmarks) {
  const usable = landmarks.length ? landmarks : [{ position: { x: 0, z: 0 } }];
  return usable.reduce((sum, landmark) => ({ x: sum.x + landmark.position.x / usable.length, z: sum.z + landmark.position.z / usable.length }), { x: 0, z: 0 });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
