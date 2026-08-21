import * as THREE from 'three';

const DENSE_SAMPLE_COUNT = 900;

export const JOURNEY_STATES = ['AERIAL', 'APPROACH', 'PEAK', 'DESCEND', 'TROUGH', 'CLIMB', 'CREST', 'REVEAL'];

export function buildGeographicJourney(world, geography, sampleHeightAt) {
  const landmarks = geography.journeyLandmarks;
  const rangeA = landmarks.ranges[0];
  const peakA = nearestLandmark(landmarks.peaks, rangeA.position);
  const troughA = landmarks.troughs[0];
  const dividingRange = landmarks.ranges[1];
  const troughB = landmarks.troughs[1];

  const keyframes = [
    frame(0.00, 'AERIAL', rangeA.id, -2850, -3450, 4300, 61, 650, 'AERIAL'),
    frame(0.13, 'AERIAL', rangeA.id, -2550, -2780, 2500, 58, 520, 'AERIAL'),
    frame(0.22, 'APPROACH', rangeA.id, -2260, -2250, 1050, 54, 340, 'APPROACH'),
    frame(0.31, 'PEAK', peakA.id, peakA.position.x - 180, peakA.position.z - 110, 270, 49, 190, 'PEAK'),
    frame(0.39, 'DESCEND', troughA.id, -920, -1430, 235, 48, 155, 'DESCEND'),
    frame(0.47, 'TROUGH', troughA.id, -1050, -1070, 175, 47, 150, 'TROUGH'),
    frame(0.59, 'TROUGH', troughA.id, 820, -1010, 165, 47, 145, 'TROUGH'),
    frame(0.68, 'CLIMB', dividingRange.id, 1390, -770, 240, 49, 165, 'CLIMB'),
    frame(0.76, 'CREST', dividingRange.id, 1510, -510, 390, 52, 215, 'CREST'),
    frame(0.84, 'REVEAL', troughB.id, 1460, -260, 470, 56, 255, 'REVEAL'),
    frame(0.92, 'DESCEND', troughB.id, 1190, -20, 245, 51, 160, 'DESCEND'),
    frame(1.00, 'TROUGH', troughB.id, 720, 150, 180, 48, 155, 'SECOND_TROUGH'),
  ];

  for (const keyframe of keyframes) {
    keyframe.position.y += sampleHeightAt(keyframe.position.x, keyframe.position.z);
  }

  const journey = {
    schema: 'transcendence-journey-v2-camera-correction',
    deterministic: true,
    landmarkIds: [rangeA.id, peakA.id, troughA.id, dividingRange.id, troughB.id],
    sequence: ['AERIAL_OVERVIEW', 'APPROACH', 'PEAK_TRAVERSE', 'DESCENT', 'TROUGH', 'ASCENT', 'CREST', 'REVEAL', 'SECOND_TROUGH'],
    keyframes,
  };
  journey.samples = buildDenseSamples(journey, sampleHeightAt);
  return journey;
}

export function sampleGeographicJourney(journey, progress) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const scaled = p * (journey.samples.length - 1);
  const index = Math.min(Math.floor(scaled), journey.samples.length - 2);
  const local = scaled - index;
  const from = journey.samples[index];
  const to = journey.samples[index + 1];
  return {
    state: local < 0.5 ? from.state : to.state,
    chapter: local < 0.5 ? from.chapter : to.chapter,
    landmarkId: local < 0.5 ? from.landmarkId : to.landmarkId,
    position: pointVector(from.position).lerp(pointVector(to.position), local),
    target: pointVector(from.target).lerp(pointVector(to.target), local),
    fov: THREE.MathUtils.lerp(from.fov, to.fov, local),
    clearance: THREE.MathUtils.lerp(from.clearance, to.clearance, local),
    routeSpeed: THREE.MathUtils.lerp(from.routeSpeed, to.routeSpeed, local),
  };
}

function buildDenseSamples(journey, sampleHeightAt) {
  const anchors = journey.keyframes;
  const route = new THREE.CatmullRomCurve3(anchors.map((anchor) => pointVector(anchor.position)), false, 'centripetal', 0.35);
  const rawPosition = (progress) => {
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    const curvePoint = route.getPoint(p);
    const segment = segmentAt(anchors, p);
    const altitude = THREE.MathUtils.lerp(
      altitudeAboveTerrain(segment.from, sampleHeightAt),
      altitudeAboveTerrain(segment.to, sampleHeightAt),
      smootherstep(segment.local),
    );
    curvePoint.y = sampleHeightAt(curvePoint.x, curvePoint.z) + altitude;
    return curvePoint;
  };

  return Array.from({ length: DENSE_SAMPLE_COUNT + 1 }, (_, index) => {
    const progress = index / DENSE_SAMPLE_COUNT;
    const segment = segmentAt(anchors, progress);
    const position = rawPosition(progress);
    const before = rawPosition(Math.max(0, progress - 1 / DENSE_SAMPLE_COUNT));
    const after = rawPosition(Math.min(1, progress + 1 / DENSE_SAMPLE_COUNT));
    const routeSpeed = before.distanceTo(after) * DENSE_SAMPLE_COUNT * 0.5;
    const speedFactor = THREE.MathUtils.clamp((routeSpeed - 2500) / 8500, 0, 1);
    const baseLookAhead = THREE.MathUtils.lerp(0.052, 0.092, speedFactor);
    const revealAnticipation = smootherstep(THREE.MathUtils.clamp((progress - 0.60) / 0.18, 0, 1)) * 0.055;
    const lookAheadProgress = baseLookAhead + revealAnticipation;
    const future = rawPosition(Math.min(1, progress + lookAheadProgress));
    const direction = future.clone().sub(position).setY(0);
    if (direction.lengthSq() < 0.001) direction.copy(after).sub(before).setY(0);
    direction.normalize();
    const stage = semanticAt(anchors, progress);
    if (progress > 0.80) {
      const troughHeading = new THREE.Vector3(-0.99, 0, -0.06).normalize();
      direction.lerp(troughHeading, smootherstep(THREE.MathUtils.clamp((progress - 0.80) / 0.17, 0, 1))).normalize();
    }
    const lookDistance = lookDistanceFor(stage.state, speedFactor);
    const target = position.clone().addScaledVector(direction, lookDistance);
    target.y = gazeHeightFor(stage, position, target, lookDistance, sampleHeightAt);

    return {
      at: round(progress, 6),
      state: stage.state,
      chapter: stage.chapter,
      landmarkId: stage.landmarkId,
      position: plainPoint(position),
      target: plainPoint(target),
      fov: round(THREE.MathUtils.lerp(segment.from.fov, segment.to.fov, smootherstep(segment.local)), 3),
      clearance: round(THREE.MathUtils.lerp(segment.from.clearance, segment.to.clearance, segment.local), 3),
      routeSpeed: round(routeSpeed, 3),
    };
  });
}

