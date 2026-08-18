/* GLSL for the Transcendence edition — Sonic Terrain.
 *
 * There is no authored terrain geometry anywhere in this package. The landscape
 * is `analysis/track-01.terrain.png`, sampled in a vertex shader: one texel per
 * (time frame, mel band). Elevation is the recording's own energy, the ridges
 * are its own harmonics, the erosion is its own transients. Change the
 * recording and every feature of the world changes with it.
 *
 * Fine surface structure, atmosphere and grain are generated analytically here
 * rather than baked, so they carry no resolution limit and no storage cost.
 */

const GLSL = {};

/* ------------------------------------------------------------------ common */

GLSL.common = /* glsl */`
#define PI 3.141592653589793
#define TAU 6.283185307179586

float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), u.x),
             mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), u.x), u.y);
}
float fbm2(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}
float ridged2(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    float n = 1.0 - abs(vnoise(p) * 2.0 - 1.0);
    s += a * n * n; p *= 2.07; a *= 0.5;
  }
  return s;
}

vec3 tonemap(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float ggx(vec3 n, vec3 v, vec3 l, float rough){
  float a = max(0.015, rough * rough);
  vec3 h = normalize(v + l);
  float ndh = max(dot(n, h), 0.0);
  float ndv = max(dot(n, v), 1e-4);
  float ndl = max(dot(n, l), 0.0);
  float a2 = a * a;
  float dd = ndh * ndh * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * dd * dd);
  float k = a * 0.5;
  float G = (ndl / (ndl * (1.0 - k) + k)) * (ndv / (ndv * (1.0 - k) + k));
  return D * G / (4.0 * ndv * ndl + 1e-4);
}
float fresnel(float ndv, float f0){ return f0 + (1.0 - f0) * pow(1.0 - ndv, 5.0); }
`;

/* ---------------------------------------------------- the terrain function */

/* The single source of truth for the landscape. The ground, the lyric
 * landmarks, the specimen and the Essential fallback all evaluate the same
 * function, so a landmark can never float above the ridge it is cut into. */
