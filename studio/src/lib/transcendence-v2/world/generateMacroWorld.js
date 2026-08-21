import * as THREE from 'three';

export function generateMacroWorld({ seed = 0, spectralProfile = {} } = {}) {
  const articulation = clamp(Number(spectralProfile.articulation) || 1, 0.72, 1.35);
  const detail = clamp(Number(spectralProfile.detail) || 1, 0.65, 1.4);
  return {
    schema: 'transcendence-world-v2',
    seed: seed >>> 0,
    spectralProfile: { articulation, detail },
    noiseOffsetX: ((seed >>> 0) % 8191) * 0.013,
    noiseOffsetZ: (((seed >>> 0) >>> 8) % 8191) * 0.017,
    width: 14000,
    depth: 12000,
    segmentsX: 480,
    segmentsZ: 420,
    baseHeight: 120,
    macroScale: 0.00042,
    macroAmplitude: 82,
    continentScale: 0.0007,
    continentAmplitude: 46,
    mesoScale: 0.0017,
    mesoAmplitude: 28 * articulation,
    microScale: 0.009,
    microAmplitude: 12 * detail,
    edgeLift: 220,
    ranges: [
      { x: -360, z: -1600, dirX: 0.99, dirZ: 0.12, length: 4700, width: 540, height: 420, spineScale: 0.0019, crossScale: 0.0036, warpScale: 0.0014, seed: 4.2 },
      { x: 80, z: -500, dirX: 0.98, dirZ: -0.18, length: 5100, width: 640, height: 520, spineScale: 0.0017, crossScale: 0.0033, warpScale: 0.0013, seed: 8.7 },
      { x: -120, z: 720, dirX: 0.99, dirZ: 0.1, length: 5200, width: 580, height: 460, spineScale: 0.0018, crossScale: 0.0035, warpScale: 0.0014, seed: 15.3 },
      { x: 260, z: 1800, dirX: 0.98, dirZ: -0.2, length: 4600, width: 520, height: 370, spineScale: 0.002, crossScale: 0.0038, warpScale: 0.0015, seed: 22.6 },
    ],
    massifs: [
      { x: -1480, z: -1740, radiusX: 520, radiusZ: 380, height: 230, scale: 0.0042, seed: 2.1 },
      { x: 760, z: -1510, radiusX: 500, radiusZ: 390, height: 210, scale: 0.0044, seed: 5.8 },
      { x: -980, z: -420, radiusX: 540, radiusZ: 420, height: 290, scale: 0.004, seed: 9.2 },
      { x: 820, z: -600, radiusX: 520, radiusZ: 400, height: 270, scale: 0.0041, seed: 13.6 },
      { x: -1240, z: 650, radiusX: 560, radiusZ: 410, height: 250, scale: 0.0042, seed: 18.3 },
      { x: 420, z: 780, radiusX: 540, radiusZ: 420, height: 300, scale: 0.0039, seed: 21.7 },
      { x: 1540, z: 860, radiusX: 500, radiusZ: 380, height: 220, scale: 0.0044, seed: 24.9 },
      { x: 920, z: 1740, radiusX: 540, radiusZ: 400, height: 210, scale: 0.0043, seed: 27.1 },
    ],
    troughs: [
      { x: -80, z: -1060, dirX: 0.99, dirZ: -0.08, length: 4700, width: 700, depth: 480, floorScale: 0.0015, shelfScale: 0.0028, seed: 6.4 },
      { x: 0, z: 100, dirX: 0.99, dirZ: 0.06, length: 5000, width: 840, depth: 600, floorScale: 0.0014, shelfScale: 0.0026, seed: 14.8 },
      { x: 180, z: 1320, dirX: 0.98, dirZ: -0.16, length: 4600, width: 740, depth: 520, floorScale: 0.0016, shelfScale: 0.0029, seed: 24.5 },
    ],
    basins: [
      { x: -1080, z: -1020, radiusX: 720, radiusZ: 500, depth: 130, scale: 0.0028, seed: 11.5 },
      { x: 860, z: 160, radiusX: 760, radiusZ: 560, depth: 150, scale: 0.0027, seed: 17.8 },
      { x: -620, z: 1370, radiusX: 700, radiusZ: 520, depth: 120, scale: 0.003, seed: 26.2 },
    ],
    shots: {
      aerial: {
        position: new THREE.Vector3(-120, 0, 1200),
        target: new THREE.Vector3(100, 0, 40),
        fov: 62,
      },
      trough: {
        position: new THREE.Vector3(-1200, 0, 1540),
        target: new THREE.Vector3(1040, 0, 1180),
        fov: 47,
      },
      crest: {
        position: new THREE.Vector3(0, 0, 540),
        target: new THREE.Vector3(0, 0, 1510),
        fov: 52,
      },
    },
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
