import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

export function applyTerrainClearance(frame, sampleHeightAt) {
  const position = frame.position.clone();
  const target = frame.target.clone();
  const forward = target.clone().sub(position).setY(0).normalize();
  if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
  const left = new THREE.Vector3().crossVectors(UP, forward).normalize();

  const forwardDistance = Math.max(170, frame.clearance * 1.7);
  const sideDistance = Math.max(115, frame.clearance * 0.85);
  const samples = [
    sampleHeightAt(position.x, position.z) + frame.clearance,
    sampleHeightAt(position.x + forward.x * forwardDistance, position.z + forward.z * forwardDistance) + frame.clearance * 0.82,
    sampleHeightAt(position.x + left.x * sideDistance, position.z + left.z * sideDistance) + frame.clearance * 0.68,
    sampleHeightAt(position.x - left.x * sideDistance, position.z - left.z * sideDistance) + frame.clearance * 0.68,
  ];
  position.y = Math.max(position.y, ...samples);
  target.y = Math.max(target.y, sampleHeightAt(target.x, target.z) + Math.min(105, frame.clearance * 0.55));
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