GLSL.terrainField = /* glsl */`
uniform sampler2D uTerrain;     // R elevation · G harmonic · B transient · A ridge
uniform vec2  uTerrainSize;     // frames, bands
uniform float uTimeScale;       // world units per second
uniform float uBandWidth;       // world units across the whole frequency axis
uniform float uDuration;
uniform float uHeightScale;
uniform float uHeightGamma;
uniform float uRidgeScale;
uniform float uDetailScale;
uniform float uPlayhead;
uniform float uTerrace;
uniform float uTerraceStep;
uniform float uTerraceFrom;
uniform float uTerraceTo;
uniform float uBaseHeight;
uniform float uFilterX;
uniform float uFilterZ;

/* World position → terrain texture coordinate.
 *   z = -seconds * uTimeScale             travelling forward is travelling in time
 *   x = (band/bands - 0.5) * uBandWidth   mel frequency laid across the world  */
float secondsAt(float worldZ){ return -worldZ / uTimeScale; }

vec4 terrainSample(vec2 worldXZ){
  float u = secondsAt(worldXZ.y) / uDuration;
  float v = worldXZ.x / uBandWidth + 0.5;
  // Row 0 of the image is the highest band, so flip v back.
  vec4 T = texture2D(uTerrain, vec2(clamp(u, 0.0, 1.0), clamp(1.0 - v, 0.0, 1.0)));
  // Outside the recording there is no land at all — the world simply stops.
  float inside = step(0.0, u) * step(u, 1.0) * step(0.0, v) * step(v, 1.0);
  return T * inside;
}

/* Filtered sample. uLod is how coarse this vertex's cell is, 0 near the eye
 * and 1 at the horizon. A five-tap cross across the cell footprint is enough
 * to stop the far ground from aliasing into torn spikes, and it costs four
 * extra fetches only where the geometry is already cheap. */
vec4 terrainSampleLod(vec2 worldXZ, float lod){
  vec4 T = terrainSample(worldXZ);
  if (lod < 0.02) return T;
  float rz = lod * lod * uFilterZ;
  float rx = lod * uFilterX;
  vec4 sum = T * 2.0;
  sum += terrainSample(worldXZ + vec2(0.0,  rz));
  sum += terrainSample(worldXZ + vec2(0.0, -rz));
  sum += terrainSample(worldXZ + vec2( rx, 0.0));
  sum += terrainSample(worldXZ + vec2(-rx, 0.0));
  return mix(T, sum / 6.0, clamp(lod * 1.6, 0.0, 1.0));
}

/* Elevation in world units. The single source of truth for the shape of the
 * world: the ground, the lyric landmarks, the specimen and the flight camera
 * all evaluate this, so a landmark can never float above the ridge it is cut
 * into and the camera can never sink through the rock.
 *
 * MACRO FORM vs SPECTRAL SURFACE — the two layers are architecturally
 * separate. Procedural noise fields generate the geological vocabulary:
 * broad mountains, connected ridges, deep navigable valleys. The
 * recording's spectral data articulates their surfaces — it does not
 * determine the silhouette. */
float terrainHeight(vec2 worldXZ, float lod){
  vec4 T = terrainSampleLod(worldXZ, lod);
  float band = clamp(worldXZ.x / uBandWidth + 0.5, 0.0, 1.0);
  float mass = mix(1.45, 0.48, pow(band, 0.70));
  float energy = T.r * mass;

  // ── MACRO FORM LAYER ─────────────────────────────────────────────
  float range1 = ridged2(worldXZ * vec2(0.0020, 0.0005) + 5.3);
  range1 = pow(range1, 1.6);

  float range2 = ridged2(worldXZ * vec2(0.0008, 0.0012) + 19.1);
  range2 = pow(range2, 1.8) * 0.65;

  float peakMod = fbm2(worldXZ * vec2(0.0007, 0.0005) + 2.7);

  float mountain = max(range1 * mix(0.4, 1.0, peakMod), range2);
  mountain = pow(max(mountain, 0.0), 1.5);
  float peakHeight = mountain * uHeightScale * 8.0;

  float foothills = fbm2(worldXZ * vec2(0.0030, 0.0015) + 41.0);
  foothills = foothills * foothills * uHeightScale * 0.5;

  float macro = max(peakHeight, foothills);
  macro *= mix(0.3, 1.0, energy);

  // ── DELIBERATE VALLEY CORRIDOR ──────────────────────────────────
  // One exaggerated test valley at band ~-0.15 (x ≈ -31).  Broad
  // floor, towering flanks, micro-terrain suppressed on the floor.
  float vCenterX = -31.0;
  float vDist = abs(worldXZ.x - vCenterX);
  float vEdge = fbm2(vec2(worldXZ.y * 0.0012 + 77.0, worldXZ.x * 0.001 + 77.0)) * 10.0;
  float vEffDist = max(0.0, vDist - abs(vEdge));
  float vWidth = 0.7 + 0.25 * sin(worldXZ.y * 0.013 + 1.0) + 0.15 * sin(worldXZ.y * 0.031 + 2.7)
               + fbm2(vec2(worldXZ.y * 0.004, 29.0)) * 0.15;
  vWidth = clamp(vWidth, 0.45, 1.2);
  float vFloor = 1.0 - smoothstep(10.0, 35.0 * vWidth, vEffDist);
  float vWallZone = smoothstep(30.0 * vWidth, 55.0 * vWidth, vEffDist) * (1.0 - smoothstep(55.0 * vWidth, 130.0, vEffDist));
  macro *= mix(1.0, 0.04, vFloor);
  macro += vWallZone * uHeightScale * 3.5;

  // ── SPECTRAL SURFACE LAYER ───────────────────────────────────────
  float hasMacro = smoothstep(2.0, 25.0, macro);
  float spectral = pow(T.r, uHeightGamma + 0.5) * uHeightScale * mass * 0.12;
  spectral *= mix(0.1, 1.0, hasMacro) * mix(1.0, 0.15, vFloor);

  float sRidge = T.a * T.r * uRidgeScale * mix(0.6, 1.9, band) * 0.08;
  sRidge *= mix(0.1, 1.0, hasMacro) * mix(1.0, 0.1, vFloor);

  float h = macro + spectral + sRidge;

  // Micro-relief: suppressed at distance, in basins, and on the valley floor.
  float detail = uDetailScale * (1.0 - smoothstep(0.10, 0.55, lod)) * mix(0.1, 1.0, hasMacro) * mix(1.0, 0.05, vFloor);
  float strata = fbm2(worldXZ * 0.055 + vec2(0.0, band * 3.0)) - 0.5;
  float broken = ridged2(worldXZ * 0.21) - 0.5;
  h += mix(broken, strata, T.g) * detail * (0.25 + T.r * 1.5);

  // Base plate.
  h = max(h, uBaseHeight);

  // Contour terracing on the lower slopes.
  float stepH = uTerraceStep;
  float terraced = floor(h / stepH) * stepH + stepH * 0.5;
  float carve = (1.0 - smoothstep(uTerraceFrom, uTerraceTo, h)) * uTerrace;
  carve *= 1.0 - smoothstep(0.08, 0.42, lod);
  h = mix(h, terraced, carve);

  // Edge margins.
  float u = secondsAt(worldXZ.y) / uDuration;
  float v = worldXZ.x / uBandWidth + 0.5;
  float margin = 0.012;
  float inside = smoothstep(0.0, margin, u) * (1.0 - smoothstep(1.0 - margin, 1.0, u))
               * smoothstep(0.0, margin, v) * (1.0 - smoothstep(1.0 - margin, 1.0, v));
  return h * inside;
}

vec3 terrainNormal(vec2 worldXZ, float eps, float lod){
  // The differencing step widens with the cell, or the normal would describe
  // detail the geometry no longer has.
  float e = eps * (1.0 + lod * 26.0);
  float hL = terrainHeight(worldXZ - vec2(e, 0.0), lod);
  float hR = terrainHeight(worldXZ + vec2(e, 0.0), lod);
  float hD = terrainHeight(worldXZ - vec2(0.0, e), lod);
  float hU = terrainHeight(worldXZ + vec2(0.0, e), lod);
  return normalize(vec3(hL - hR, 2.0 * e, hD - hU));
}
`;

