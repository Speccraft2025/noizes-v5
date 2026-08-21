import * as THREE from 'three';

export function buildContinuousTerrain(world) {
  const geometry = new THREE.PlaneGeometry(world.width, world.depth, world.segmentsX, world.segmentsZ);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();

  let minHeight = Infinity;
  let maxHeight = -Infinity;

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const y = sampleHeight(world, x, z);
    position.setY(index, y);
    if (y < minHeight) minHeight = y;
    if (y > maxHeight) maxHeight = y;
  }

  geometry.computeVertexNormals();

  const normal = geometry.attributes.normal;
  const sunDir = new THREE.Vector3(-0.68, 0.62, 0.39).normalize();
  const deep = new THREE.Color('#102318');
  const forest = new THREE.Color('#2b4d24');
  const moss = new THREE.Color('#668347');
  const gold = new THREE.Color('#d5b96c');
  const haze = new THREE.Color('#9aa477');

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const ny = normal.getY(index);
    const light = THREE.MathUtils.clamp(
      normal.getX(index) * sunDir.x + ny * sunDir.y + normal.getZ(index) * sunDir.z,
      -1,
      1,
    );
    const slope = 1 - THREE.MathUtils.clamp(ny, 0, 1);
    const heightNorm = THREE.MathUtils.clamp((y - minHeight) / Math.max(maxHeight - minHeight, 1), 0, 1);
    const seam = ridgeNoise(x * 0.0038 + 14.3, z * 0.0032 - 8.1);
    const weathering = valueNoise(x * 0.009 + 3.2, z * 0.009 - 4.5);

    color.copy(deep).lerp(forest, 0.34 + heightNorm * 0.42);
    color.lerp(moss, Math.max(0, light) * 0.3 + (1 - slope) * 0.16);
    color.lerp(haze, Math.max(0, seam - 0.56) * 0.15);
    color.lerp(gold, Math.max(0, light - 0.08) * 0.16 + Math.max(0, weathering - 0.74) * 0.12 + heightNorm * 0.08);

    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.985,
    metalness: 0.0,
    fog: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  return {
    mesh,
    sampleHeightAt: (x, z) => sampleHeight(world, x, z),
  };
}

export function sampleHeight(world, x, z) {
  const u = x / world.width;
  const v = z / world.depth;

  let height = sampleMacroHeight(world, x, z);

  const offsetX = world.noiseOffsetX || 0;
  const offsetZ = world.noiseOffsetZ || 0;
  height += ridgeNoise(x * world.mesoScale + offsetX, z * world.mesoScale + offsetZ) * world.mesoAmplitude;
  height += (fbm(x * world.microScale + offsetX * 2.3, z * world.microScale + offsetZ * 2.3, 3, 0.55, 2.18) - 0.5) * world.microAmplitude;

  const edgeX = Math.abs(u) * 2;
  const edgeZ = Math.abs(v) * 2;
  const edgeFalloff = Math.pow(Math.max(edgeX, edgeZ), 2.6);
  height += edgeFalloff * world.edgeLift;

  return height;
}

export function sampleMacroHeight(world, x, z) {
  let height = world.baseHeight;
  height += fbm(x * world.macroScale, z * world.macroScale, 4, 0.5, 2.02) * world.macroAmplitude;
  height += ridgeNoise(x * world.continentScale, z * world.continentScale) * world.continentAmplitude;

  for (const range of world.ranges) {
    height += rangeField(x, z, range);
  }

  for (const massif of world.massifs) {
    height += massifField(x, z, massif);
  }

  for (const trough of world.troughs) {
    height -= troughField(x, z, trough);
  }

  for (const basin of world.basins) {
    height -= basinField(x, z, basin);
  }

  return height;
}

function rangeField(x, z, range) {
  const dx = x - range.x;
  const dz = z - range.z;
  const axis = dx * range.dirX + dz * range.dirZ;
  const cross = -dx * range.dirZ + dz * range.dirX;
  const span = Math.exp(-(axis * axis) / (2 * range.length * range.length));
  const width = Math.exp(-(cross * cross) / (2 * range.width * range.width));
  const spine = ridgeNoise(axis * range.spineScale + range.seed, cross * range.crossScale - range.seed * 0.31);
  const warp = fbm(dx * range.warpScale, dz * range.warpScale, 3, 0.5, 2.0) - 0.5;
  return span * width * (range.height * (0.62 + spine * 0.58) + warp * range.height * 0.18);
}

function massifField(x, z, massif) {
  const dx = x - massif.x;
  const dz = z - massif.z;
  const radial = Math.sqrt((dx * dx) / (massif.radiusX * massif.radiusX) + (dz * dz) / (massif.radiusZ * massif.radiusZ));
  if (radial >= 1.85) return 0;
  const dome = Math.exp(-radial * radial * 1.6);
  const crown = ridgeNoise(dx * massif.scale + massif.seed, dz * massif.scale - massif.seed * 0.22);
  const shards = ridgeNoise(dx * massif.scale * 1.8 - massif.seed, dz * massif.scale * 1.5 + massif.seed * 0.4);
  return dome * (massif.height * (0.74 + crown * 0.4) + shards * massif.height * 0.18);
}

function troughField(x, z, trough) {
  const dx = x - trough.x;
  const dz = z - trough.z;
  const axis = dx * trough.dirX + dz * trough.dirZ;
  const cross = -dx * trough.dirZ + dz * trough.dirX;
  const span = Math.exp(-(axis * axis) / (2 * trough.length * trough.length));
  const width = Math.exp(-(cross * cross) / (2 * trough.width * trough.width));
  const floor = 0.58 + valueNoise(axis * trough.floorScale + trough.seed, cross * trough.floorScale - trough.seed) * 0.42;
  const shelves = ridgeNoise(axis * trough.shelfScale - trough.seed * 0.14, cross * trough.shelfScale + trough.seed * 0.19);
  return span * width * trough.depth * floor + span * width * shelves * trough.depth * 0.22;
}

function basinField(x, z, basin) {
  const dx = x - basin.x;
  const dz = z - basin.z;
  const radial = Math.sqrt((dx * dx) / (basin.radiusX * basin.radiusX) + (dz * dz) / (basin.radiusZ * basin.radiusZ));
  if (radial >= 1.8) return 0;
  const bowl = Math.exp(-radial * radial * 1.9);
  const undulation = valueNoise(dx * basin.scale + basin.seed, dz * basin.scale - basin.seed);
  return bowl * basin.depth * (0.7 + undulation * 0.3);
}

function fbm(x, y, octaves, gain, lacunarity) {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let total = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    sum += valueNoise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return sum / total;
}

function ridgeNoise(x, y) {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let total = 0;

  for (let octave = 0; octave < 4; octave += 1) {
    const sample = valueNoise(x * frequency, y * frequency);
    const ridge = 1 - Math.abs(sample * 2 - 1);
    sum += ridge * ridge * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.05;
  }

  return sum / total;
}

function valueNoise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const sx = fade(x - x0);
  const sy = fade(y - y0);
  const n00 = hash2(x0, y0);
  const n10 = hash2(x1, y0);
  const n01 = hash2(x0, y1);
  const n11 = hash2(x1, y1);
  const ix0 = THREE.MathUtils.lerp(n00, n10, sx);
  const ix1 = THREE.MathUtils.lerp(n01, n11, sx);
  return THREE.MathUtils.lerp(ix0, ix1, sy);
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

function hash2(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}
