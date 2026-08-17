/* WorldRenderer — the Sonic Terrain.
 *
 * The landscape is the recording. `analysis/track-01.terrain.png` holds one
 * texel per (time frame, mel band); the ground mesh is a plain grid whose every
 * vertex height is read from that texture in the vertex shader. There is no
 * authored terrain geometry in this package at all.
 *
 *   forward (−Z)  = time
 *   lateral (X)   = mel frequency, low at the left, high at the right
 *   elevation (Y) = energy
 *
 * Five depth registers are present in every shot: the sky, the far ranges, the
 * mid terraces the flight passes between, near ridge detail, and suspended
 * matter crossing the lens.
 */

const QUALITY_PROFILES = {
  cinematic: {
    label: 'Cinematic', pixelRatio: 1.75,
    gridX: 384, gridZ: 512, viewDistance: 2600, airGrains: 40000, nearGrains: 2200,
    lodEps: 0.55, detailScale: 1.0,
    bloom: true, bloomIterations: 3, dof: 0.75, grain: 0.05,
  },
  balanced: {
    label: 'Balanced', pixelRatio: 1.4,
    gridX: 288, gridZ: 384, viewDistance: 2100, airGrains: 22000, nearGrains: 1400,
    lodEps: 0.8, detailScale: 0.9,
    bloom: true, bloomIterations: 2, dof: 0.6, grain: 0.045,
  },
  lite: {
    label: 'Lite', pixelRatio: 1.0,
    gridX: 176, gridZ: 224, viewDistance: 1500, airGrains: 7000, nearGrains: 500,
    lodEps: 1.4, detailScale: 0.6,
    bloom: false, bloomIterations: 1, dof: 0.0, grain: 0.04,
  },
};

/* Art direction. The creator chooses how the measured landscape is *presented*;
 * they never choose its shape. Nothing here can change the terrain image, so
 * changing the palette or the sun angle never requires re-analysing the
 * recording — which is the whole reason these are separate from the analysis.
 *
 * Defaults are the reference edition's own values, so an object that supplies no
 * art direction is lit and scaled exactly as the reference is.
 */
const ART = Object.assign({
  heightScale: 1,          // multiplies elevation
  ridgeEmphasis: 1,        // multiplies how far harmonics stand out as ridges
  timeScale: 1,            // multiplies world distance per second of recording
  terracing: true,         // contour steps on the lower slopes
  terraceStep: 1.5,        // world units per step
  palette: 'alabaster',
  // These two reproduce the reference edition's sun vector exactly: a broad soft
  // key almost overhead, slightly forward, so the massifs cast relief toward the
  // viewer. A gallery, not a landscape at noon.
  sunElevation: 64.32,     // degrees above the horizon
  sunAzimuth: -146.31,     // degrees, 0 = straight down the time axis
  flightAltitude: 1,       // multiplies every shot's altitude
}, (typeof TX !== 'undefined' && TX.artDirection) || {});

/* Three fixed palettes, not colour pickers. Each is a coherent lighting design —
 * sun, lit ceiling, far wall, floor and fog together — because letting a creator
 * set five colours independently reliably produces a worse world than any of
 * these three. */
const PALETTES = {
  alabaster: { sun: [1.000, 0.925, 0.845], sky: [0.070, 0.068, 0.066], horizon: [0.052, 0.044, 0.038], ground: [0.014, 0.013, 0.014], fogNear: [0.052, 0.046, 0.040], fogFar: [0.034, 0.032, 0.036], horizonGlow: [0.085, 0.065, 0.048] },
  oxide:     { sun: [1.000, 0.842, 0.700], sky: [0.082, 0.058, 0.046], horizon: [0.064, 0.036, 0.026], ground: [0.020, 0.012, 0.009], fogNear: [0.068, 0.042, 0.028], fogFar: [0.038, 0.028, 0.030], horizonGlow: [0.110, 0.058, 0.030] },
  frost:     { sun: [0.878, 0.936, 1.000], sky: [0.058, 0.066, 0.080], horizon: [0.038, 0.046, 0.060], ground: [0.011, 0.013, 0.017], fogNear: [0.040, 0.046, 0.056], fogFar: [0.028, 0.034, 0.050], horizonGlow: [0.055, 0.068, 0.095] },
};