/* -------------------------------------------------------------- the ground */

GLSL.terrainVertex = /* glsl */`
uniform vec3 uGridOrigin;     // the grid is carried with the camera
attribute float aLod;         // 0 at the eye, 1 at the horizon
varying vec3 vWorld;
varying vec4 vTerrain;
varying float vBand;
varying float vSeconds;
varying float vLod;
varying vec3 vSmoothNormal;

void main(){
  vec3 world = position + uGridOrigin;
  vLod = aLod;
  world.y = terrainHeight(world.xz, aLod);
  vWorld = world;
  vTerrain = terrainSampleLod(world.xz, aLod);
  vBand = clamp(world.x / uBandWidth + 0.5, 0.0, 1.0);
  vSeconds = secondsAt(world.z);
  vSmoothNormal = terrainNormal(world.xz, 0.8, aLod);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

GLSL.terrainFragment = /* glsl */`
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uFogNear;
uniform vec3 uFogFar;
uniform float uFogDensity;
uniform float uExposure;
uniform float uContrast;
uniform float uSunPower;
uniform float uAhead;
uniform float uLodEps;
varying vec3 vWorld;
varying vec4 vTerrain;
varying float vBand;
varying float vSeconds;
varying float vLod;
varying vec3 vSmoothNormal;

void main(){
  vec3 flatN = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (flatN.y < 0.0) flatN = -flatN;
  vec3 smoothN = normalize(vSmoothNormal);
  if (smoothN.y < 0.0) smoothN = -smoothN;
  float steepFade = 1.0 - pow(1.0 - clamp(smoothN.y, 0.0, 1.0), 2.0) * 0.65;
  float flatMix = smoothstep(0.22, 0.0, vLod) * 0.30 * steepFade;
  vec3 n = normalize(mix(smoothN, flatN, flatMix));
  vec3 v = normalize(cameraPosition - vWorld);

  float nearField = 1.0 - smoothstep(0.03, 0.30, vLod);
  if (nearField > 0.01) {
    float e2 = 4.5;
    float m0 = fbm2(vWorld.xz * 0.06);
    float mx = fbm2((vWorld.xz + vec2(e2, 0.0)) * 0.06) - m0;
    float mz = fbm2((vWorld.xz + vec2(0.0, e2)) * 0.06) - m0;
    n = normalize(n + vec3(-mx, 0.0, -mz) * 1.6 * nearField);
    float e = 0.9;
    float g0 = fbm2(vWorld.xz * 0.42);
    float gx = fbm2((vWorld.xz + vec2(e, 0.0)) * 0.42) - g0;
    float gz = fbm2((vWorld.xz + vec2(0.0, e)) * 0.42) - g0;
    n = normalize(n + vec3(-gx, 0.0, -gz) * 1.4 * nearField);
  }

  float energy = vTerrain.r;
  float harmonic = vTerrain.g;
  float transient = vTerrain.b;
  float ridge = vTerrain.a;

  float dist = length(cameraPosition - vWorld);
  float slope = 1.0 - clamp(n.y, 0.0, 1.0);
  float height = max(0.0, vWorld.y);
  float depthZone = smoothstep(30.0, 650.0, dist);
  float heightZone = smoothstep(1.5, 45.0, height);

  // --- color regions: green mountain palette --------------------------------
  vec3 cDeepShadow = vec3(0.045, 0.065, 0.035);
  vec3 cDarkForest = vec3(0.08, 0.15, 0.06);
  vec3 cOlive      = vec3(0.14, 0.22, 0.09);
  vec3 cMidGreen   = vec3(0.18, 0.32, 0.12);
  vec3 cPaleGreen  = vec3(0.30, 0.40, 0.22);
  vec3 cHighlight  = vec3(0.50, 0.56, 0.42);

  vec3 body = cDeepShadow;
  body = mix(body, cDarkForest, smoothstep(2.0, 10.0, height));
  body = mix(body, cOlive, smoothstep(8.0, 28.0, height));
  body = mix(body, cMidGreen, smoothstep(22.0, 55.0, height));
  body = mix(body, cPaleGreen, smoothstep(48.0, 100.0, height));
  body = mix(body, cHighlight, smoothstep(90.0, 180.0, height));

  vec3 cliffTone = mix(cDarkForest, cDeepShadow, 0.5);
  body = mix(body, cliffTone, slope * slope * 0.55);

  body *= mix(vec3(1.08, 1.0, 0.88), vec3(0.88, 1.0, 1.08), smoothstep(0.08, 0.92, vBand));

  // --- material texture: large-scale tonal variation -----------------------
  float vclose = 1.0 - smoothstep(0.05, 0.42, vLod);

  float macroTone = fbm2(vWorld.xz * 0.003 + vec2(height * 0.008, 0.0));
  float macroTone2 = fbm2(vWorld.xz * vec2(0.002, 0.005) + 37.0);
  body *= 0.80 + macroTone * 0.40;
  body = mix(body, body * vec3(1.12, 1.02, 0.82), macroTone2 * 0.45);

  float strata = sin(height * 0.35 + fbm2(vWorld.xz * 0.008 + 5.0) * 12.0) * 0.5 + 0.5;
  body *= mix(1.0, 0.68 + strata * 0.64, slope * slope * 0.55);

  vec2 diagUV = mat2(0.82, 0.57, -0.57, 0.82) * vWorld.xz;
  float streak = ridged2(diagUV * vec2(0.018, 0.015) + vec2(height * 0.03, vBand * 1.2));
  streak = pow(clamp(streak, 0.0, 1.0), 2.0);
  body *= 1.0 - streak * 0.22 * vclose;

  float patch = fbm2(vWorld.xz * 0.0018 + vec2(vWorld.y * 0.005, vBand * 2.5));
  body *= 0.88 + patch * 0.24;

  float mesoNoise = fbm2(vWorld.xz * 0.07 + vec2(vBand * 5.0, height * 0.06));
  body *= 0.86 + mesoNoise * 0.28 * vclose;

  body = mix(body, body * vec3(1.12, 1.04, 0.88), energy * 0.5);

  vec2 oblique1 = mat2(0.57, 0.82, -0.82, 0.57) * vWorld.xz;
  float vein = ridged2(oblique1 * vec2(0.15, 0.12) + vec2(vWorld.y * 0.10, 0.0));
  vein = pow(clamp(vein, 0.0, 1.0), mix(2.8, 4.0, vBand));
  vec2 oblique2 = mat2(0.91, -0.42, 0.42, 0.91) * vWorld.xz;
  float vein2 = ridged2(oblique2 * vec2(0.10, 0.08) + 31.7);
  vein2 = pow(clamp(vein2, 0.0, 1.0), 5.0);
  float veinStrength = mix(0.30, 0.18, vBand);
  body *= 1.0 - (vein * veinStrength + vein2 * 0.30) * (0.45 + 0.55 * energy) * vclose;

  body *= 0.96 + 0.08 * fbm2(vWorld.xz * 0.55 + vWorld.y * 0.09) * vclose;

  body = mix(body, body * vec3(1.06, 1.02, 0.92), transient * 0.5);

  vec3 albedo = body;

  float bandRough = mix(0.56, 0.88, pow(vBand, 0.7));
  float rough = clamp(bandRough - harmonic * 0.12 - ridge * 0.05 + transient * 0.04
    + slope * 0.08 - heightZone * 0.04, 0.34, 0.94);

  // --- lighting: strong directional relief ---------------------------------
  vec3 l = normalize(uSunDir);
  float ndl = max(dot(n, l), 0.0);

  float wrapped = max(0.0, (dot(n, l) + 0.22) / 1.22);
  float key = mix(pow(wrapped, 2.0) * 0.50, ndl, 0.72);

  float transluBase = mix(0.16, 0.28, pow(vBand, 0.6));
  float translucency = pow(clamp(1.0 - abs(dot(n, v)), 0.0, 1.0), 2.2) * transluBase;
  translucency *= 1.0 + energy * 0.30;

  vec3 shadowTint = vec3(0.35, 0.52, 0.42);
  vec3 lit = albedo * uSunColor;
  vec3 shade = albedo * shadowTint;

  vec3 color = mix(shade * 0.09, lit, key) * uSunPower;
  color += albedo * uSunColor * translucency * uSunPower * 0.30;

  float f0 = mix(0.036, 0.018, pow(vBand, 0.7));
  f0 *= 1.0 + energy * 0.12;
  color += uSunColor * ggx(n, v, l, rough) * ndl * fresnel(max(dot(n, v), 0.0), f0) * 0.28;

  float up = n.y * 0.5 + 0.5;
  color += albedo * mix(uGroundColor, uSkyColor, up) * 1.1;

  float cavity = 1.0 - slope * 0.60;
  float valleyDark = smoothstep(12.0, 2.0, height) * 0.20;
  color *= mix(1.0, cavity, 0.80) * (1.0 - valleyDark);

  float crestIntensity = mix(0.08, 0.16, harmonic);
  color += uSunColor * pow(ridge, 1.4) * energy * crestIntensity * smoothstep(0.35, 0.95, up);

  float rimLight = pow(clamp(1.0 - dot(n, v), 0.0, 1.0), 3.5);
  color += uSunColor * rimLight * 0.04 * heightZone * uSunPower;

  // --- the playhead --------------------------------------------------------
  float delta = vSeconds - uPlayhead;
  float heard = 1.0 - smoothstep(-0.4, 2.5, delta);
  float present = exp(-delta * delta * 0.06);
  float unheard = 1.0 - heard;
  color *= mix(1.0 - uAhead * 0.7, 1.0, heard);
  color = mix(color, uFogFar * 0.6, unheard * uAhead * 0.25);
  color += uSunColor * present * 0.06 * (0.3 + energy);

  // --- atmosphere ----------------------------------------------------------
  float fog = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
  float lowLying = exp(-height * 0.032);
  float valleyFog = exp(-height * 0.018) * 0.38;
  fog = clamp(fog * mix(0.75, 1.0, lowLying) + valleyFog * fog, 0.0, 0.985);
  float fogDepth = smoothstep(0.0, 1.0, fog);
  vec3 fogCol = mix(uFogNear, uFogFar, fogDepth);
  vec3 valleyHaze = vec3(0.016, 0.026, 0.016);
  vec3 groundMist = mix(valleyHaze, uFogNear, clamp(height * 0.022, 0.0, 1.0));
  fogCol = mix(groundMist, fogCol, smoothstep(0.0, 24.0, height));
  color = mix(color, fogCol, fog);

  gl_FragColor = vec4(color * uExposure * uContrast, 1.0);
}
`;

/* ------------------------------------------------------- the lyric landmark */

/* The signature technique: a lyric is cut into the ridge the voice itself made.
 * The landmark evaluates the same terrain function as the ground, so it lies
 * exactly on the surface. Its band position is the singer's own dominant mel
 * band, measured at build time. */
GLSL.landmarkVertex = /* glsl */`
uniform vec3 uAnchor;         // world x and z of the line's own ridge
uniform vec2 uExtent;         // width, depth in world units
uniform float uLift;
varying vec2 vUv;
varying vec3 vWorld;