function gazeHeightFor(stage, position, target, distance, sampleHeightAt) {
  const terrainAhead = sampleHeightAt(target.x, target.z);
  if (stage.state === 'AERIAL') return terrainAhead + 180;
  if (stage.state === 'APPROACH') return Math.max(terrainAhead + 170, position.y - distance * Math.tan(THREE.MathUtils.degToRad(10)));
  if (stage.state === 'PEAK') return Math.max(terrainAhead + 150, position.y - distance * Math.tan(THREE.MathUtils.degToRad(5)));
  if (stage.state === 'DESCEND') {
    const pitch = THREE.MathUtils.lerp(-7, -1.5, smootherstep(stage.local));
    return Math.max(terrainAhead + 125, position.y + distance * Math.tan(THREE.MathUtils.degToRad(pitch)));
  }
  if (stage.state === 'TROUGH') return Math.max(terrainAhead + 135, position.y + 8);
  if (stage.state === 'CLIMB') return Math.max(terrainAhead + 135, position.y + 18);
  if (stage.state === 'CREST') return Math.max(terrainAhead + 125, position.y - 12);
  if (stage.state === 'REVEAL') {
    const settle = smootherstep(THREE.MathUtils.clamp((stage.local - 0.46) / 0.54, 0, 1));
    const horizon = position.y - 8;
    const valley = Math.max(terrainAhead + 130, position.y - distance * Math.tan(THREE.MathUtils.degToRad(4.5)));
    return THREE.MathUtils.lerp(horizon, valley, settle);
  }
  return Math.max(terrainAhead + 130, position.y + 6);
}

function lookDistanceFor(state, speedFactor) {
  const base = {
    AERIAL: 2800,
    APPROACH: 2600,
    PEAK: 1700,
    DESCEND: 2000,
    TROUGH: 2350,
    CLIMB: 1850,
    CREST: 2450,
    REVEAL: 2550,
  }[state] || 2200;
  return base * THREE.MathUtils.lerp(0.92, 1.22, speedFactor);
}

function segmentAt(anchors, progress) {
  let index = anchors.findIndex((anchor) => anchor.at >= progress);
  if (index <= 0) return { from: anchors[0], to: anchors[1], local: 0 };
  if (index < 0) index = anchors.length - 1;
  const from = anchors[index - 1];
  const to = anchors[index];
  return { from, to, local: THREE.MathUtils.clamp((progress - from.at) / Math.max(to.at - from.at, 0.0001), 0, 1) };
}

function semanticAt(anchors, progress) {
  let anchorIndex = 0;
  for (let index = 1; index < anchors.length; index += 1) {
    const transition = (anchors[index - 1].at + anchors[index].at) * 0.5;
    if (progress >= transition) anchorIndex = index;
  }
  const anchor = anchors[anchorIndex];
  const start = anchorIndex === 0 ? 0 : (anchors[anchorIndex - 1].at + anchor.at) * 0.5;
  const end = anchorIndex === anchors.length - 1 ? 1 : (anchor.at + anchors[anchorIndex + 1].at) * 0.5;
  return {
    state: anchor.state,
    chapter: anchor.chapter,
    landmarkId: anchor.landmarkId,
    local: THREE.MathUtils.clamp((progress - start) / Math.max(end - start, 0.0001), 0, 1),
  };
}

function altitudeAboveTerrain(anchor, sampleHeightAt) {
  return anchor.position.y - sampleHeightAt(anchor.position.x, anchor.position.z);
}

function frame(at, state, landmarkId, x, z, height, fov, clearance, chapter = state) {
  return { at, state, chapter, landmarkId, position: { x, y: height, z }, fov, clearance };
}

function pointVector(point) {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function plainPoint(point) {
  return { x: round(point.x, 3), y: round(point.y, 3), z: round(point.z, 3) };
}

function smootherstep(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function nearestLandmark(landmarks, position) {
  return [...landmarks].sort((first, second) => {
    const a = Math.hypot(first.position.x - position.x, first.position.z - position.z);
    const b = Math.hypot(second.position.x - position.x, second.position.z - position.z);
    return a - b;
  })[0];
}

function round(value, precision) {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}
