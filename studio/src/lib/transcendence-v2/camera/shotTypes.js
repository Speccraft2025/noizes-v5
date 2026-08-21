import * as THREE from 'three';

export const V2_SHOTS = [
  {
    id: 'aerial',
    label: 'AERIAL',
    note: 'Many peaks, several troughs, and connected ranges with terrain filling almost the entire frame.',
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: 34,
  },
  {
    id: 'trough',
    label: 'TROUGH',
    note: 'Low flight in an open trough with high enclosing relief, sky visible above, and no trench-like corridor.',
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: 42,
  },
  {
    id: 'crest',
    label: 'CREST',
    note: 'A summit crossing that reveals a second large valley beyond the foreground ridge.',
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: 36,
  },
];