void main(){
  vUv = uv;
  // The line runs *along* the flight: the text's reading axis is time, so the
  // first word is the one nearest the approaching viewer and the words pass at
  // the speed they were sung. uExtent is (length along time, width across
  // frequency).
  vec3 world = vec3(uAnchor.x + (uv.y - 0.5) * uExtent.y, 0.0,
                    uAnchor.z + (0.5 - uv.x) * uExtent.x);
  world.y = terrainHeight(world.xz, 0.0) + uLift;
  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

GLSL.landmarkFragment = /* glsl */`
uniform sampler2D uText;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uFogNear;
uniform vec3 uFogFar;
uniform float uFogDensity;
uniform float uReveal;
uniform float uExposure;
uniform float uContrast;
varying vec2 vUv;
varying vec3 vWorld;

void main(){
  float glyph = texture2D(uText, vec2(vUv.x, 1.0 - vUv.y)).a;
  if (glyph < 0.004) discard;

  vec2 grad = vec2(dFdx(glyph), dFdy(glyph));
  float dist = length(cameraPosition - vWorld);

  float distAdapt = mix(1.0, 2.2, smoothstep(200.0, 700.0, dist));
  float edge = clamp(length(grad) * 30.0 * distAdapt, 0.0, 1.0);
  vec3 l = normalize(uSunDir);
  float lit = clamp(dot(normalize(vec3(grad.x * 46.0, 1.0, grad.y * 46.0)), l), 0.0, 1.0);

  float depth = smoothstep(0.1, 0.7, glyph);
  vec3 cut = uSunColor * mix(0.065, 0.038, depth);
  vec3 rim = uSunColor * (0.34 + 0.66 * lit);
  vec3 color = mix(cut, rim, edge * 0.95);

  float written = smoothstep(vUv.x - 0.07, vUv.x + 0.02, uReveal);

  float front = smoothstep(0.12, 0.0, abs(vUv.x - uReveal)) * step(0.01, uReveal) * step(uReveal, 0.99);
  color += uSunColor * front * 0.08 * edge;

  float fog = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
  float fogDepth = smoothstep(0.0, 1.0, clamp(fog, 0.0, 0.96));
  vec3 fogCol = mix(uFogNear, uFogFar, fogDepth);
  color = mix(color, fogCol, clamp(fog, 0.0, 0.96));

  float legible = 1.0 - smoothstep(380.0, 1000.0, dist);
  gl_FragColor = vec4(color * uExposure * uContrast, glyph * written * legible);
}
`;

/* ----------------------------------------------------------- the atmosphere */

/* Suspended matter. Deterministic: position is a closed-form function of
 * (seed, playhead), so seeking reconstructs the identical arrangement. */
GLSL.airVertex = /* glsl */`
uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;
uniform float uPresence;
uniform float uLift;          // high-frequency energy lifting matter into the sky
uniform float uBrightness;    // recording brightness for particle luminance
uniform vec3  uCentre;
uniform vec3  uSpan;
attribute vec2 aSeed;
attribute float aIndex;
varying float vAlpha;
varying float vDepth;

void main(){
  float s1 = aSeed.x, s2 = aSeed.y;
  float t = uTime;

  vec3 p;
  p.x = uCentre.x + (s1 - 0.5) * uSpan.x + sin(t * 0.09 + s2 * 37.0) * 2.4;
  p.z = uCentre.z + (fract(s2 + t * 0.004) - 0.5) * uSpan.z;
  float rise = fract(s1 * 5.71 + s2 * 2.13 + t * (0.006 + uLift * 0.024));
  p.y = uCentre.y + rise * uSpan.y + cos(t * 0.07 + s1 * 23.0) * 1.6;

  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = -mv.z;
  float grain = 0.45 + hash11(aIndex * 0.0027) * 1.05;
  gl_PointSize = clamp(uSize * uPixelRatio * grain * (34.0 / max(dist, 0.6)), 0.6, 26.0);

  vDepth = smoothstep(40.0, 550.0, dist);
  vAlpha = uPresence * (0.05 + 0.12 * grain)
    * (1.0 + uBrightness * 0.35)
    * smoothstep(0.0, 0.12, rise) * (1.0 - smoothstep(0.70, 1.0, rise))
    * (1.0 - smoothstep(260.0, 620.0, dist));
}
`;

GLSL.airFragment = /* glsl */`
uniform sampler2D uSprite;
uniform vec3 uSunColor;
uniform float uContrast;
uniform float uExposure;
varying float vAlpha;
varying float vDepth;
void main(){
  vec4 sprite = texture2D(uSprite, gl_PointCoord);
  if (sprite.a < 0.008) discard;
  vec3 nearDust = vec3(0.28, 0.40, 0.24);
  vec3 farDust = vec3(0.20, 0.32, 0.28);
  vec3 dustColor = mix(nearDust, farDust, vDepth);
  gl_FragColor = vec4(dustColor * uSunColor * uExposure * uContrast, sprite.a * vAlpha);
}
`;

/* ------------------------------------------------------------------ the sky */

GLSL.skyVertex = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = position;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position + cameraPosition, 1.0);
  gl_Position.z = gl_Position.w;   // pinned to the far plane
}
`;

GLSL.skyFragment = /* glsl */`
uniform vec3 uSkyColor;
uniform vec3 uHorizonColor;
uniform vec3 uHorizonGlow;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uExposure;
uniform float uContrast;
uniform float uSunPower;
varying vec3 vDir;