/* World scale. These are the only numbers that convert the recording into
 * geography, and they are declared once so the timeline, the camera, the
 * landmarks and the Essential fallback all agree. */
const TIME_SCALE = 26 * ART.timeScale;      // world units per second of recording
const BAND_WIDTH = 420;                     // world units across the whole frequency axis
let HEIGHT_SCALE = 30 * ART.heightScale;    // world units at full energy in the lowest band

class WorldRenderer {
  constructor(canvas, options) {
    this.T = options.THREE;
    this.canvas = canvas;
    this.analysis = options.analysis;
    this.profileName = options.profile || 'balanced';
    this.profile = QUALITY_PROFILES[this.profileName];
    this.textures = options.textures || {};
    this.reducedMotion = !!options.reducedMotion;
    this.highContrast = !!options.highContrast;
    this.ready = false;
    this.stats = { drawCalls: 0, triangles: 0, points: 0, programs: 0, frameMs: 0, sceneDrawCalls: 0, sceneTriangles: 0 };
  }

  /* ------------------------------------------------------------------ setup */

  init() {
    const T = this.T;
    this.renderer = new T.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,            // the composite pass dithers and grains instead
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      preserveDrawingBuffer: true, // frame capture for the review contact sheet
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputColorSpace = T.LinearSRGBColorSpace;
    this.renderer.info.autoReset = false;

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(46, 1, 0.6, this.profile.viewDistance * 1.7);

    // One motivated source, low and raking, so the ranges cast their length
    // across the world instead of being lit flat from overhead.
    // A gallery, not a landscape at noon: the key is a broad soft source almost
    // overhead through the oculus, slightly forward so the massifs cast their
    // relief toward the viewer.
    const palette = PALETTES[ART.palette] || PALETTES.alabaster;
    const elevation = ART.sunElevation * Math.PI / 180;
    const azimuth = ART.sunAzimuth * Math.PI / 180;
    this.sun = {
      dir: new T.Vector3(
        Math.cos(elevation) * Math.sin(azimuth),
        Math.sin(elevation),
        Math.cos(elevation) * Math.cos(azimuth),
      ).normalize(),
      color: new T.Color(...palette.sun),
    };
    this.sky = new T.Color(...palette.sky);            // the lit ceiling
    this.horizon = new T.Color(...palette.horizon);    // the dark warm wall
    this.ground = new T.Color(...palette.ground);      // the polished floor
    this.fogNear = new T.Color(...palette.fogNear);
    this.fogFar = new T.Color(...palette.fogFar);
    this.horizonGlow = new T.Color(...palette.horizonGlow);

    this.field = {
      uTerrain: { value: this._tex('terrain', { repeat: false }) },
      uTerrainSize: { value: new T.Vector2(this.analysis.frames, 128) },
      uTimeScale: { value: TIME_SCALE },
      uBandWidth: { value: BAND_WIDTH },
      uDuration: { value: this.analysis.duration },
      uHeightScale: { value: HEIGHT_SCALE },
      uHeightGamma: { value: 1.75 },
      uRidgeScale: { value: 3.4 * ART.ridgeEmphasis },
      uDetailScale: { value: this.profile.detailScale * 0.8 },
      uPlayhead: { value: 0 },
      // Contour terracing: the lower slopes are cut into level steps like a
      // topographic model, the summits stay smooth.
      uTerrace: { value: ART.terracing ? 0.85 : 0 },
      uTerraceStep: { value: ART.terraceStep },
      uTerraceFrom: { value: 3.0 },
      uTerraceTo: { value: 26.0 },
      uBaseHeight: { value: 2.2 },
      // Filter footprint for distant cells, in world units.
      uFilterX: { value: 3.6 },
      uFilterZ: { value: 30.0 },
    };
    this.shared = {
      uSunDir: { value: this.sun.dir },
      uSunColor: { value: this.sun.color },
      uSkyColor: { value: this.sky },
      uHorizonColor: { value: this.horizon },
      uHorizonGlow: { value: this.horizonGlow },
      uGroundColor: { value: this.ground },
      uFogNear: { value: this.fogNear },
      uFogFar: { value: this.fogFar },
      uFogDensity: { value: 0.0026 },
      uExposure: { value: 1 },
      uContrast: { value: 1 },
      uSunPower: { value: 1 },
    };

    this._buildSky();
    this._buildPlinth();
    this._buildTerrain();
    this._buildAir();
    this._buildSpecimen();
    this._buildPost();
    this.ready = true;
    return this;
  }

