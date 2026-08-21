import * as THREE from 'three';

export function buildLighting({ isMobile }) {
  const lights = [];
  lights.push(new THREE.AmbientLight(0x294f2f, 0.64));
  lights.push(new THREE.HemisphereLight(0x78945a, 0x102318, 1.24));

  const sun = new THREE.DirectionalLight(0xe4c978, 3.25);
  sun.position.set(-900, 1100, 760);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  sun.shadow.camera.near = 40;
  sun.shadow.camera.far = 1400;
  sun.shadow.camera.left = -560;
  sun.shadow.camera.right = 560;
  sun.shadow.camera.top = 460;
  sun.shadow.camera.bottom = -400;
  lights.push(sun);

  const fill = new THREE.DirectionalLight(0x78945a, 1.3);
  fill.position.set(340, 160, -220);
  lights.push(fill);

  const basinGlow = new THREE.PointLight(0xd8b960, 1.45, 2200, 2);
  basinGlow.position.set(40, 120, -760);
  lights.push(basinGlow);

  return lights;
}
