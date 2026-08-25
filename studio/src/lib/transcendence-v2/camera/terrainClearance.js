import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

export function applyTerrainClearance(frame, sampleHeightAt) {
  const position = frame.position.clone();
  const target = frame.target.clone();
  const forward = target.clone().sub(position).setY(0).normalize();
  if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
  const left = new THREE.Vector3().crossVectors(UP, forward).normalize();
  const MIN_CLEARANCE = 55;

  let maxTerrain = sampleHeightAt(position.x, position.z);

  const probeDistances = [60, 140, 250, 400, 600];
  const sideOffsets = [0, -80, 80];
  for (const dist of probeDistances) {
    for (const side of sideOffsets) {
      const px = position.x + forward.x * dist + left.x * side;
      const pz = position.z + forward.z * dist + left.z * side;
      const h = sampleHeightAt(px, pz);
      const fadeOff = 1 - dist / 800;
      if (h + MIN_CLEARANCE * Math.max(0.5, fadeOff) > maxTerrain + MIN_CLEARANCE) {
        maxTerrain = Math.max(maxTerrain, h);
      }
    }
  }

  const behindH = sampleHeightAt(position.x - forward.x * 80, position.z - forward.z * 80);
  maxTerrain = Math.max(maxTerrain, behindH);

  position.y = Math.max(position.y, maxTerrain + MIN_CLEARANCE);

  target.y = Math.max(target.y, sampleHeightAt(target.x, target.z) + MIN_CLEARANCE * 0.6);
  constrainGaze(frame.state, position, target);

  return { ...frame, position, target };
}

function constrainGaze(state, position, target) {
  const horizontalDistance = Math.max(Math.hypot(target.x - position.x, target.z - position.z), 1);
  const limits = {
    DESCEND: [-8, 2],
    TROUGH: [-2.5, 2.5],
    CLIMB: [-3, 4],
    CREST: [-1.5, 1.5],
    REVEAL: [-4.5, 2],
  }[state];
  if (!limits) return;
  const minimum = position.y + horizontalDistance * Math.tan(THREE.MathUtils.degToRad(limits[0]));
  const maximum = position.y + horizontalDistance * Math.tan(THREE.MathUtils.degToRad(limits[1]));
  target.y = THREE.MathUtils.clamp(target.y, minimum, maximum);
}