void main(){
  vec3 d = normalize(vDir);
  float up = clamp(d.y, -1.0, 1.0);

  vec3 wall = mix(uHorizonColor * 0.26, uHorizonColor, smoothstep(-0.55, 0.35, up));

  float horizonBand = exp(-pow((up - 0.06) * 5.5, 2.0));
  wall += uHorizonGlow * horizonBand * 1.3;

  float horizonHaze = exp(-pow((up - 0.12) * 3.2, 2.0));
  wall += uHorizonGlow * horizonHaze * 0.4;

  float oculus = smoothstep(0.62, 0.93, up);
  vec3 ceiling = uSkyColor * (1.0 + oculus * 3.0);
  vec3 color = mix(wall, ceiling, smoothstep(0.30, 0.80, up));

  float ring = exp(-pow((up - 0.56) * 26.0, 2.0));
  float around = atan(d.z, d.x);
  float lamps = pow(max(0.0, sin(around * 14.0)), 90.0);
  color += uSunColor * ring * lamps * 1.2 * uSunPower;

  float speck = pow(hash21(floor(d.xz * 1150.0 + d.y * 407.0)), 120.0);
  color += vec3(0.80, 0.78, 0.74) * speck * (1.0 - oculus) * 0.22;

  float dustLayer = fbm2(vec2(around * 2.0, up * 3.0 + 0.5)) * 0.04;
  color += uHorizonGlow * dustLayer * (1.0 - smoothstep(0.3, 0.7, up));

  gl_FragColor = vec4(color * uExposure * uContrast, 1.0);
}
`;

GLSL.grooveVertexFallback = /* glsl */`
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/* --------------------------------------------------------------- the plinth */