  _tex(name, { repeat = true, nearest = false, srgb = false } = {}) {
    const texture = this.textures[name];
    if (!texture) return null;
    const T = this.T;
    texture.colorSpace = srgb ? T.SRGBColorSpace : T.LinearSRGBColorSpace;
    texture.wrapS = texture.wrapT = repeat ? T.RepeatWrapping : T.ClampToEdgeWrapping;
    texture.minFilter = nearest ? T.NearestFilter : T.LinearFilter;
    texture.magFilter = nearest ? T.NearestFilter : T.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  /* -------------------------------------------------------------------- sky */

  _buildSky() {
    const T = this.T;
    this.skyMaterial = new T.ShaderMaterial({
      vertexShader: GLSL.common + GLSL.skyVertex,
      fragmentShader: GLSL.common + GLSL.skyFragment,
      side: T.BackSide,
      depthWrite: false,
      uniforms: {
        uSkyColor: this.shared.uSkyColor,
        uHorizonColor: this.shared.uHorizonColor,
        uHorizonGlow: this.shared.uHorizonGlow,
        uSunDir: this.shared.uSunDir,
        uSunColor: this.shared.uSunColor,
        uExposure: this.shared.uExposure,
        uContrast: this.shared.uContrast,
        uSunPower: this.shared.uSunPower,
      },
    });
    this.skyDome = new T.Mesh(new T.SphereGeometry(1, 32, 20), this.skyMaterial);
    this.skyDome.frustumCulled = false;
    this.skyDome.renderOrder = -1;
    this.scene.add(this.skyDome);
  }

  /* ---------------------------------------------------------------- plinth */

  /* The floor of the room and the bronze plinth the massif stands on. Without
   * it the terrain is a heightfield; with it, it is an object on exhibition. */
  _buildPlinth() {
    const T = this.T;
    const geometry = new T.PlaneGeometry(BAND_WIDTH * 6, this.profile.viewDistance * 3, 1, 1);
    geometry.rotateX(-Math.PI / 2);
    this.plinthMaterial = new T.ShaderMaterial({
      vertexShader: GLSL.common + GLSL.grooveVertexFallback,
      fragmentShader: GLSL.common + GLSL.plinthFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSunDir: this.shared.uSunDir,
        uSunColor: this.shared.uSunColor,
        uSkyColor: this.shared.uSkyColor,
        uFogNear: this.shared.uFogNear,
        uFogFar: this.shared.uFogFar,
        uFogDensity: this.shared.uFogDensity,
        uExposure: this.shared.uExposure,
        uContrast: this.shared.uContrast,
        uSunPower: this.shared.uSunPower,
        uBandWidthLocal: { value: BAND_WIDTH },
      },
    });
    this.plinth = new T.Mesh(geometry, this.plinthMaterial);
    this.plinth.position.y = -0.6;
    this.plinth.frustumCulled = false;
    this.scene.add(this.plinth);
  }

  /* ----------------------------------------------------------------- ground */

