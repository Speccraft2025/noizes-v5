<script>
  import { onMount } from 'svelte';
  import { introDone } from '$lib/stores/landing';

  let container;

  onMount(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import('three');
      if (disposed) return;

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const isCoarse = window.matchMedia('(pointer: coarse)').matches;

      // the ENTER gate flips this — until then the orb holds at scale 0
      let started = false;
      const unsubIntro = introDone.subscribe((v) => { started = v; });

      // ── The orb's journey down the page. t = scroll progress 0→1.
      //    hero: centered behind the headline · timeline: docks right ·
      //    split: docks left · closing: pushes in to fill the frame.
      //    Keyframe t values are anchored to the real [data-orb] sections so
      //    the beats stay in sync with the page's actual heights.
      let ORB_PATH = [];
      function buildPath() {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const vh = window.innerHeight;
        const tFor = (name, fallback) => {
          const el = document.querySelector(`[data-orb="${name}"]`);
          if (!el || max <= 0) return fallback;
          const r = el.getBoundingClientRect();
          const center = r.top + window.scrollY + r.height / 2 - vh / 2;
          return Math.min(Math.max(center / max, 0.05), 0.97);
        };
        const tTimeline = tFor('timeline', 0.35);
        const tSplit = tFor('split', 0.6);
        const tClosing = tFor('closing', 0.9);
        ORB_PATH = [
          { t: 0.0, position: [0, 0.35, 0], scale: 1.35 },
          { t: Math.min(tTimeline * 0.4, 0.15), position: [0, 0.3, 0], scale: 1.25 },
          { t: tTimeline, position: [2.3, -0.1, 0], scale: 0.85 },
          { t: tSplit, position: [-2.3, -0.3, 0], scale: 0.7 },
          { t: tClosing, position: [0, 0.05, 1.6], scale: 2.1 },
          { t: 1.0, position: [0, -0.05, 2.0], scale: 2.4 },
        ].sort((a, b) => a.t - b.t);
      }

      function evaluateOrbPath(progress) {
        const p = Math.min(Math.max(progress, 0), 1);
        let a = ORB_PATH[0];
        let b = ORB_PATH[ORB_PATH.length - 1];
        for (let i = 0; i < ORB_PATH.length - 1; i++) {
          if (p >= ORB_PATH[i].t && p <= ORB_PATH[i + 1].t) {
            a = ORB_PATH[i];
            b = ORB_PATH[i + 1];
            break;
          }
        }
        const span = b.t - a.t || 1;
        const lt = Math.min(Math.max((p - a.t) / span, 0), 1);
        const e = lt * lt * (3 - 2 * lt);
        return {
          x: a.position[0] + (b.position[0] - a.position[0]) * e,
          y: a.position[1] + (b.position[1] - a.position[1]) * e,
          z: a.position[2] + (b.position[2] - a.position[2]) * e,
          scale: a.scale + (b.scale - a.scale) * e,
        };
      }

      const damp = (current, target, lambda, dt) =>
        current + (target - current) * (1 - Math.exp(-lambda * dt));

      // ── Renderer / scene / camera
      const renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarse ? 1 : 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#030304');

      const camera = new THREE.PerspectiveCamera(
        45, window.innerWidth / window.innerHeight, 0.1, 60
      );
      camera.position.set(0, 0, 6);

      scene.add(new THREE.AmbientLight(0xffffff, 0.3));
      const dirLight = new THREE.DirectionalLight('#e6e0ff', 0.4);
      dirLight.position.set(4, 6, 4);
      scene.add(dirLight);

      // ── Simplex/fbm GLSL (Ashima Arts, MIT), shared by the shell shader
      const noiseGLSL = `
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        float snoise(vec3 v) {
          const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0) * 2.0 + 1.0;
          vec4 s1 = floor(b1) * 2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
        }
        float fbm(vec3 p, int octaves) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < 6; i++) {
            if (i >= octaves) break;
            value += amplitude * snoise(p);
            p *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }
      `;

      // ── The Noizes object: fresnel shell, deep violet core → spectral rim
      const shellMaterial = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uCoreColor: { value: new THREE.Color('#1a1245') },
          uRimColor: { value: new THREE.Color('#7B5CF0') },
          uAccentColor: { value: new THREE.Color('#F04BD8') },
          uFresnelPower: { value: 2.2 },
          uOpacity: { value: 0.7 },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewDir = normalize(-mvPosition.xyz);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uCoreColor;
          uniform vec3 uRimColor;
          uniform vec3 uAccentColor;
          uniform float uFresnelPower;
          uniform float uOpacity;
          varying vec3 vNormal;
          varying vec3 vViewDir;
          ${noiseGLSL}
          void main() {
            float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), uFresnelPower);
            float breathe = 0.5 + 0.5 * sin(uTime * 0.3);
            float warp = fbm(vNormal * 2.0 + uTime * 0.05, 3) * 0.15;
            vec3 rim = mix(uRimColor, uAccentColor, 0.35 + 0.35 * sin(uTime * 0.18 + vNormal.y * 2.0));
            vec3 color = mix(uCoreColor, rim, clamp(fresnel + warp, 0.0, 1.0));
            color += rim * fresnel * 0.3 * breathe;
            float alpha = clamp(fresnel * 1.1 + 0.05, 0.0, uOpacity);
            gl_FragColor = vec4(color, alpha);
          }
        `,
      });

      const orb = new THREE.Group();
      scene.add(orb);

      const RADIUS = 1;
      const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(RADIUS, 4), shellMaterial);
      orb.add(shell);

      const coreMaterial = new THREE.MeshBasicMaterial({
        color: '#B29CFF', toneMapped: false, transparent: true, opacity: 1,
      });
      const core = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), coreMaterial);
      orb.add(core);

      // ── Lightning filaments: center → shell, noise-jittered every frame
      const BOLT_COUNT = isCoarse ? 9 : 14;
      const SEGMENTS = 7;
      const bolts = Array.from({ length: BOLT_COUNT }, () => {
        const target = new THREE.Vector3(
          Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1
        ).normalize().multiplyScalar(RADIUS * 0.94);
        return { target, seed: Math.random() * 100, speed: 0.6 + Math.random() * 0.8 };
      });

      const lines = bolts.map(() => {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 3), 3));
        const line = new THREE.Line(
          geom,
          new THREE.LineBasicMaterial({ color: '#cfd8ff', transparent: true, opacity: 0.85 })
        );
        orb.add(line);
        return line;
      });

      const sparks = new THREE.InstancedMesh(
        new THREE.SphereGeometry(1, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#F04BD8', toneMapped: false }),
        BOLT_COUNT
      );
      orb.add(sparks);

      const orbLight = new THREE.PointLight('#7B5CF0', 2.2, 4);
      orb.add(orbLight);

      // ── Sparse ambient dust
      const DUST_COUNT = isCoarse ? 150 : 400;
      const dustPositions = new Float32Array(DUST_COUNT * 3);
      for (let i = 0; i < DUST_COUNT; i++) {
        dustPositions[i * 3] = (Math.random() - 0.5) * 14;
        dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 10;
        dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
      }
      const dustGeom = new THREE.BufferGeometry();
      dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
      const dust = new THREE.Points(
        dustGeom,
        new THREE.PointsMaterial({
          color: '#9d8cf5', size: 0.02, transparent: true, opacity: 0.45,
          blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
        })
      );
      scene.add(dust);

      // ── 3D format icons, pinned to the timeline's [data-icon3d] anchors.
      //    They live in the same canvas as the orb: each frame the anchor's
      //    screen rect is projected onto the z=ICON_Z plane so the icon stays
      //    glued to its DOM slot (and inherits the item's reveal slide).
      scene.add(new THREE.HemisphereLight('#8f7bff', '#050508', 0.9));
      const iconKey = new THREE.DirectionalLight('#f0ecff', 1.4);
      iconKey.position.set(2, 2.5, 5);
      scene.add(iconKey);
      const iconFill = new THREE.DirectionalLight('#7B5CF0', 0.5);
      iconFill.position.set(-3, -1, 4);
      scene.add(iconFill);
      const ICON_Z = 2.5;

      function makeIcon(type) {
        const tilt = new THREE.Group();
        const spin = new THREE.Group();
        tilt.add(spin);
        let update = null;

        if (type === 'vinyl') {
          // black record at a ¾ lean: glossy disc, groove rings, violet label
          const disc = new THREE.Mesh(
            new THREE.CylinderGeometry(1, 1, 0.045, 64),
            new THREE.MeshPhysicalMaterial({
              color: '#0c0c10', metalness: 0.5, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.25,
            })
          );
          const grooveMat = new THREE.MeshBasicMaterial({ color: '#2c2c36' });
          [0.52, 0.64, 0.76, 0.88].forEach((r) => {
            const groove = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0035, 6, 96), grooveMat);
            groove.rotation.x = Math.PI / 2;
            groove.position.y = 0.024;
            spin.add(groove);
          });
          const label = new THREE.Mesh(
            new THREE.CylinderGeometry(0.34, 0.34, 0.05, 48),
            new THREE.MeshStandardMaterial({ color: '#7B5CF0', roughness: 0.55, emissive: '#1c1050' })
          );
          const labelRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.24, 0.004, 6, 48),
            new THREE.MeshBasicMaterial({ color: '#cfc3ff' })
          );
          labelRing.rotation.x = Math.PI / 2;
          labelRing.position.y = 0.027;
          const hole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.045, 0.052, 24),
            new THREE.MeshBasicMaterial({ color: '#030304' })
          );
          spin.add(disc, label, labelRing, hole);
          tilt.rotation.set(0.95, 0, -0.16);
          update = (dt) => { spin.rotation.y += dt * 0.8; };
        } else if (type === 'cassette') {
          // classic compact cassette: dark shell, cream label, tape spools, screws
          const shellMat = new THREE.MeshPhysicalMaterial({
            color: '#232134', roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.3,
          });
          const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.08, 0.2), shellMat);
          const label = new THREE.Mesh(
            new THREE.BoxGeometry(1.44, 0.62, 0.02),
            new THREE.MeshStandardMaterial({ color: '#ece9f4', roughness: 0.7 })
          );
          label.position.set(0, 0.14, 0.1);
          const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(1.44, 0.14, 0.022),
            new THREE.MeshStandardMaterial({ color: '#7B5CF0', roughness: 0.55, emissive: '#2a1c66' })
          );
          stripe.position.set(0, 0.38, 0.1);
          const win = new THREE.Mesh(
            new THREE.BoxGeometry(0.82, 0.3, 0.024),
            new THREE.MeshPhysicalMaterial({
              color: '#07070b', roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.92,
            })
          );
          win.position.set(0, 0.08, 0.104);
          const spools = [];
          [-0.3, 0.3].forEach((x, i) => {
            const tape = new THREE.Mesh(
              new THREE.CylinderGeometry(i === 0 ? 0.16 : 0.11, i === 0 ? 0.16 : 0.11, 0.06, 32),
              new THREE.MeshStandardMaterial({ color: '#100f16', roughness: 0.4 })
            );
            tape.rotation.x = Math.PI / 2;
            tape.position.set(x, 0.08, 0.1);
            const hub = new THREE.Mesh(
              new THREE.CylinderGeometry(0.065, 0.065, 0.08, 24),
              new THREE.MeshStandardMaterial({ color: '#f2f0f7', roughness: 0.35 })
            );
            hub.rotation.x = Math.PI / 2;
            hub.position.set(x, 0.08, 0.11);
            spools.push(hub);
            spin.add(tape, hub);
          });
          const base = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.24, 0.21), new THREE.MeshStandardMaterial({
            color: '#232231', roughness: 0.4,
          }));
          base.position.y = -0.36;
          const screwMat = new THREE.MeshStandardMaterial({ color: '#4a4956', metalness: 0.8, roughness: 0.35 });
          [[-0.78, 0.46], [0.78, 0.46], [-0.78, -0.46], [0.78, -0.46]].forEach(([x, y]) => {
            const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 12), screwMat);
            screw.rotation.x = Math.PI / 2;
            screw.position.set(x, y, 0.1);
            spin.add(screw);
          });
          spin.add(body, label, stripe, win, base);
          tilt.rotation.set(-0.16, 0.3, 0.02);
          update = (dt, t) => {
            spin.rotation.y = Math.sin(t * 0.45) * 0.28;
            spools.forEach((h, i) => { h.rotation.y += dt * (i === 0 ? 1.6 : 2.4); });
          };
        } else if (type === 'cd') {
          // iridescent compact disc: physically-based rainbow film + mirror band
          const disc = new THREE.Mesh(
            new THREE.CylinderGeometry(1, 1, 0.03, 64),
            new THREE.MeshPhysicalMaterial({
              color: '#e2e7fa', metalness: 0.85, roughness: 0.16, emissive: '#2a3268',
              clearcoat: 1, clearcoatRoughness: 0.06,
              iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [120, 700],
            })
          );
          // rainbow diffraction hint, readable even at small sizes
          [['#4BC9F0', 0.62], ['#F04BD8', 0.74]].forEach(([c, r]) => {
            const ring = new THREE.Mesh(
              new THREE.TorusGeometry(r, 0.018, 6, 96),
              new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.45 })
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 0.02;
            spin.add(ring);
          });
          const band = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.4, 0.034, 48),
            new THREE.MeshStandardMaterial({ color: '#9aa3c8', metalness: 0.7, roughness: 0.3 })
          );
          const hub = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.2, 0.036, 32),
            new THREE.MeshPhysicalMaterial({
              color: '#dfe3f5', roughness: 0.15, transparent: true, opacity: 0.4, clearcoat: 1,
            })
          );
          const hole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.075, 0.075, 0.04, 24),
            new THREE.MeshBasicMaterial({ color: '#030304' })
          );
          spin.add(disc, band, hub, hole);
          tilt.rotation.set(0.95, 0, 0.16);
          update = (dt) => { spin.rotation.y += dt * 1.2; };
        } else if (type === 'stream') {
          // audio waveform: rounded capsule bars breathing in a violet→magenta sweep
          const colors = ['#4B6BF0', '#7B5CF0', '#9a55ee', '#c94fe4', '#F04BD8'];
          const bars = colors.map((c, i) => {
            const bar = new THREE.Mesh(
              new THREE.CapsuleGeometry(0.1, 0.7, 4, 16),
              new THREE.MeshStandardMaterial({
                color: c, emissive: c, emissiveIntensity: 0.55, roughness: 0.3,
              })
            );
            bar.position.x = -0.56 + i * 0.28;
            spin.add(bar);
            return bar;
          });
          update = (dt, t) => {
            bars.forEach((b, i) => {
              b.scale.y = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.1 + i * 1.25));
            });
            spin.rotation.y = Math.sin(t * 0.4) * 0.3;
          };
        } else {
          // 'noizes' — a living miniature of the hero object itself
          const shellMini = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), shellMaterial);
          const coreMini = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 12, 12),
            new THREE.MeshBasicMaterial({ color: '#B29CFF', toneMapped: false })
          );
          const sparkMat = new THREE.MeshBasicMaterial({ color: '#F04BD8', toneMapped: false });
          const sparks = [0, 1, 2].map((i) => {
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), sparkMat);
            const a = (i / 3) * Math.PI * 2;
            s.position.set(Math.cos(a) * 0.85, Math.sin(a * 1.3) * 0.6, Math.sin(a) * 0.5);
            spin.add(s);
            return s;
          });
          spin.add(shellMini, coreMini);
          update = (dt, t) => {
            spin.rotation.y += dt * 0.5;
            coreMini.scale.setScalar(1 + Math.sin(t * 1.6) * 0.15);
            sparks.forEach((s, i) => s.scale.setScalar(0.7 + 0.5 * Math.sin(t * 2.4 + i * 2)));
          };
        }
        return { tilt, update };
      }

      const icons = Array.from(document.querySelectorAll('[data-icon3d]')).map((el) => {
        const { tilt, update } = makeIcon(el.dataset.icon3d);
        const group = new THREE.Group();
        group.add(tilt);
        group.visible = false;
        scene.add(group);
        return { el, group, update };
      });

      const projVec = new THREE.Vector3();
      function placeIcon(icon, dt, t) {
        const rect = icon.el.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > window.innerHeight + 100) {
          icon.group.visible = false;
          return;
        }
        icon.group.visible = true;
        projVec.set(
          ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1,
          -(((rect.top + rect.height / 2) / window.innerHeight) * 2 - 1),
          0.5
        ).unproject(camera);
        projVec.sub(camera.position).normalize();
        const dist = (ICON_Z - camera.position.z) / projVec.z;
        icon.group.position.copy(camera.position).addScaledVector(projVec, dist);
        // present every icon square-on regardless of where it sits on screen
        icon.group.quaternion.copy(camera.quaternion);
        const worldPerPx =
          (2 * Math.tan((camera.fov * Math.PI) / 360) * (camera.position.z - ICON_Z)) / window.innerHeight;
        // pop in as the anchor enters the viewport, mirroring the DOM reveal
        const reveal = Math.min(Math.max((window.innerHeight * 0.92 - rect.top) / (window.innerHeight * 0.2), 0), 1);
        const e = reveal * reveal * (3 - 2 * reveal);
        icon.group.scale.setScalar(Math.max(rect.height * worldPerPx * 0.66 * (0.4 + 0.6 * e), 0.0001));
        if (icon.update) icon.update(dt, t);
      }

      // ── Scroll + mouse state
      let scrollProgress = 0;
      function onScroll() {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        scrollProgress = max > 0 ? window.scrollY / max : 0;
      }
      buildPath();
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('load', buildPath);
      // fonts/images settling can shift section offsets shortly after mount
      const rebuildTimer = setTimeout(buildPath, 1200);

      const mouse = { x: 0, y: 0 };
      function onMouseMove(e) {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
      }
      if (!isCoarse) window.addEventListener('mousemove', onMouseMove, { passive: true });

      function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        buildPath();
      }
      window.addEventListener('resize', onResize);

      // ── Frame loop
      const currentPos = new THREE.Vector3(0, 0.35, 0);
      let currentScale = 0;
      const dummy = new THREE.Object3D();
      const clock = new THREE.Clock();
      let animId;

      function frame() {
        animId = requestAnimationFrame(frame);
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;

        const target = started
          ? evaluateOrbPath(scrollProgress)
          : { x: 0, y: 0.35, z: 0, scale: 0 };
        // keep side-docked beats on screen for narrow viewports
        const xLimit = Math.tan((camera.fov * Math.PI) / 360) * 6 * camera.aspect * 0.72;
        target.x = Math.min(Math.max(target.x, -xLimit), xLimit);
        const smoothing = reducedMotion ? 14 : 2.6;
        currentPos.x = damp(currentPos.x, target.x, smoothing, dt);
        currentPos.y = damp(currentPos.y, target.y, smoothing, dt);
        currentPos.z = damp(currentPos.z, target.z, smoothing, dt);
        currentScale = damp(currentScale, target.scale, smoothing, dt);

        orb.position.copy(currentPos);
        orb.scale.setScalar(currentScale);
        if (!reducedMotion) {
          orb.rotation.y += dt * 0.05;
          orb.rotation.x = Math.sin(t * 0.08) * 0.08;
        }

        shellMaterial.uniforms.uTime.value = t;
        // the shell thins out as it grows so the close-up stays translucent
        const growth = Math.min(Math.max((currentScale - 1.5) / 1.0, 0), 1);
        shellMaterial.uniforms.uOpacity.value = 0.7 - 0.35 * growth;

        if (!reducedMotion) {
          for (let i = 0; i < lines.length; i++) {
            const bolt = bolts[i];
            const attr = lines[i].geometry.attributes.position;
            for (let s = 0; s <= SEGMENTS; s++) {
              const f = s / SEGMENTS;
              const falloff = 1 - Math.abs(f - 0.5) * 1.4;
              const jitter = Math.sin(t * bolt.speed * 3 + bolt.seed + s * 2.1) * 0.05 * falloff;
              attr.array[s * 3] = bolt.target.x * f + jitter;
              attr.array[s * 3 + 1] = bolt.target.y * f +
                Math.cos(t * bolt.speed * 2.4 + bolt.seed + s) * 0.05 * falloff;
              attr.array[s * 3 + 2] = bolt.target.z * f + jitter * 0.6;
            }
            attr.needsUpdate = true;
          }
        }

        for (let i = 0; i < BOLT_COUNT; i++) {
          dummy.position.copy(bolts[i].target);
          const pulse = 0.6 + 0.4 * Math.sin(t * 2 + bolts[i].seed);
          dummy.scale.setScalar(0.035 * pulse);
          dummy.updateMatrix();
          sparks.setMatrixAt(i, dummy.matrix);
        }
        sparks.instanceMatrix.needsUpdate = true;

        // in close-up the core recedes to a faint distant glow behind the text
        core.scale.setScalar(0.14 * (1 - 0.55 * growth) * (1 + Math.sin(t * 1.6) * 0.08));
        coreMaterial.opacity = 1 - 0.75 * growth;

        dust.rotation.y = t * 0.008;

        if (!reducedMotion) {
          camera.position.x = damp(camera.position.x, mouse.x * 0.25, 2, dt);
          camera.position.y = damp(camera.position.y, -mouse.y * 0.18, 2, dt);
          camera.lookAt(0, 0, 0);
        }
        camera.updateMatrixWorld();

        for (const icon of icons) placeIcon(icon, dt, t);

        renderer.render(scene, camera);
      }
      frame();

      cleanup = () => {
        cancelAnimationFrame(animId);
        clearTimeout(rebuildTimer);
        unsubIntro();
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('load', buildPath);
        if (!isCoarse) window.removeEventListener('mousemove', onMouseMove);
        scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  });
</script>

<div
  bind:this={container}
  class="fixed inset-0 pointer-events-none"
  style="z-index: 0;"
></div>