/* The floor of the gallery, and the bronze plinth the massif is installed on.
 * Without something under it the terrain is a heightfield; with a plinth it is
 * an object that someone chose to exhibit. */
GLSL.plinthFragment = /* glsl */`
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uFogNear;
uniform vec3 uFogFar;
uniform float uFogDensity;
uniform float uExposure;
uniform float uContrast;
uniform float uSunPower;
uniform float uBandWidthLocal;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;

void main(){
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);
  vec3 l = normalize(uSunDir);

  // Bronze appears only as the machined rim of the plinth. Everything else is
  // dark polished floor — in a gallery the metal is an edge, not a field.
  float edge = abs(abs(vWorld.x) - uBandWidthLocal * 0.52);
  float onPlinth = 1.0 - smoothstep(uBandWidthLocal * 0.006, uBandWidthLocal * 0.022, edge);

  vec3 bronze = vec3(0.238, 0.150, 0.072);
  vec3 floorCol = vec3(0.016, 0.024, 0.014);
  vec3 albedo = mix(floorCol, bronze, onPlinth);
  float rough = mix(0.22, 0.34, onPlinth);

  float ndl = max(dot(n, l), 0.0);
  vec3 color = albedo * uSunColor * ndl * uSunPower * 0.85;
  color += uSunColor * ggx(n, v, l, rough) * ndl * fresnel(max(dot(n, v), 0.0), mix(0.04, 0.55, onPlinth)) * mix(1.2, 2.6, onPlinth);
  color += albedo * uSkyColor * 0.85;

  // A polished floor holds a soft vertical smear of whatever stands on it.
  float sheen = pow(clamp(1.0 - abs(dot(n, v)), 0.0, 1.0), 3.0);
  color += uSkyColor * sheen * mix(0.55, 0.22, onPlinth);

  float dist = length(cameraPosition - vWorld);
  float fog = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
  float fogDepth = smoothstep(0.0, 1.0, fog);
  vec3 fogCol = mix(uFogNear, uFogFar, fogDepth);
  color = mix(color, fogCol, fog);
  float alpha = 1.0 - smoothstep(0.75, 0.98, fog);

  gl_FragColor = vec4(color * uExposure * uContrast, alpha);
}
`;