  /* A single grid carried with the camera. Rows are spaced quadratically so
   * detail concentrates near the viewer and one mesh still reaches the horizon
   * — the cheapest honest way to hold 1500 units of landscape at 60 fps. */
  _buildTerrain() {
    const T = this.T;
    const nx = this.profile.gridX, nz = this.profile.gridZ;
    const behind = 260;
    const ahead = this.profile.viewDistance;
    const positions = new Float32Array((nx + 1) * (nz + 1) * 3);
    const lods = new Float32Array((nx + 1) * (nz + 1));
    const indices = [];

    const rowDistance = i => {
      const u = i / nz;
      // The first 16% of rows cover the ground behind the camera; the rest
      // reach forward with quadratic spacing.
      if (u < 0.16) return -behind * (1 - u / 0.16);
      const f = (u - 0.16) / 0.84;
      return f * f * ahead;
    };

    let p = 0, q = 0;
    for (let i = 0; i <= nz; i++) {
      const z = -rowDistance(i);
      // How coarse this row's cells are compared with the finest, expressed
      // 0..1. The shader uses it to widen its taps and drop micro-relief.
      const gap = Math.abs(rowDistance(Math.min(nz, i + 1)) - rowDistance(i));
      const lod = clamp01(Math.pow(gap / 26, 0.65));
      for (let j = 0; j <= nx; j++) {
        positions[p++] = (j / nx - 0.5) * BAND_WIDTH * 1.3;
        positions[p++] = 0;
        positions[p++] = z;
        lods[q++] = lod;
      }
    }
    for (let i = 0; i < nz; i++) {
      for (let j = 0; j < nx; j++) {
        const a = i * (nx + 1) + j, b = a + nx + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
    geometry.setAttribute('aLod', new T.BufferAttribute(lods, 1));
    geometry.setIndex(indices);

    this.terrainMaterial = new T.ShaderMaterial({
      vertexShader: GLSL.common + GLSL.terrainField + GLSL.terrainVertex,
      fragmentShader: GLSL.common + GLSL.terrainField + GLSL.terrainFragment,
      uniforms: {
        ...this.field,
        ...this.shared,
        uGridOrigin: { value: new T.Vector3() },
        uLodEps: { value: this.profile.lodEps },
        uAhead: { value: 0.55 },
      },
    });
    this.terrain = new T.Mesh(geometry, this.terrainMaterial);
    this.terrain.frustumCulled = false;
    this.scene.add(this.terrain);
    this.stats.triangles += indices.length / 3;
  }

  /* ------------------------------------------------------------- atmosphere */

  _makeAir(count, span, size) {
    const T = this.T;
    const seeds = new Float32Array(count * 2);
    const index = new Float32Array(count);
    const random = mulberry32(0xa17 + count);
    for (let i = 0; i < count; i++) {
      seeds[i * 2] = random();
      seeds[i * 2 + 1] = random();
      index[i] = i;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('aSeed', new T.BufferAttribute(seeds, 2));
    geometry.setAttribute('aIndex', new T.BufferAttribute(index, 1));
    geometry.boundingSphere = new T.Sphere(new T.Vector3(), 6000);

    const material = new T.ShaderMaterial({
      vertexShader: GLSL.common + GLSL.airVertex,
      fragmentShader: GLSL.common + GLSL.airFragment,
      transparent: true, depthWrite: false, blending: T.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: size },
        uPixelRatio: { value: 1 },
        uPresence: { value: 0 },
        uLift: { value: 0 },
        uCentre: { value: new T.Vector3() },
        uSpan: { value: new T.Vector3(span[0], span[1], span[2]) },
        uSprite: { value: this._tex('dustGrain', { repeat: false }) },
        uSunColor: this.shared.uSunColor,
        uContrast: this.shared.uContrast,
        uExposure: this.shared.uExposure,
      },
    });
    const points = new T.Points(geometry, material);
    points.frustumCulled = false;
    this.scene.add(points);
    this.stats.points += count;
    return points;
  }

  _buildAir() {
    this.air = this._makeAir(this.profile.airGrains, [BAND_WIDTH * 1.4, 170, 1000], 1.6);
    // The near register: matter crossing the lens, deliberately out of focus.
    this.nearAir = this._makeAir(this.profile.nearGrains, [110, 46, 150], 6.5);
  }

  /* -------------------------------------------------------- lyric landmarks */

  /* Cut into the ridge the voice itself made. The band position is measured at
   * build time — it is the singer's own dominant mel band for that phrase. */
  attachLandmarks(landmarks) {
    const T = this.T;
    this.landmarks = [];
    for (const mark of landmarks) {
      const geometry = new T.PlaneGeometry(1, 1, 128, 10);
      geometry.rotateX(-Math.PI / 2);
      const texture = new T.CanvasTexture(mark.canvas);
      texture.colorSpace = T.LinearSRGBColorSpace;
      texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
      texture.generateMipmaps = false;
      texture.minFilter = texture.magFilter = T.LinearFilter;

      const material = new T.ShaderMaterial({
        vertexShader: GLSL.common + GLSL.terrainField + GLSL.landmarkVertex,
        fragmentShader: GLSL.common + GLSL.landmarkFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          ...this.field,
          uText: { value: texture },
          uAnchor: { value: new T.Vector3(mark.x, 0, mark.z) },
          // (length along time, width across frequency) — the shader reads the line
          // along the flight, so depth is the reading axis.
          uExtent: { value: new T.Vector2(mark.depth, mark.width) },
          uLift: { value: 0.45 },
          uSunDir: this.shared.uSunDir,
          uSunColor: this.shared.uSunColor,
          uFogNear: this.shared.uFogNear,
          uFogFar: this.shared.uFogFar,
          uFogDensity: this.shared.uFogDensity,
          uExposure: this.shared.uExposure,
          uContrast: this.shared.uContrast,
          uReveal: { value: 0 },
        },
      });
      const mesh = new T.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.renderOrder = 2;
      this.scene.add(mesh);
      this.landmarks.push({ mesh, material, mark, texture });
    }
    return this;
  }

