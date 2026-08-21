import * as THREE from 'three';

export function buildSky() {
  const geometry = new THREE.SphereGeometry(7800, 48, 48);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color('#14271a') },
      midColor: { value: new THREE.Color('#294b2b') },
      glowColor: { value: new THREE.Color('#c7a65a') },
      bottomColor: { value: new THREE.Color('#090d0a') },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 glowColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;

      void main() {
        float h = normalize(vWorldPosition - cameraPosition).y * 0.5 + 0.5;
        float glow = smoothstep(0.18, 0.5, h) * (1.0 - smoothstep(0.54, 0.92, h));
        vec3 color = mix(bottomColor, midColor, smoothstep(0.0, 0.34, h));
        color = mix(color, topColor, smoothstep(0.36, 1.0, h));
        color += glowColor * glow * 0.12;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geometry, material);
}

export function buildGlowPlane() {
  const geometry = new THREE.PlaneGeometry(360, 360, 1, 1);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      colorA: { value: new THREE.Color('#c7a65a') },
      colorB: { value: new THREE.Color('#6f8735') },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 colorA;
      uniform vec3 colorB;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv - 0.5;
        float radial = 1.0 - smoothstep(0.0, 0.72, length(uv));
        float core = 1.0 - smoothstep(0.0, 0.24, length(uv));
        vec3 color = mix(colorB, colorA, core);
        gl_FragColor = vec4(color, radial * 0.32);
      }
    `,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(30, 150, -980);
  return mesh;
}

export function buildStars() {
  const geometry = new THREE.BufferGeometry();
  const count = 600;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const radius = 1300 + Math.random() * 700;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.3;
    const x = Math.cos(theta) * Math.sin(phi) * radius;
    const y = Math.cos(phi) * radius + 320;
    const z = Math.sin(theta) * Math.sin(phi) * radius;
    positions.set([x, y, z], index * 3);
    const tone = 0.44 + Math.random() * 0.26;
    colors.set([tone, tone * 0.98, tone * 0.9], index * 3);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 1.5,
      transparent: true,
      opacity: 0.22,
      sizeAttenuation: true,
      vertexColors: true,
    }),
  );
}
