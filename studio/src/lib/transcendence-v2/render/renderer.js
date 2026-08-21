import * as THREE from 'three';
import { generateMacroWorld } from '../world/generateMacroWorld.js';
import { buildContinuousTerrain } from '../world/buildTerrainMesh.js';
import { extractGeographicHierarchy } from '../world/extractGeographicHierarchy.js';
import { buildLighting } from './lighting.js';
import { buildGlowPlane, buildSky, buildStars } from './atmosphere.js';

export function createRenderer(canvasHost, options = {}) {
  const isMobile = window.innerWidth < 768;
  const quality = qualitySettings(options.qualityProfile, isMobile);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, quality.pixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14271a);
  scene.fog = new THREE.FogExp2(0x102318, 0.00022);

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 16000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(canvasHost.clientWidth, canvasHost.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  canvasHost.appendChild(renderer.domElement);

  const world = new THREE.Group();
  scene.add(world);

  for (const light of buildLighting({ isMobile })) scene.add(light);

  const macro = options.worldData || generateMacroWorld();
  const geography = options.geography || extractGeographicHierarchy(macro);
  const terrainWorld = quality.segmentScale === 1 ? macro : {
    ...macro,
    segmentsX: Math.round(macro.segmentsX * quality.segmentScale),
    segmentsZ: Math.round(macro.segmentsZ * quality.segmentScale),
  };
  const terrain = buildContinuousTerrain(terrainWorld);
  world.add(terrain.mesh);

  const sky = buildSky();
  const stars = buildStars();
  const glow = buildGlowPlane();
  scene.add(stars);
  scene.add(glow);

  return {
    THREE,
    scene,
    camera,
    renderer,
    sky,
    stars,
    glow,
    terrain,
    geography,
    worldData: macro,
    resize() {
      const width = canvasHost.clientWidth;
      const height = canvasHost.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    },
    render() {
      renderer.render(scene, camera);
    },
    setDirection({ exposure = 1, atmosphere = 1 } = {}) {
      renderer.toneMappingExposure = 1.5 * exposure;
      scene.fog.density = 0.00022 * atmosphere;
    },
    dispose() {
      renderer.dispose();
      sky.geometry.dispose();
      sky.material.dispose();
      stars.geometry.dispose();
      stars.material.dispose();
      glow.geometry.dispose();
      glow.material.dispose();
      terrain.mesh.geometry.dispose();
      terrain.mesh.material.dispose();
    },
  };
}

function qualitySettings(profile = 'balanced', isMobile = false) {
  const settings = {
    cinematic: { pixelRatio: 1.85, segmentScale: 1, shadows: true },
    balanced: { pixelRatio: 1.6, segmentScale: 0.82, shadows: true },
    lite: { pixelRatio: 1.15, segmentScale: 0.62, shadows: false },
    essential: { pixelRatio: 0.9, segmentScale: 0.44, shadows: false },
  }[profile] || { pixelRatio: 1.6, segmentScale: 0.82, shadows: true };
  return isMobile ? { ...settings, pixelRatio: Math.min(settings.pixelRatio, 1.2) } : settings;
}