  /* --------------------------------------------------------------- specimen */

  _buildSpecimen() {
    const T = this.T;
    const geometry = new T.PlaneGeometry(1, 1, 360, 110);
    geometry.rotateX(-Math.PI / 2);
    this.specimenMaterial = new T.ShaderMaterial({
      vertexShader: GLSL.common + GLSL.terrainField + GLSL.specimenVertex,
      fragmentShader: GLSL.common + GLSL.specimenFragment,
      side: T.DoubleSide,
      uniforms: {
        ...this.field,
        uSpan: { value: 3.4 },
        uRelief: { value: 0.11 },
        uSunDir: this.shared.uSunDir,
        uSunColor: this.shared.uSunColor,
        uSkyColor: this.shared.uSkyColor,
        uExposure: this.shared.uExposure,
        uContrast: this.shared.uContrast,
        uReveal: { value: 0 },
        uPlayheadU: { value: 0 },
      },
    });
    this.specimen = new T.Mesh(geometry, this.specimenMaterial);
    this.specimen.frustumCulled = false;
    this.specimen.visible = false;
    this.scene.add(this.specimen);
  }

  /* ------------------------------------------------------------------- post */

  _buildPost() {
    const T = this.T;
    const makeTarget = depth => {
      const target = new T.WebGLRenderTarget(2, 2, {
        type: T.HalfFloatType,
        minFilter: T.LinearFilter,
        magFilter: T.LinearFilter,
        depthBuffer: true,
        colorSpace: T.LinearSRGBColorSpace,
      });
      if (depth) {
        target.depthTexture = new T.DepthTexture(2, 2);
        target.depthTexture.type = T.UnsignedIntType;
      }
      return target;
    };
    this.sceneTarget = makeTarget(true);
    this.halfA = makeTarget(false);
    this.halfB = makeTarget(false);
    this.blurTarget = makeTarget(false);

    this.quadScene = new T.Scene();
    this.quadCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadGeometry = new T.PlaneGeometry(2, 2);

    const pass = (fragment, uniforms) => new T.ShaderMaterial({
      vertexShader: GLSL.fullscreenVertex,
      fragmentShader: GLSL.common + fragment,
      uniforms, depthTest: false, depthWrite: false,
    });

    this.brightMaterial = pass(GLSL.brightPass, {
      uScene: { value: null }, uThreshold: { value: 0.72 }, uKnee: { value: 0.28 },
    });
    this.blurMaterial = pass(GLSL.blurPass, {
      uSource: { value: null }, uDirection: { value: new T.Vector2() },
    });
    this.compositeMaterial = pass(GLSL.compositePass, {
      uScene: { value: null }, uBloom: { value: null }, uBlur: { value: null },
      uDepth: { value: null }, uNoise: { value: this._tex('blueNoise') },
      uResolution: { value: new T.Vector2(2, 2) },
      uTime: { value: 0 },
      uBloomStrength: { value: 0.4 },
      uExposure: { value: 1 },
      uFocusDistance: { value: 120 }, uFocusRange: { value: 260 }, uDofStrength: { value: this.profile.dof },
      uGrain: { value: this.profile.grain },
      uVignette: { value: 0.34 },
      uNear: { value: 0.6 }, uFar: { value: 2400 },
      uContrast: { value: 1 },
      uHighContrast: { value: this.highContrast ? 1 : 0 },
    });

    this.quad = new T.Mesh(this.quadGeometry, this.compositeMaterial);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  _blit(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target || null);
    this.renderer.clear();
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  /* ----------------------------------------------------------------- resize */

  resize(width, height, pixelRatio) {
    const dpr = Math.min(pixelRatio, this.profile.pixelRatio);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const w = Math.max(2, Math.floor(width * dpr));
    const h = Math.max(2, Math.floor(height * dpr));
    this.sceneTarget.setSize(w, h);
    const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
    this.halfA.setSize(hw, hh);
    this.halfB.setSize(hw, hh);
    this.blurTarget.setSize(hw, hh);
    this.compositeMaterial.uniforms.uResolution.value.set(w, h);
    for (const cloud of [this.air, this.nearAir]) {
      if (cloud) cloud.material.uniforms.uPixelRatio.value = dpr;
    }
    this.viewport = { width: w, height: h, dpr };
  }

  /** World coordinates for a moment and a band of the recording. */
  static zAt(seconds) { return -seconds * TIME_SCALE; }
  static xAtBand(band, bands = 128) { return (band / (bands - 1) - 0.5) * BAND_WIDTH; }
  static get scale() { return { TIME_SCALE, BAND_WIDTH, HEIGHT_SCALE }; }

  static updateArt(patch) {
    if (patch.heightScale !== undefined) {
      ART.heightScale = Number(patch.heightScale);
      HEIGHT_SCALE = 30 * ART.heightScale;
    }
    if (patch.ridgeEmphasis !== undefined) ART.ridgeEmphasis = Number(patch.ridgeEmphasis);
    if (patch.flightAltitude !== undefined) ART.flightAltitude = Number(patch.flightAltitude);
    if (patch.sunElevation !== undefined) ART.sunElevation = Number(patch.sunElevation);
    if (patch.sunAzimuth !== undefined) ART.sunAzimuth = Number(patch.sunAzimuth);
    if (patch.palette !== undefined) ART.palette = String(patch.palette);
    if (patch.terracing !== undefined) ART.terracing = !!patch.terracing;
    if (patch.terraceStep !== undefined) ART.terraceStep = Number(patch.terraceStep);
  }

  applyArt(patch) {
    if (patch.sunElevation !== undefined || patch.sunAzimuth !== undefined) {
      var el = ART.sunElevation * Math.PI / 180;
      var az = ART.sunAzimuth * Math.PI / 180;
      this.sun.dir.set(
        Math.cos(el) * Math.sin(az),
        Math.sin(el),
        Math.cos(el) * Math.cos(az),
      ).normalize();
    }
    if (patch.palette !== undefined) {
      var p = PALETTES[ART.palette] || PALETTES.alabaster;
      this.sun.color.setRGB(p.sun[0], p.sun[1], p.sun[2]);
      this.fogNear.setRGB(p.fogNear[0], p.fogNear[1], p.fogNear[2]);
      this.fogFar.setRGB(p.fogFar[0], p.fogFar[1], p.fogFar[2]);
      this.horizonGlow.setRGB(p.horizonGlow[0], p.horizonGlow[1], p.horizonGlow[2]);
    }
    if (patch.terracing !== undefined) {
      this.field.uTerrace.value = ART.terracing ? 0.85 : 0;
    }
    if (patch.terraceStep !== undefined) {
      this.field.uTerraceStep.value = ART.terraceStep;
    }
  }

  /* Ground height at a world position — a CPU mirror of the shader's base term.
   * It deliberately omits the analytic fine relief: the flight needs the shape
   * of the land, not its gravel. */
  heightAt(x, z) {
    const seconds = -z / TIME_SCALE;
    const band = clamp01(x / BAND_WIDTH + 0.5);
    const T = this.analysis.terrainAt(seconds / this.analysis.duration, band);
    const mass = mix(1.45, 0.48, Math.pow(band, 0.70));
    let h = Math.pow(T.energy, this.field.uHeightGamma.value) * this.field.uHeightScale.value * mass;
    h += T.ridge * T.energy * this.field.uRidgeScale.value * mix(0.6, 1.9, band);
    return Math.max(h, this.field.uBaseHeight.value);
  }

  /* The height the flight should clear: the highest ground in a short window
   * around a point, smoothed, so the camera rides the massif instead of
   * bobbing over every partial. */
  groundNear(x, z) {
    let sum = 0, weight = 0;
    for (let i = -3; i <= 3; i++) {
      for (let j = -2; j <= 2; j++) {
        const w = 1 / (1 + i * i * 0.35 + j * j * 0.6);
        sum += this.heightAt(x + j * 9, z + i * 22) * w;
        weight += w;
      }
    }
    return sum / weight;
  }

  /* --------------------------------------------------------- per-frame update */

  update(f) {
    const analysis = this.analysis;
    const t = f.time;
    this.field.uPlayhead.value = t;

    // ---- climate ------------------------------------------------------------
    // Loudness controls environmental force, not decoration.
    const loud = analysis.at('loudness_short', t);
    const medium = analysis.mean('loudness_medium', t, 2.0);
    const bright = analysis.mean('brightness', t, 1.5);
    const presence = analysis.mean('presence', t, 0.6);
    const onset = analysis.onsetEnergy(t, 0.35);
    const high = analysis.at('high', t);

    this.shared.uSunPower.value = (0.80 + medium * 0.60 + onset * 0.12) * f.exposure;
    this.shared.uExposure.value = f.exposure;
    this.shared.uContrast.value = f.contrast;

    // Silence is distance: when the record breathes, the air thins and the
    // horizon retreats.
    this.shared.uFogDensity.value = mix(0.0016, 0.0007, presence) * f.atmosphere;
    // The ceiling brightens with the recording; the wall stays dark so the
    // carving always has something to stand against.
    this.sky.setRGB(mix(0.052, 0.105, medium), mix(0.050, 0.100, medium), mix(0.049, 0.094, medium));
    this.horizon.setRGB(mix(0.040, 0.070, medium), mix(0.034, 0.058, medium), mix(0.030, 0.048, medium));
    // Near fog is warmer, far fog is cooler — aerial perspective.
    this.fogNear.setRGB(
      mix(0.038, 0.068, medium) * f.atmosphere,
      mix(0.034, 0.058, medium) * f.atmosphere,
      mix(0.028, 0.046, medium) * f.atmosphere,
    );
    this.fogFar.setRGB(
      mix(0.022, 0.042, medium) * f.atmosphere,
      mix(0.022, 0.042, medium) * f.atmosphere,
      mix(0.026, 0.050, medium) * f.atmosphere,
    );
    this.horizonGlow.setRGB(
      mix(0.055, 0.110, medium) * f.atmosphere,
      mix(0.042, 0.078, medium) * f.atmosphere,
      mix(0.030, 0.054, medium) * f.atmosphere,
    );

    // Dynamics decide how tall the world is allowed to be.
    this.field.uHeightScale.value = HEIGHT_SCALE * mix(0.86, 1.16, medium) * f.relief;
    this.field.uRidgeScale.value = 3.4 * ART.ridgeEmphasis * mix(0.7, 1.35, analysis.mean('voice', t, 0.8));

    // ---- the ground follows the camera -------------------------------------
    const origin = this.terrainMaterial.uniforms.uGridOrigin.value;
    // Snap to a cell so the grid does not swim under the landscape.
    const cell = (BAND_WIDTH * 1.3) / this.profile.gridX;
    origin.set(
      Math.round(this.camera.position.x / cell) * cell,
      0,
      Math.round(this.camera.position.z / cell) * cell,
    );
    this.terrainMaterial.uniforms.uAhead.value = f.ahead;
    this.plinth.position.z = this.camera.position.z - this.profile.viewDistance * 0.35;

    // ---- atmosphere ---------------------------------------------------------
    for (const cloud of [this.air, this.nearAir]) {
      if (!cloud) continue;
      const u = cloud.material.uniforms;
      const near = cloud === this.nearAir;
      u.uTime.value = t;
      u.uPresence.value = f.presence.air * (near ? 0.75 : 1);
      // High-frequency energy lifts matter into the sky.
      u.uLift.value = high * 0.8 + onset * 0.4;
      u.uCentre.value.set(
        near ? this.camera.position.x : 0,
        near ? this.camera.position.y - 14 : 10,
        this.camera.position.z - (near ? 34 : 300),
      );
    }

    // ---- landmarks ----------------------------------------------------------
    if (this.landmarks) {
      for (let i = 0; i < this.landmarks.length; i++) {
        const entry = this.landmarks[i];
        const reveal = f.landmarks[i] || 0;
        entry.mesh.visible = reveal > 0.001;
        entry.material.uniforms.uReveal.value = reveal;
      }
    }

    // ---- specimen -----------------------------------------------------------
    this.specimen.visible = f.specimen > 0.001;
    this.terrain.visible = f.specimen < 0.98;
    this.skyDome.visible = true;
    if (this.specimen.visible) {
      this.specimenMaterial.uniforms.uReveal.value = f.specimen;
      this.specimenMaterial.uniforms.uPlayheadU.value = clamp01(t / this.analysis.duration);
      this.specimen.position.set(f.specimenAt.x, f.specimenAt.y, f.specimenAt.z);
      this.specimen.rotation.y = 0.35 + Math.sin(t * 0.10) * 0.05;
      this.specimen.scale.setScalar(mix(0.55, 1, ease.outCubic(f.specimen)));
    }

    // ---- post ---------------------------------------------------------------
    const c = this.compositeMaterial.uniforms;
    c.uTime.value = t;
    c.uExposure.value = f.exposure;
    c.uBloomStrength.value = this.profile.bloom ? mix(0.22, 0.55, loud) : 0;
    if (this.profile.bloom) {
      this.brightMaterial.uniforms.uThreshold.value = mix(0.78, 0.58, medium);
      this.brightMaterial.uniforms.uKnee.value = mix(0.22, 0.38, medium);
    }
    c.uFocusDistance.value = f.focus;
    c.uFocusRange.value = f.focusRange;
    c.uContrast.value = f.contrast;
    c.uVignette.value = mix(0.30, 0.44, 1 - presence);
    c.uHighContrast.value = this.highContrast ? 1 : 0;
    c.uNear.value = this.camera.near;
    c.uFar.value = this.camera.far;
  }

  render(camera) {
    const renderer = this.renderer;
    const info = renderer.info;
    const cam = camera || this.camera;
    info.reset();

    renderer.setRenderTarget(this.sceneTarget);
    renderer.clear();
    renderer.render(this.scene, cam);
    this.stats.sceneDrawCalls = info.render.calls;
    this.stats.sceneTriangles = info.render.triangles;

    const c = this.compositeMaterial.uniforms;
    c.uScene.value = this.sceneTarget.texture;
    c.uDepth.value = this.sceneTarget.depthTexture;

    if (this.profile.bloom) {
      this.brightMaterial.uniforms.uScene.value = this.sceneTarget.texture;
      this._blit(this.brightMaterial, this.halfA);
      const w = this.halfA.width, h = this.halfA.height;
      for (let i = 0; i < this.profile.bloomIterations; i++) {
        const spread = 1 + i * 1.7;
        this.blurMaterial.uniforms.uSource.value = this.halfA.texture;
        this.blurMaterial.uniforms.uDirection.value.set(spread / w, 0);
        this._blit(this.blurMaterial, this.halfB);
        this.blurMaterial.uniforms.uSource.value = this.halfB.texture;
        this.blurMaterial.uniforms.uDirection.value.set(0, spread / h);
        this._blit(this.blurMaterial, this.halfA);
      }
      c.uBloom.value = this.halfA.texture;
    } else {
      c.uBloom.value = this.sceneTarget.texture;
      c.uBloomStrength.value = 0;
    }

    if (this.profile.dof > 0) {
      const w = this.blurTarget.width, h = this.blurTarget.height;
      this.blurMaterial.uniforms.uSource.value = this.sceneTarget.texture;
      this.blurMaterial.uniforms.uDirection.value.set(1.6 / w, 0);
      this._blit(this.blurMaterial, this.halfB);
      this.blurMaterial.uniforms.uSource.value = this.halfB.texture;
      this.blurMaterial.uniforms.uDirection.value.set(0, 1.6 / h);
      this._blit(this.blurMaterial, this.blurTarget);
      c.uBlur.value = this.blurTarget.texture;
      c.uDofStrength.value = this.profile.dof;
    } else {
      c.uBlur.value = this.sceneTarget.texture;
      c.uDofStrength.value = 0;
    }

    this._blit(this.compositeMaterial, null);

    this.stats.drawCalls = info.render.calls;
    this.stats.programs = info.programs ? info.programs.length : 0;
  }

  setHighContrast(on) {
    this.highContrast = on;
    this.compositeMaterial.uniforms.uHighContrast.value = on ? 1 : 0;
  }

  dispose() {
    if (!this.renderer) return;
    this.scene.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      }
    });
    for (const target of [this.sceneTarget, this.halfA, this.halfB, this.blurTarget]) target?.dispose();
    for (const texture of Object.values(this.textures)) texture?.dispose?.();
    if (this.landmarks) for (const l of this.landmarks) l.texture.dispose();
    this.quadGeometry.dispose();
    this.renderer.dispose();
    this.renderer = null;
  }
}