/* ------------------------------------------------------------ the specimen */

/* The residue: the whole track condensed into a relief object the listener
 * keeps. Its surface is the same terrain function read across its full extent,
 * so the object is literally the shape of the recording. */
GLSL.specimenVertex = /* glsl */`
uniform float uSpan;
uniform float uRelief;
varying vec3 vWorld;
varying vec2 vPlane;
varying vec4 vTerrain;
varying float vBand;

void main(){
  vec2 plane = uv;                        // x over the whole track, y over frequency
  float seconds = plane.x * uDuration;
  vec4 T = terrainSample(vec2((plane.y - 0.5) * uBandWidth, -seconds * uTimeScale));
  vTerrain = T;
  vBand = plane.y;
  vPlane = plane;

  vec3 local = vec3((plane.x - 0.5) * uSpan, 0.0, (plane.y - 0.5) * uSpan * 0.30);
  local.y = pow(T.r, uHeightGamma) * uRelief * mix(1.6, 0.5, plane.y);
  vec4 world = modelMatrix * vec4(local, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

GLSL.specimenFragment = /* glsl */`
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform float uExposure;
uniform float uContrast;
uniform float uReveal;
uniform float uPlayheadU;
varying vec3 vWorld;
varying vec2 vPlane;
varying vec4 vTerrain;
varying float vBand;

void main(){
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (n.y < 0.0) n = -n;
  vec3 v = normalize(cameraPosition - vWorld);
  vec3 l = normalize(uSunDir);

  vec3 albedo = mix(vec3(0.030, 0.028, 0.033), vec3(0.115, 0.098, 0.070), smoothstep(0.1, 0.75, vBand));
  albedo *= 0.4 + 0.9 * vTerrain.r;

  vec3 color = albedo * uSunColor * max(dot(n, l), 0.0) * 2.4;
  color += uSunColor * ggx(n, v, l, 0.35) * max(dot(n, l), 0.0) * fresnel(max(dot(n, v), 0.0), 0.05) * 2.2;
  color += albedo * uSkyColor * 1.2;

  // The listened portion is illuminated; the rest of the track stays in shadow,
  // so the artefact records how far this listening actually went.
  float heard = 1.0 - smoothstep(uPlayheadU - 0.004, uPlayheadU + 0.02, vPlane.x);
  color *= mix(0.30, 1.0, heard);
  color *= smoothstep(0.0, 0.3, uReveal);

  gl_FragColor = vec4(color * uExposure * uContrast, 1.0);
}
`;

/* ------------------------------------------------------------ post pipeline */

GLSL.fullscreenVertex = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

GLSL.brightPass = /* glsl */`
uniform sampler2D uScene;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(uScene, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float contribution = max(soft, l - uThreshold) / max(l, 1e-4);
  gl_FragColor = vec4(c * contribution, 1.0);
}
`;

GLSL.blurPass = /* glsl */`
uniform sampler2D uSource;
uniform vec2 uDirection;
varying vec2 vUv;
void main(){
  vec4 sum = texture2D(uSource, vUv) * 0.2270270270;
  sum += texture2D(uSource, vUv + uDirection * 1.3846153846) * 0.3162162162;
  sum += texture2D(uSource, vUv - uDirection * 1.3846153846) * 0.3162162162;
  sum += texture2D(uSource, vUv + uDirection * 3.2307692308) * 0.0702702703;
  sum += texture2D(uSource, vUv - uDirection * 3.2307692308) * 0.0702702703;
  gl_FragColor = sum;
}
`;

GLSL.compositePass = /* glsl */`
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uBlur;
uniform sampler2D uDepth;
uniform sampler2D uNoise;
uniform vec2  uResolution;
uniform float uTime;
uniform float uBloomStrength;
uniform float uExposure;
uniform float uFocusDistance;
uniform float uFocusRange;
uniform float uDofStrength;
uniform float uGrain;
uniform float uVignette;
uniform float uNear;
uniform float uFar;
uniform float uContrast;
uniform float uHighContrast;
varying vec2 vUv;

float linearDepth(vec2 uv){
  float z = texture2D(uDepth, uv).x;
  float ndc = z * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
}

void main(){
  vec2 uv = vUv;
  vec2 centred = uv - 0.5;

  vec3 scene = texture2D(uScene, uv).rgb;

  if (uDofStrength > 0.0001) {
    float depth = linearDepth(uv);
    float delta = depth - uFocusDistance;
    float range = max(uFocusRange, 0.001);
    float coc = clamp(abs(delta) / range, 0.0, 1.0);
    float farBias = step(0.0, delta) * 0.3;
    coc = pow(coc, 1.5 - farBias) * uDofStrength;
    scene = mix(scene, texture2D(uBlur, uv).rgb, coc);
  }

  scene += texture2D(uBloom, uv).rgb * uBloomStrength;
  scene *= uExposure;
  vec3 color = tonemap(scene);

  color = mix(color, (color - 0.5) * 1.16 + 0.5, uHighContrast);
  color = pow(color, vec3(mix(1.0, 0.86, uHighContrast)));
  color *= uContrast;

  vec2 vig = centred * vec2(1.0, 1.08);
  float v = 1.0 - uVignette * dot(vig, vig) * 2.1;
  color *= clamp(v, 0.0, 1.0);

  vec3 noise = texture2D(uNoise, uv * uResolution / 128.0 + vec2(fract(uTime * 7.3), fract(uTime * 5.1))).rgb;
  color += (noise.r - 0.5) * uGrain * (1.0 - dot(color, vec3(0.33)) * 0.55);

  // Display encoding happens here because every pass above works in linear
  // light and only this one reaches a screen.
  color = clamp(color, 0.0, 1.0);
  color = mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, color));
  color += (noise.g - 0.5) / 255.0;

  gl_FragColor = vec4(color, 1.0);
}
`;
