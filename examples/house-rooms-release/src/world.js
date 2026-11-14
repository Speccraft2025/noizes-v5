/* The House That Remembered Us — the building (four floors, twenty rooms).
   Built for speed: only the corridor and the room you are in (or walking to) exist at
   any moment, and the whole house is lit by one fixed set of lights — a hemisphere, one
   downlight and three point lights — that are moved to wherever you are. Light counts
   never change, so nothing recompiles as you walk.
   Metres, y up. A corridor runs along -Z from the front (z=4) to the end door (z=-12);
   every floor uses the same corridor, re-dressed. Five doors per floor: two left, two
   right, one at the end. Rooms are built in their own frame (door at the origin, room
   running toward -Z) and turned to sit behind their door. */

const PLAN = {
  outside: { pos: [0.45, 1.2, 13.2], look: [0.35, 1.9, -6] },
  hall: { pos: [0, 1.6, 2.9], look: [0, 1.42, -12] },
  porch: [[0.42, 1.42, 6.3], [0.2, 1.6, 4.0]],
  SLOTS: [{ side: -1, z: -2.6 }, { side: 1, z: -5.2 }, { side: -1, z: -7.8 }, { side: 1, z: -10.0 }, { side: 0, z: -12 }],
  roomPos: [0, 1.45, -2.7], roomLook: [0, 1.3, -8],
};
function slotGeo(i) {
  const s = PLAN.SLOTS[i];
  if (s.side) return { door: [-s.side * 0.25, 1.6, s.z + 0.7], sill: [s.side * 1.95, 1.55, s.z], label: [s.side * 1.7, 2.3, s.z + 0.1], origin: [s.side * 2.1, 0, s.z], rot: s.side < 0 ? Math.PI / 2 : -Math.PI / 2 };
  return { door: [-0.3, 1.6, -9.4], sill: [-0.1, 1.6, -12.15], label: [0, 2.95, -11.9], origin: [0, 0, -12.3], rot: 0 };
}
// a point in a room's own frame → world
function roomPoint(slot, p) { const g = slotGeo(slot), c = Math.cos(g.rot), s = Math.sin(g.rot); return [g.origin[0] + p[0] * c + p[2] * s, p[1], g.origin[2] - p[0] * s + p[2] * c]; }

// Ten layouts, each used twice with a different colour, size and light. wet/tone set how the room sounds.
const ROOM_DEFS = [
  { a: 'den', name: 'Amber listening room', c: 0xffa050, wet: 0.06, tone: -2 },
  { a: 'rain', name: 'Blue rain room', c: 0x6a8cff, wet: 0.2, tone: 1.5 },
  { a: 'eq', name: 'Light wall', c: 0xff5a3c, wet: 0.1, tone: 0 },
  { a: 'orb', name: 'Still room', c: 0xf2d7a0, wet: 0.16, tone: -1 },
  { a: 'court', name: 'Green courtyard', c: 0x9fe08a, wet: 0.13, tone: 0 },
  { a: 'bar', name: 'Brass bar', c: 0xffb060, wet: 0.08, tone: -1 },
  { a: 'neon', name: 'Neon studio', c: 0xff3d8a, wet: 0.07, tone: 1 },
  { a: 'fire', name: 'Fireside library', c: 0xff7a30, wet: 0.05, tone: -3 },
  { a: 'pool', name: 'Bath house', c: 0x40d0c0, wet: 0.24, tone: 1 },
  { a: 'terrace', name: 'Night terrace', c: 0xffd27a, wet: 0.03, tone: 0 },
  { a: 'eq', v: 1, name: 'Violet light wall', c: 0x9a6aff, wet: 0.1, tone: 0 },
  { a: 'den', v: 1, name: 'Rose listening room', c: 0xff6a70, wet: 0.06, tone: -2 },
  { a: 'pool', v: 1, name: 'Ember bath', c: 0xff8a40, wet: 0.24, tone: 0 },
  { a: 'neon', v: 1, name: 'Ice studio', c: 0x5ad0ff, wet: 0.07, tone: 2 },
  { a: 'court', v: 1, name: 'Red courtyard', c: 0xff6a50, wet: 0.13, tone: 0 },
  { a: 'orb', v: 1, name: 'Blue still room', c: 0x7aa0ff, wet: 0.18, tone: 0 },
  { a: 'bar', v: 1, name: 'Jade bar', c: 0x6ae0a0, wet: 0.08, tone: -1 },
  { a: 'rain', v: 1, name: 'Storm room', c: 0xb0a0ff, wet: 0.22, tone: 2 },
  { a: 'fire', v: 1, name: 'Green library', c: 0x9ad06a, wet: 0.05, tone: -3 },
  { a: 'terrace', v: 1, name: 'Coral terrace', c: 0xff9a7a, wet: 0.03, tone: 0 },
];

function buildWorld(scene, T, opts = {}) {
  const SHADOW = opts.shadowSize | 0, FLOORS = opts.floors || 4;
  const W = { doors: [], front: [], hits: [], rooms: {}, floor: 0, shadowFrames: 4, gain: { spot: 1, pts: [1, 1, 1] } };
  const lam = (o) => new THREE.MeshLambertMaterial(o), std = (o) => new THREE.MeshStandardMaterial(o), col = (h) => new THREE.Color(h);
  const tile = (m, s) => { m.userData = { tile: s }; return m; };
  const M = {
    stone: tile(lam({ map: T.stone, color: 0xd6d0cc }), 2.2), timber: tile(lam({ map: T.timber, color: 0xd9cbbd }), 1.5), timberDark: tile(lam({ map: T.timber, color: 0x6e5c50 }), 1.5),
    concrete: tile(lam({ map: T.concrete, color: 0xa9a09a }), 3), floor: tile(std({ map: T.floor, roughness: 0.22, metalness: 0.05, color: 0xa89c92 }), 3.2),
    paving: tile(std({ map: T.paving, roughness: 0.2, metalness: 0.1, color: 0xc6beb8 }), 2.6), jute: tile(lam({ map: T.jute, color: 0x6f6a66 }), 1.4), rug: tile(lam({ map: T.rug, color: 0x9a8478 }), 1.1),
    brass: std({ color: 0xb8904a, metalness: 0.95, roughness: 0.3, side: THREE.DoubleSide }), bronze: std({ color: 0x6a4a22, metalness: 0.9, roughness: 0.45 }),
    dark: lam({ color: 0x0c0a09 }), sofa: lam({ color: 0x5e2f1c }), cream: lam({ color: 0x8f8268 }), lawn: lam({ color: 0x16301a }),
  };
  // polished floors mirror the lamp-lit environment only faintly, so no room gets a stray warm sheen
  if (opts.env) for (const m of [M.floor, M.paving]) { m.envMap = opts.env; m.envMapIntensity = 0.16; }
  const sh = (m) => { if (SHADOW) { m.castShadow = true; m.receiveShadow = true; } return m; };

  /* ---------- small builders (all take the group they add to) ---------- */
  function bx(p, x0, x1, y0, y1, z0, z1, mat) {
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0), g = new THREE.BoxGeometry(w, h, d), s = (mat.userData && mat.userData.tile) || 0;
    if (s) { const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / s, uv.getY(k) * dims[f][1] / s); } }
    const m = sh(new THREE.Mesh(g, mat)); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); p.add(m); return m;
  }
  function rbx(p, x0, x1, y0, y1, z0, z1, mat, r = 0.035) {
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0); r = Math.max(0.004, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
    const a = w / 2, b = h / 2, s = new THREE.Shape();
    s.moveTo(-a + r, -b); s.lineTo(a - r, -b); s.absarc(a - r, -b + r, r, -Math.PI / 2, 0, false); s.lineTo(a, b - r); s.absarc(a - r, b - r, r, 0, Math.PI / 2, false);
    s.lineTo(-a + r, b); s.absarc(-a + r, b - r, r, Math.PI / 2, Math.PI, false); s.lineTo(-a, -b + r); s.absarc(-a + r, -b + r, r, Math.PI, Math.PI * 1.5, false);
    const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelOffset: -r, bevelSegments: 2, curveSegments: 3 }); g.translate(0, 0, -(d - 2 * r) / 2);
    const m = sh(new THREE.Mesh(g, mat)); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); p.add(m); return m;
  }
  const emisMat = (color, k = 1, map) => new THREE.MeshBasicMaterial({ color: col(color).multiplyScalar(k), map: map || null, fog: false });
  function plane(p, w, h, mat, x, y, z, ry = 0, rx = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0, 'YXZ'); p.add(m); return m; }
  function disc(p, geo, mat, x, y, z, ry = 0, rx = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0, 'YXZ'); p.add(m); return m; }
  function glow(p, x, y, z, color, size, opacity = 0.45) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.position.set(x, y, z); s.scale.setScalar(size); p.add(s); return s;
  }
  const contactMat = new THREE.MeshBasicMaterial({ map: T.contact, transparent: true, opacity: 0.8, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  function contact(p, x0, x1, z0, z1, y = 0.02, grow = 0.28) { const m = plane(p, Math.abs(x1 - x0) + grow * 2, Math.abs(z1 - z0) + grow * 2, contactMat, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, -Math.PI / 2); m.renderOrder = 1; return m; }
  // a whole plant is one mesh: its leaf cards are merged, so twenty plants cost twenty draws, not two hundred
  const leafMats = new Map();
  function plant(p, x, y, z, scale, map, count = 9, spread = 0.9, seed = 1, tint = 0xe4f0d4) {
    const r = makeRng(seed * 977 + 3), pos = [], uv = [], nor = [], h0 = new THREE.Object3D(), o = new THREE.Object3D(); h0.add(o);
    for (let i = 0; i < count; i++) {
      const h = scale * (0.7 + r() * 0.6), w = h * (map === T.fern ? 0.28 : 0.5), g = new THREE.PlaneGeometry(w, h).toNonIndexed(); g.translate(0, h / 2, 0);
      h0.rotation.y = i / count * Math.PI * 2 + r() * 0.5; o.rotation.x = spread * (0.35 + r() * 0.75); h0.updateMatrixWorld(true); g.applyMatrix4(o.matrixWorld);
      for (const v of g.attributes.position.array) pos.push(v); for (const v of g.attributes.uv.array) uv.push(v); for (const v of g.attributes.normal.array) nor.push(v); g.dispose();
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const key = map.uuid + tint; if (!leafMats.has(key)) leafMats.set(key, lam({ map, alphaTest: 0.5, side: THREE.DoubleSide, color: tint, emissive: 0x0c1a0a }));
    const m = sh(new THREE.Mesh(g, leafMats.get(key))); m.position.set(x, y, z); p.add(m); return m;
  }
  function pot(p, x, y, z, r = 0.34, h = 0.7, mat = M.bronze) { const m = sh(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.62, h, 20), mat)); m.position.set(x, y + h / 2, z); p.add(m); contact(p, x - r * 0.6, x + r * 0.6, z - r * 0.6, z + r * 0.6, y + 0.02, 0.3); return m; }
  function sconce(p, x, y, z, color = 0xffb060) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.42, 10), M.brass); c.position.set(x, y, z); p.add(c); glow(p, x, y + 0.34, z, color, 1.5, 0.3); glow(p, x, y - 0.34, z, color, 1.5, 0.3); }
  function pendant(p, x, y, z, r = 0.28, top = 3.4, color = 0xffc070) {
    const shade = new THREE.Mesh(new THREE.ConeGeometry(r, r * 0.55, 24, 1, true), M.brass); shade.position.set(x, y, z); p.add(shade);
    const mat = emisMat(color, 3.2); disc(p, new THREE.CircleGeometry(r * 0.85, 20), mat, x, y - r * 0.2, z, 0, Math.PI / 2);
    bx(p, x - 0.008, x + 0.008, y + r * 0.27, top, z - 0.008, z + 0.008, M.dark).castShadow = false; glow(p, x, y - 0.1, z, 0xffa850, 1.7, 0.11); return mat;
  }
  function door(p, hx, hz, width, height, yawClosed, sign, tint) {
    const pivot = new THREE.Group(); pivot.position.set(hx, 0, hz); pivot.rotation.y = yawClosed; p.add(pivot);
    const mat = M.timber.clone(); mat.color.set(tint); mat.userData = { tile: 1.5 }; bx(pivot, 0, width, 0.01, height, -0.035, 0.035, mat);
    for (const s of [-1, 1]) bx(pivot, width - 0.2, width - 0.14, 0.95, 1.55, s * 0.05, s * 0.09, M.brass);
    return { pivot, yawClosed, sign, angle: 0, target: 0, rest: 0, open: 1.45 };
  }
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  function hit(p, key, x0, x1, y0, y1, z0, z1, list) { const m = bx(p, x0, x1, y0, y1, z0, z1, hitMat); m.castShadow = m.receiveShadow = false; m.userData.hit = key; (list || W.hits).push(m); return m; }
  function rain(p, x0, x1, z0, z1, y0, y1, count, color) {
    const pos = new Float32Array(count * 6), r = makeRng(count), d = []; for (let i = 0; i < count; i++) d.push([x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), z0 + r() * (z1 - z0), 9 + r() * 5]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.42, fog: false })); m.frustumCulled = false; m.renderOrder = 20; p.add(m);
    return function (dt, speed) { for (let i = 0; i < count; i++) { const q = d[i]; q[1] -= q[3] * dt * speed; if (q[1] < y0) q[1] = y1; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1]; pos[i * 6 + 2] = q[2]; pos[i * 6 + 3] = q[0] + 0.02; pos[i * 6 + 4] = q[1] - 0.34; pos[i * 6 + 5] = q[2]; } g.attributes.position.needsUpdate = true; };
  }

  /* ---------- the five lights ---------- */
  const hemi = new THREE.HemisphereLight(0x2c3a70, 0x140c08, 0.5); scene.add(hemi);
  const spot = new THREE.SpotLight(0xffffff, 0, 12, 1.2, 1, 1.6); scene.add(spot); scene.add(spot.target);
  if (SHADOW) { spot.castShadow = true; spot.shadow.mapSize.set(SHADOW, SHADOW); spot.shadow.bias = -0.0008; spot.shadow.normalBias = 0.03; spot.shadow.camera.near = 0.25; spot.shadow.autoUpdate = false; }
  const pts = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
  let rig = null; const base = { spot: 0, pts: [0, 0, 0] }, tv = new THREE.Vector3(), tc = new THREE.Color();
  // rig = { hemi, spot: { p, t, c, i, a, d, k }, pts: [{ p, c, i, d }] } in world metres
  W.setRig = function (r) {
    if (r === rig) return; rig = r; W.shadowFrames = 40;
    spot.angle = r.spot.a || 1.2; spot.distance = r.spot.d == null ? 12 : r.spot.d; spot.decay = r.spot.k == null ? 1.6 : r.spot.k; if (SHADOW) spot.shadow.camera.far = spot.distance || 30;
    r.pts.forEach((q, i) => { pts[i].distance = q.d || 10; });
  };
  function driveLights(dt) {
    if (!rig) return; const k = Math.min(1, dt * 5);
    spot.position.lerp(tv.fromArray(rig.spot.p), k); spot.target.position.lerp(tv.fromArray(rig.spot.t), k); spot.color.lerp(tc.set(rig.spot.c), k);
    base.spot += (rig.spot.i - base.spot) * k; spot.intensity = base.spot * W.gain.spot; hemi.intensity += ((rig.hemi == null ? 0.5 : rig.hemi) - hemi.intensity) * k;
    for (let i = 0; i < 3; i++) { const q = rig.pts[i], l = pts[i]; if (q) { l.position.lerp(tv.fromArray(q.p), k); l.color.lerp(tc.set(q.c), k); } base.pts[i] += ((q ? q.i : 0) - base.pts[i]) * k; l.intensity = base.pts[i] * W.gain.pts[i]; }
    W.gain.spot = 1; W.gain.pts[0] = W.gain.pts[1] = W.gain.pts[2] = 1;
    if (SHADOW && W.shadowFrames > 0) { spot.shadow.needsUpdate = true; W.shadowFrames--; }
  }

  /* ---------- sky ---------- */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 20, 12), new THREE.MeshBasicMaterial({ map: T.sky, side: THREE.BackSide, fog: false, depthWrite: false })); sky.position.set(0, -6, 0); scene.add(sky);
  const moonMat = new THREE.SpriteMaterial({ map: T.moon, fog: false, depthWrite: false, transparent: true });

  /* ---------- outside (ground floor only) ---------- */
  const EXT = new THREE.Group(); scene.add(EXT);
  {
    const treeMat = new THREE.MeshBasicMaterial({ map: T.trees, transparent: true, alphaTest: 0.3, fog: false, side: THREE.DoubleSide });
    for (const [x, z, w, h, ry] of [[-19, -4, 26, 13, 0.35], [20, -6, 28, 14, -0.35], [-24, 14, 22, 11, 1.2], [25, 15, 22, 11, -1.2]]) plane(EXT, w, h, treeMat, x, h / 2 - 0.5, z, ry);
    bx(EXT, -18, 18, -0.75, -0.45, 6.9, 26, M.paving); bx(EXT, -30, -6.2, -0.74, -0.42, 4, 26, M.lawn); bx(EXT, 6.2, 30, -0.74, -0.42, 4, 26, M.lawn);
    bx(EXT, -3.4, 3.4, -0.5, 0, 4, 5.7, M.paving); bx(EXT, -3.4, 3.4, -0.5, -0.15, 5.7, 6.3, M.paving); bx(EXT, -3.4, 3.4, -0.5, -0.3, 6.3, 6.9, M.paving);
    for (const s of [-1, 1]) {
      bx(EXT, s * 3.4, s * 6.2, -0.5, 0.12, 4, 7.1, M.stone); glow(EXT, s * 3.3, -0.2, 6.15, 0xffa040, 1.5, 0.35);
      pot(EXT, s * 2.45, 0, 4.85, 0.36, 0.78); plant(EXT, s * 2.45, 0.7, 4.85, 1.25, T.leaf, 8, 0.8, 3 + s); plant(EXT, s * 4.8, 0.1, 5.6, 1.6, T.leaf, 10, 1.0, 5 + s); plant(EXT, s * 7.4, -0.4, 8.5, 1.9, T.fern, 12, 1.0, 8 + s);
      bx(EXT, s * 1.8, s * 3.4, 0, 3.6, 3.62, 4.0, M.stone); plane(EXT, 0.46, 2.9, emisMat(0xffffff, 1.1, T.grille), s * 2.06, 1.5, 4.012); plane(EXT, 9.2, 2.7, emisMat(0xffffff, 0.95, T.wing), s * 8.0, 1.5, 3.3);
      bx(EXT, s * 3.4, s * 12.8, -0.5, 0.15, 3.0, 3.4, M.stone); bx(EXT, s * 3.2, s * 13.2, 2.85, 3.15, 1.6, 4.6, M.concrete); glow(EXT, s * 8, 1.2, 4.4, 0xff9a40, 9, 0.08);
    }
    bx(EXT, -7.2, 7.2, 3.6, 3.95, 3.0, 7.3, M.concrete); bx(EXT, -9, 9, 3.95, 4.7, -3, 2.2, M.concrete);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 24, 1, true), M.brass); drum.position.set(0.2, 3.36, 5.5); EXT.add(drum);
    disc(EXT, new THREE.CircleGeometry(0.4, 20), emisMat(0xffc070, 3.4), 0.2, 3.25, 5.5, 0, Math.PI / 2); glow(EXT, 0.2, 3.2, 5.5, 0xffa850, 2.2, 0.13);
    W.extRain = rain(EXT, -11, 11, 7.5, 17, -0.4, 9, 260, 0x8fa6e0);
    W.rigOutside = { hemi: 0.42, spot: { p: [0.2, 3.12, 5.5], t: [0.2, 0, 6.1], c: 0xffb068, i: 46, a: 1.12, d: 14 }, pts: [{ p: [0, 0.6, 8.6], c: 0xff9440, i: 5, d: 9 }, { p: [-4.7, 0.45, 5.0], c: 0xffa25a, i: 7, d: 8 }, { p: [4.7, 0.45, 5.0], c: 0xffa25a, i: 7, d: 8 }] };
  }

  /* ---------- the corridor (one model, re-dressed per floor) ---------- */
  const COR = new THREE.Group(); scene.add(COR);
  const DW = 0.75; // half door width
  {
    bx(COR, -2.1, 2.1, -0.3, 0, -12.3, 4, M.floor); bx(COR, -2.1, 2.1, 3.4, 3.6, -12.3, 4, M.concrete);
    const runM = M.jute.clone(); runM.userData = { tile: 1.4 }; W.runner = bx(COR, -0.62, 0.62, 0, 0.012, -10.6, 2.6, runM);
    for (const s of [-1, 1]) { // side walls with an opening at each of that side's doors
      let z = 4; const x0 = s < 0 ? -2.1 : 1.8;
      for (const sl of PLAN.SLOTS.filter((q) => q.side === s)) {
        bx(COR, x0, x0 + 0.3, 0, 3.4, sl.z + DW, z, M.stone); bx(COR, x0, x0 + 0.3, 2.6, 3.4, sl.z - DW, sl.z + DW, M.stone);
        bx(COR, x0 - 0.02, x0 + 0.32, 0, 2.6, sl.z + DW, sl.z + DW + 0.07, M.timberDark); bx(COR, x0 - 0.02, x0 + 0.32, 0, 2.6, sl.z - DW - 0.07, sl.z - DW, M.timberDark); bx(COR, x0 - 0.02, x0 + 0.32, 2.6, 2.68, sl.z - DW - 0.07, sl.z + DW + 0.07, M.timberDark);
        z = sl.z - DW;
      }
      bx(COR, x0, x0 + 0.3, 0, 3.4, -12.3, z, M.stone);
      plane(COR, 15.4, 0.14, emisMat(0x1a2440, 0.3), s * 1.795, 3.26, -4, -s * Math.PI / 2);
    }
    bx(COR, -2.1, -0.8, 0, 3.4, -12.3, -12, M.stone); bx(COR, 0.8, 2.1, 0, 3.4, -12.3, -12, M.stone); bx(COR, -0.8, 0.8, 2.6, 3.4, -12.3, -12, M.stone);
    bx(COR, -0.87, -0.8, 0, 2.6, -12.32, -11.98, M.timberDark); bx(COR, 0.8, 0.87, 0, 2.6, -12.32, -11.98, M.timberDark); bx(COR, -0.87, 0.87, 2.6, 2.68, -12.32, -11.98, M.timberDark);
    pendant(COR, 0, 2.8, -0.6); pendant(COR, 0, 2.8, -5.2); pendant(COR, 0, 2.8, -10, 0.24);
    for (const [x, z] of [[-1.74, 2.2], [1.74, 2.2], [-1.3, -11.94], [1.3, -11.94]]) sconce(COR, x, 2.0, z);
    // five door leaves, a light strip under each (the colour of the room behind it), and a brass plaque beside it
    W.sills = []; W.plaques = [];
    PLAN.SLOTS.forEach((sl, k) => {
      const d = sl.side ? door(COR, sl.side * 1.84, sl.z - DW, DW * 2, 2.6, -Math.PI / 2, sl.side < 0 ? 1 : -1, 0xdcc8b0) : door(COR, 0.8, -12.04, 1.6, 2.6, Math.PI, 1, 0xdcc8b0); W.doors.push(d);
      const mat = emisMat(0xffffff, 1); if (sl.side) plane(COR, DW * 2, 0.05, mat, sl.side * 1.78, 0.03, sl.z, -sl.side * Math.PI / 2); else plane(COR, 1.6, 0.05, mat, 0, 0.03, -11.98, 0);
      const g = sl.side ? glow(COR, sl.side * 1.6, 0.25, sl.z, 0xffffff, 2.2, 0.3) : glow(COR, 0, 0.25, -11.8, 0xffffff, 2.2, 0.3);
      W.sills.push({ mat, glow: g, color: col(0xffffff), on: false });
      const pm = std({ metalness: 0.9, roughness: 0.34 }); W.plaques.push(sl.side ? plane(COR, 0.44, 0.22, pm, sl.side * 1.79, 1.5, sl.z + DW + 0.42, -sl.side * Math.PI / 2) : plane(COR, 0.44, 0.22, pm, -1.18, 1.5, -11.99, 0));
      if (sl.side) hit(COR, 'door:' + k, Math.min(sl.side * 1.2, sl.side * 2.3), Math.max(sl.side * 1.2, sl.side * 2.3), 0, 2.8, sl.z - 1, sl.z + 1); else hit(COR, 'door:' + k, -1.1, 1.1, 0, 2.8, -12.5, -11.3);
    });
    // lift: brass doors in the left wall near the entrance, with the floor shown above
    bx(COR, -1.81, -1.77, 0, 2.5, -1.2, -0.52, M.brass); bx(COR, -1.81, -1.77, 0, 2.5, -0.48, 0.2, M.brass); bx(COR, -1.83, -1.76, 0, 2.62, -1.3, -1.2, M.timberDark); bx(COR, -1.83, -1.76, 0, 2.62, 0.2, 0.3, M.timberDark); bx(COR, -1.83, -1.76, 2.5, 2.62, -1.3, 0.3, M.timberDark);
    W.liftSign = plane(COR, 0.5, 0.25, emisMat(0xffffff, 1.3), -1.75, 2.86, -0.5, Math.PI / 2); hit(COR, 'lift', -2.0, -1.5, 0, 2.7, -1.3, 0.3);
    // four framed pictures, each with a picture light
    W.frames = [[1, -2.6], [-1, -5.2], [1, -7.6], [-1, -10.3]].map(([s, z]) => {
      bx(COR, Math.min(s * 1.8, s * 1.75), Math.max(s * 1.8, s * 1.75), 1.22, 2.08, z - 0.58, z + 0.58, M.timberDark);
      const mat = new THREE.MeshBasicMaterial({ color: 0x1a1612 }), m = plane(COR, 1.0, 0.75, mat, s * 1.745, 1.65, z, -s * Math.PI / 2);
      bx(COR, s * 1.72 - 0.03, s * 1.72 + 0.03, 2.14, 2.17, z - 0.3, z + 0.3, M.brass); glow(COR, s * 1.6, 1.9, z, 0xffc890, 1.6, 0.16); return { mesh: m, mat, anim: null, t: 0 };
    });
    rbx(COR, 1.12, 1.72, 0.42, 0.5, -3.3, -1.9, M.timber, 0.02); bx(COR, 1.2, 1.66, 0, 0.42, -3.2, -2.95, M.timberDark); bx(COR, 1.2, 1.66, 0, 0.42, -2.25, -2.0, M.timberDark); contact(COR, 1.1, 1.75, -3.3, -1.9, 0.02, 0.2);
    pot(COR, 1.3, 0, 0.9, 0.3, 0.62); plant(COR, 1.3, 0.55, 0.9, 1.2, T.leaf, 8, 0.75, 21); pot(COR, -1.35, 0, -10.9, 0.24, 0.9, M.brass); plant(COR, -1.35, 0.85, -10.9, 0.8, T.fern, 7, 0.6, 23);
    // the front end: doors to the steps on the ground floor, a dusk window on the floors above
    const fl = door(COR, -1.5, 3.85, 1.6, 3.0, 0, 1, 0xd9c6b2), fr = door(COR, 1.5, 3.85, 1.4, 3.0, Math.PI, -1, 0xd9c6b2); fl.open = 1.4; fr.rest = 1.08; fr.open = 1.5; fr.angle = fr.target = 1.08; W.front = [fl, fr];
    W.window = plane(COR, 3.0, 3.05, emisMat(0xffffff, 0.5, T.forest), 0, 1.52, 3.86, Math.PI); for (const x of [-0.5, 0.5]) bx(W.window, x - 0.02, x + 0.02, -1.52, 1.52, 0.01, 0.05, M.dark);
    for (const s of [-1, 1]) { bx(COR, Math.min(s * 1.8, s * 2.1), Math.max(s * 1.8, s * 2.1), 0, 3.4, 3.7, 4.0, M.stone); bx(COR, Math.min(s * 1.5, s * 1.8), Math.max(s * 1.5, s * 1.8), 0, 3.05, 3.7, 4.0, M.timberDark); } bx(COR, -1.8, 1.8, 3.05, 3.4, 3.7, 4.0, M.timberDark);
    hit(COR, 'front', -1.9, 1.9, 0, 3.2, 3.5, 4.2);
    // the hidden plant, when the creator has put it in a corridor
    W.corEgg = new THREE.Group(); COR.add(W.corEgg); pot(W.corEgg, 1.35, 0, -11.1, 0.22, 0.5, M.bronze); plant(W.corEgg, 1.35, 0.45, -11.1, 0.9, T.ganja, 7, 0.5, 91, 0xffffff); glow(W.corEgg, 1.35, 0.9, -11.1, 0xc8ff9a, 1.5, 0.16); hit(W.corEgg, 'egg', 0.95, 1.75, 0, 1.6, -11.5, -10.7); W.corEgg.visible = false;
  }
  const hallRig = { hemi: 0.75, spot: { p: [0, 2.72, -5.2], t: [0, 0, -5.2], c: 0xffb26a, i: 36, a: 1.3, d: 8 }, pts: [{ p: [0, 2.5, -0.6], c: 0xffb068, i: 13, d: 8 }, { p: [0, 2.5, -10], c: 0xffa858, i: 11, d: 8 }, { p: [0, 1.2, -6], c: 0xffffff, i: 0, d: 5 }] };
  const plaqueCache = {};
  // Dress the corridor for a floor. info = { rooms: [{ index, title, color }] (up to five), frames: [{ tex, anim }], egg: bool }
  W.setFloor = function (f, info) {
    W.floor = f; W.window.visible = f !== 0; W.front.forEach((d) => { d.pivot.visible = f === 0; });
    W.runner.material.color.set([0x6f6a66, 0x5f6a70, 0x70625c, 0x646a5c][f % 4]);
    if (W.liftSign.material.map) W.liftSign.material.map.dispose(); W.liftSign.material.map = T.floorSign(f + 1, FLOORS); W.liftSign.material.needsUpdate = true;
    PLAN.SLOTS.forEach((sl, k) => {
      const r = info.rooms[k], on = !!r; W.doors[k].pivot.visible = W.plaques[k].visible = W.sills[k].glow.visible = on; W.sills[k].on = on;
      if (!on) { W.sills[k].mat.color.set(0x000000); return; } W.sills[k].color.set(r.color);
      if (!plaqueCache[r.index]) plaqueCache[r.index] = T.plaque(r.index + 1, r.title);
      const pm = W.plaques[k].material; pm.map = plaqueCache[r.index].map; pm.bumpMap = plaqueCache[r.index].bump; pm.bumpScale = 1.2; pm.needsUpdate = true;
    });
    W.frames.forEach((fr, k) => { const p = info.frames[k]; fr.mesh.visible = !!p; if (!p) return; fr.mat.map = p.tex; fr.mat.color.set(0xd8d0c8); fr.anim = p.anim || null; fr.t = 0; fr.mat.needsUpdate = true; });
    W.corEgg.visible = !!info.egg; W.shadowFrames = 6;
  };

  /* ---------- rooms ---------- */
  // A is what the room hears this frame: { on, level, bass, mid, high, kick, snare, hat, hit, bands[16], red, t }
  function shell(R, wallM, floorM, ceilM, sideH) {
    const g = R.g, w = R.W, d = R.D, h = R.H, hs = sideH || h;
    bx(g, -w / 2, w / 2, -0.3, 0, -d, 0, floorM); if (ceilM) bx(g, -w / 2, w / 2, h, h + 0.2, -d, 0, ceilM);
    bx(g, -w / 2 - 0.3, -w / 2, 0, hs, -d, 0, wallM); bx(g, w / 2, w / 2 + 0.3, 0, hs, -d, 0, wallM); if (!R.openFar) bx(g, -w / 2, w / 2, 0, hs, -d - 0.3, -d, wallM);
    bx(g, -w / 2 - 0.3, -DW - 0.03, 0, h, -0.14, -0.02, wallM); bx(g, DW + 0.03, w / 2 + 0.3, 0, h, -0.14, -0.02, wallM); bx(g, -DW - 0.03, DW + 0.03, 2.6, h, -0.14, -0.02, wallM);
  }
  const own = (R, m) => { R.own.push(m); return m; };
  const tint = (R, m, hex) => { const c = m.clone(); c.color.set(hex); c.userData = m.userData; return own(R, c); };
  const ARCH = {
    den(R) {
      R.W = R.v ? 7 : 7.8; R.D = 7.4; R.H = 3; const g = R.g, D = R.D, wall = R.v ? tint(R, M.concrete, 0x9a8a8a) : M.concrete;
      shell(R, wall, M.floor, M.timberDark);
      const bm = own(R, lam({ emissive: R.c.clone().lerp(col(0xffffff), 0.35), emissiveIntensity: 0.6 })), tb = own(R, T.block.clone()), tg = own(R, T.blockGlow.clone()); tb.repeat.set(9, 3.4); tg.repeat.set(9, 3.4); tb.needsUpdate = tg.needsUpdate = true; bm.map = tb; bm.emissiveMap = tg;
      plane(g, R.W - 1.2, 2.5, bm, 0, 1.55, -D + 0.02);
      rbx(g, -1.05, 1.05, 0.12, 0.95, -D + 0.1, -D + 0.6, M.timber, 0.02); plane(g, 1.96, 0.66, own(R, lam({ map: T.spines })), 0, 0.54, -D + 0.605); contact(g, -1.05, 1.05, -D + 0.1, -D + 0.6);
      const cones = [];
      for (const x of [-1.62, 1.62]) {
        rbx(g, x - 0.27, x + 0.27, 0, 1.25, -D + 0.1, -D + 0.55, M.timber, 0.025); contact(g, x - 0.27, x + 0.27, -D + 0.1, -D + 0.55);
        for (const [y, r] of [[0.42, 0.19], [0.92, 0.11]]) { const c = disc(g, new THREE.CircleGeometry(r, 24), M.dark, x, y, -D + 0.555); disc(g, new THREE.RingGeometry(r, r * 1.16, 24), M.brass, x, y, -D + 0.552); if (r > 0.15) cones.push(c); }
      }
      bx(g, -2.3, 2.3, 0, 0.015, -D + 1.3, -D + 5, M.rug);
      rbx(g, -R.W / 2 + 0.1, -R.W / 2 + 1.0, 0.12, 0.42, -5.4, -2.6, M.sofa, 0.06); rbx(g, -R.W / 2 + 0.1, -R.W / 2 + 0.36, 0.4, 0.9, -5.4, -2.6, M.sofa, 0.09); contact(g, -R.W / 2 + 0.1, -R.W / 2 + 1.0, -5.4, -2.6);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.48, 0.4, 16), M.timber); st.position.set(2.3, 0.2, -4.4); g.add(st); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.brass); dome.position.set(2.3, 0.66, -4.4); g.add(dome);
      const lampG = glow(g, 2.3, 0.62, -4.4, R.c, 1.8, 0.35);
      R.rig = { hemi: 0.5, spot: { p: [0, 2.95, -4], t: [0, 0, -4], c: 0xffb070, i: 22, a: 1.05, d: 9 }, pts: [{ p: [2.3, 0.95, -4.3], c: R.c.getHex(), i: 8, d: 8 }, { p: [0, 1.9, -D + 1.2], c: R.c.getHex(), i: 7, d: 8 }] };
      R.fx = (dt, A) => { for (const c of cones) c.position.z = -D + 0.555 + A.kick * 0.05; bm.emissiveIntensity = 0.5 + A.level * 0.45 + A.bass * 0.8; lampG.material.opacity = 0.25 + A.level * 0.25; W.gain.pts[0] = 0.8 + A.level * 0.8; W.gain.pts[1] = 0.7 + A.bass * 1.3; };
    },
    rain(R) {
      R.W = 8; R.D = 9; R.H = 4.4; R.openFar = true; const g = R.g, D = R.D, w = R.W;
      const wet = own(R, M.paving.clone()); wet.color.set(R.v ? 0x8a80b8 : 0x7f8fb8); wet.userData = { tile: 2.6 }; if (opts.coolEnv) { wet.envMap = opts.coolEnv; wet.envMapIntensity = 0.9; }
      shell(R, M.concrete, wet, M.concrete);
      const forest = own(R, emisMat(0xffffff, 1.2, T.forest)); plane(g, 22, 9, forest, 0, 3.6, -D - 4);
      const rg = own(R, T.rainGlass.clone()); rg.repeat.set(3, 1.4); rg.needsUpdate = true;
      plane(g, w, R.H, own(R, std({ color: 0x1c2f66, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false })), 0, R.H / 2, -D); plane(g, w, R.H, own(R, new THREE.MeshBasicMaterial({ map: rg, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })), 0, R.H / 2, -D + 0.01);
      for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 4) bx(g, x - 0.05, x + 0.05, 0, R.H, -D - 0.06, -D + 0.06, M.dark);
      const fall = rain(g, -w / 2, w / 2, -D - 3.2, -D - 0.4, 0, 6, 150, 0x9ab8ff);
      const stx = own(R, T.streaks.clone()); stx.repeat.set(2, 1.2); stx.needsUpdate = true; const sm = own(R, new THREE.MeshBasicMaterial({ map: stx, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); plane(g, D - 1, w - 1, sm, 0, 0.012, -D / 2, Math.PI / 2, -Math.PI / 2);
      const dg = new THREE.PlaneGeometry(1, 1, 24, 4), drape = new THREE.Mesh(dg, own(R, new THREE.MeshBasicMaterial({ map: T.fabric, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, color: R.c }))); drape.frustumCulled = false; g.add(drape);
      const ledge = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.34, 28), M.concrete); ledge.position.set(-2.3, 0.17, -D + 1.6); g.add(ledge); const lan = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), own(R, emisMat(0xffc98a, 2.2))); lan.position.set(-2.3, 0.62, -D + 1.6); g.add(lan); glow(g, -2.3, 0.7, -D + 1.6, 0xffb060, 2.2, 0.3);
      R.rig = { hemi: 0.5, spot: { p: [0, 4.3, -5], t: [0, 0, -5], c: R.c.getHex(), i: 40, a: 1.2, d: 14 }, pts: [{ p: [-2.3, 1.0, -D + 1.9], c: 0xffa860, i: 1.4, d: 5 }] };
      let lv = 0.15, bolt = 0; R.notePos = [1.4, 1.55, -D + 0.05, 0];
      R.fx = (dt, A) => {
        lv += ((A.on ? 0.1 + 0.9 * A.mid : 0.15) - lv) * Math.min(1, dt * 2.2); const sp = A.red ? 0.25 : 1, amp = (0.05 + lv * 0.32) * sp, p = dg.attributes.position;
        for (let iy = 0; iy <= 4; iy++) for (let ix = 0; ix <= 24; ix++) { const u = ix / 24, v = iy / 4, pin = Math.sin(Math.PI * u); p.setXYZ(iy * 25 + ix, -w / 2 + u * w, R.H - 0.1 - 1.3 * pin - 0.2 * Math.sin(v * Math.PI) * pin + amp * pin * Math.sin(A.t * 0.9 * sp + u * 6 + v * 2.2), -5.6 + (v - 0.5) * 3 + amp * 0.6 * pin * Math.cos(A.t * 0.7 * sp + u * 5)); }
        p.needsUpdate = true; stx.offset.y -= dt * (0.02 + lv * 0.1) * sp; sm.opacity = 0.2 + lv * 0.4 + A.high * 0.25; rg.offset.y += dt * (0.03 + lv * 0.05) * sp; fall(dt, (A.red ? 0.15 : 1) * (0.8 + lv * (R.v ? 1.2 : 0.5)));
        if (R.v && A.snare > 0.9 && !A.red) bolt = 1; bolt = Math.max(0, bolt - dt * 5); forest.color.setScalar(1.2 + bolt * 2.2); W.gain.spot = 0.8 + lv * 0.6 + (A.red ? 0 : A.kick * 0.45) + bolt * 0.8;
      };
    },
    court(R) {
      R.W = 11; R.D = 12.5; R.H = 4.4; const g = R.g, D = R.D, cz = -6.9;
      shell(R, M.stone, M.paving, null);
      const s = new THREE.Shape(); s.moveTo(-5.8, -(D + cz) - 0.3); s.lineTo(5.8, -(D + cz) - 0.3); s.lineTo(5.8, -cz); s.lineTo(-5.8, -cz); s.closePath(); const hole = new THREE.Path(); hole.absarc(0, 0, 3.1, 0, Math.PI * 2, true); s.holes.push(hole);
      const roofM = own(R, lam({ color: 0x6a645e, side: THREE.DoubleSide })), roof = sh(new THREE.Mesh(new THREE.ShapeGeometry(s, 36), roofM)); roof.rotation.x = Math.PI / 2; roof.position.set(0, 4.4, cz); g.add(roof);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.7, 40, 1, true), roofM); rim.position.set(0, 4.75, cz); g.add(rim);
      disc(g, new THREE.CircleGeometry(2.3, 44), own(R, std({ color: R.v ? 0x1a0806 : 0x0a1814, roughness: 0.03, metalness: 0.7, envMap: opts.coolEnv || null, envMapIntensity: 1.4 })), 0, 0.03, cz, 0, -Math.PI / 2);
      disc(g, new THREE.RingGeometry(2.3, 2.62, 44), M.concrete, 0, 0.035, cz, 0, -Math.PI / 2);
      const rings = []; for (let i = 0; i < 5; i++) { const r = disc(g, new THREE.RingGeometry(0.96, 1, 48), own(R, new THREE.MeshBasicMaterial({ color: R.v ? 0xffc0a0 : 0xbfd8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })), 0, 0.045, cz, 0, -Math.PI / 2); r.userData = { age: 9, life: 4, max: 2.2 }; rings.push(r); }
      const ups = []; let seed = 40;
      for (let a = 0; a < 12; a++) { const ang = a / 12 * Math.PI * 2 + 0.2, rad = 4.3 + (a % 3) * 0.35, x = Math.cos(ang) * rad, z = cz + Math.sin(ang) * rad; if (Math.abs(x) > 5.2 || z > -1.2 || z < -D + 0.5 || (Math.abs(x) < 2.4 && z > -4.6)) continue; plant(g, x, 0, z, 1.3 + (a % 4) * 0.35, a % 3 ? T.fern : T.leaf, 9, 1.0, seed++); if (a % 2) ups.push(glow(g, x * 0.93, 0.25, cz + (z - cz) * 0.93, R.v ? 0xff5030 : 0xffb050, 1.1, 0.2)); }
      for (let a = 0; a < 6; a++) { const ang = a / 6 * Math.PI * 2, v = plant(g, Math.cos(ang) * 3.0, 4.42, cz + Math.sin(ang) * 3.0, 1.1, T.fern, 3, 0.3, seed++); v.rotation.x = Math.PI; }
      const moon = new THREE.Sprite(moonMat); moon.position.set(1.2, 38, cz - 62); moon.scale.setScalar(9); g.add(moon);
      bx(g, 3.3, 5.0, 0.4, 0.5, -5.3, -3.1, M.concrete); bx(g, 3.5, 4.8, 0, 0.4, -5.1, -4.8, M.stone); bx(g, 3.5, 4.8, 0, 0.4, -3.6, -3.3, M.stone);
      R.rig = { hemi: 0.5, spot: { p: [1.6, 17, cz - 4.5], t: [0, 0, cz], c: R.v ? 0xffc8b4 : 0xb4c8ff, i: 15, a: 0.4, d: 0, k: 0 }, pts: [{ p: [0, 2.6, cz], c: R.v ? 0xd07f70 : 0x7f9ad0, i: 16, d: 14 }, { p: [-4.3, 2.4, -3.9], c: R.c.getHex(), i: 12, d: 11 }] };
      let clock = 0, calm = 0; R.notePos = [5.48, 1.6, -7.5, -Math.PI / 2];
      const spawn = (max, life) => { const r = rings.find((q) => q.userData.age >= q.userData.life); if (r) r.userData = { age: 0, life, max }; };
      R.fx = (dt, A) => {
        calm += ((A.on && A.level < 0.42 ? 1 : 0) - calm) * Math.min(1, dt * 0.8); clock += dt;
        if (A.on ? (A.hit && calm < 0.5 && clock > 0.65) : clock > 9) { clock = 0; spawn(1.1 + A.bass * 1.1, 3.4); }
        for (const r of rings) { const d = r.userData; if (d.age < d.life) { d.age += dt * (A.red ? 0.5 : 1); const q = Math.min(1, d.age / d.life); r.scale.setScalar(0.15 + q * d.max); r.material.opacity = (A.red ? 0.2 : 0.42) * (1 - q); } else r.material.opacity = 0; }
        for (const u of ups) u.material.opacity = 0.16 + A.bass * 0.3 * (A.red ? 0.4 : 1); W.gain.spot = 1 + calm * 0.7; W.gain.pts[1] = 0.7 + A.level * 0.9;
      };
    },
    eq(R) {
      R.W = 7; R.D = 7.5; R.H = 3.4; const g = R.g, D = R.D, wall = tint(R, M.concrete, 0x3a3634);
      shell(R, wall, M.floor, wall);
      const COLS = 16, ROWS = 9, cw = 0.38, ch = 0.27, inst = new THREE.InstancedMesh(new THREE.BoxGeometry(cw * 0.8, ch * 0.72, 0.05), own(R, new THREE.MeshBasicMaterial({ fog: false })), COLS * ROWS), o = new THREE.Object3D(), c = new THREE.Color();
      for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) { o.position.set((x - (COLS - 1) / 2) * cw, 0.45 + y * ch, -D + 0.06); o.updateMatrix(); inst.setMatrixAt(x * ROWS + y, o.matrix); inst.setColorAt(x * ROWS + y, c.copy(R.c).multiplyScalar(0.035)); }
      g.add(inst); rbx(g, -1.2, 1.2, 0.3, 0.45, -4.6, -4.0, M.timberDark, 0.03); bx(g, -1.1, -0.9, 0, 0.3, -4.5, -4.1, M.dark); bx(g, 0.9, 1.1, 0, 0.3, -4.5, -4.1, M.dark); contact(g, -1.2, 1.2, -4.6, -4.0);
      const top = R.c.clone().lerp(col(0xffffff), 0.6), peak = new Float32Array(COLS); R.notePos = [R.W / 2 - 0.02, 1.6, -4.6, -Math.PI / 2];
      R.rig = { hemi: 0.35, spot: { p: [0, 3.2, -3.6], t: [0, 0, -3.6], c: R.c.getHex(), i: 8, a: 1.1, d: 9 }, pts: [{ p: [0, 1.6, -D + 1.3], c: R.c.getHex(), i: 8, d: 10 }] };
      R.fx = (dt, A) => {
        for (let x = 0; x < COLS; x++) { const h = A.bands[x] * ROWS; peak[x] = Math.max(h, peak[x] - dt * 5); for (let y = 0; y < ROWS; y++) { if (y < h) c.copy(R.c).lerp(top, y / ROWS).multiplyScalar(1.1 + y / ROWS * 1.6); else if (peak[x] > 0.6 && Math.abs(y - peak[x]) < 0.6) c.copy(top).multiplyScalar(0.8); else c.copy(R.c).multiplyScalar(0.035); inst.setColorAt(x * ROWS + y, c); } }
        inst.instanceColor.needsUpdate = true; W.gain.pts[0] = 0.4 + A.level * 1.2 + A.kick * 1.2; W.gain.spot = 0.6 + A.level;
      };
    },
    orb(R) {
      R.W = 7; R.D = 7.5; R.H = 3.6; const g = R.g, wall = tint(R, M.concrete, R.v ? 0x8a94a8 : 0xb8ac98);
      shell(R, wall, M.floor, wall);
      const om = own(R, lam({ color: 0x8a8580, emissive: R.c, emissiveIntensity: 0.6 })), orb = new THREE.Mesh(new THREE.SphereGeometry(0.72, 32, 20), om); orb.position.set(0, 1.5, -5.2); g.add(orb); const halo = glow(g, 0, 1.5, -5.2, R.c, 4.2, 0.3);
      const rings = []; for (let i = 0; i < 5; i++) rings.push(disc(g, new THREE.RingGeometry(1.0 + i * 0.5, 1.08 + i * 0.5, 56), own(R, emisMat(R.c, 0.1)), 0, 0.02, -5.2, 0, -Math.PI / 2));
      for (const x of [-2.6, 2.6]) { const cu = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 24), M.cream); cu.position.set(x, 0.12, -3.6); g.add(cu); contact(g, x - 0.4, x + 0.4, -4.0, -3.2, 0.02, 0.2); }
      R.rig = { hemi: 0.42, spot: { p: [0, 3.4, -3.4], t: [0, 0, -5.0], c: 0xfff0dc, i: 10, a: 1.1, d: 9 }, pts: [{ p: [0, 1.5, -3.6], c: R.c.getHex(), i: 12, d: 10 }] };
      let wave = 9, sc = 1;
      R.fx = (dt, A) => {
        if (A.hit) wave = 0; wave += dt * (A.red ? 3 : 7); sc += ((1 + A.level * 0.1 + (A.red ? 0 : A.kick * 0.09)) - sc) * Math.min(1, dt * 12); orb.scale.setScalar(sc);
        om.emissiveIntensity = 0.5 + A.level * 0.7 + A.kick * 0.6; halo.material.opacity = 0.2 + A.level * 0.25; halo.scale.setScalar(4 + A.bass * 1.5);
        rings.forEach((r, i) => r.material.color.copy(R.c).multiplyScalar(0.08 + 2.2 * Math.exp(-(i - wave) * (i - wave) * 2.5))); W.gain.pts[0] = 0.5 + A.level * 1.1 + A.kick * 0.8;
      };
    },
    bar(R) {
      R.W = 8; R.D = 7; R.H = 3.2; const g = R.g, D = R.D;
      shell(R, M.timberDark, M.floor, M.timberDark);
      const back = own(R, emisMat(0xffffff, 1.1, T.bottles)); plane(g, 5.8, 1.7, back, 0, 1.95, -D + 0.03);
      rbx(g, -2.9, 2.9, 0, 1.05, -D + 1.5, -D + 2.2, M.timber, 0.03); bx(g, -2.95, 2.95, 1.05, 1.09, -D + 1.45, -D + 2.25, M.brass); contact(g, -2.9, 2.9, -D + 1.5, -D + 2.2);
      for (const x of [-2.1, -0.7, 0.7, 2.1]) { const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 18), M.sofa); seat.position.set(x, 0.74, -D + 2.85); g.add(seat); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 8), M.brass); leg.position.set(x, 0.36, -D + 2.85); g.add(leg); contact(g, x - 0.15, x + 0.15, -D + 2.7, -D + 3.0, 0.02, 0.18); }
      const lamps = [-2.2, -1.1, 0, 1.1, 2.2].map((x) => own(R, pendant(g, x, 2.25, -D + 1.85, 0.17, R.H, R.c.getHex()))), bc = R.c.clone().lerp(col(0xffffff), 0.5);
      R.rig = { hemi: 0.42, spot: { p: [0, 2.9, -D + 2.4], t: [0, 0, -D + 2.4], c: 0xffc080, i: 20, a: 1.15, d: 9 }, pts: [{ p: [0, 1.9, -D + 0.9], c: R.c.getHex(), i: 9, d: 9 }] };
      R.fx = (dt, A) => { lamps.forEach((m, i) => m.color.copy(R.c).multiplyScalar(0.9 + A.bands[1 + i * 3] * 4.5)); back.color.copy(bc).multiplyScalar(0.8 + A.level * 0.5 + A.kick * 0.5); W.gain.pts[0] = 0.6 + A.level * 0.8 + A.kick * 0.7; };
    },
    neon(R) {
      R.W = 7; R.D = 7; R.H = 3.2; const g = R.g, D = R.D, wall = tint(R, M.concrete, 0x2c2a2e), c2 = R.c.clone().offsetHSL(0.42, 0, 0);
      shell(R, wall, M.floor, wall);
      const tubes = [-2.4, -1.6, -0.8, 0.8, 1.6, 2.4].map((x, i) => { const m = own(R, emisMat(i % 2 ? c2 : R.c, 1)), h = 1.2 + ((i * 7) % 5) * 0.28; bx(g, x - 0.025, x + 0.025, 0.5, 0.5 + h, -D + 0.05, -D + 0.1, m).castShadow = false; return m; });
      const rm = own(R, emisMat(R.c, 1.5)), ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 8, 48), rm); ring.position.set(0, 1.75, -D + 0.1); g.add(ring); const halo = glow(g, 0, 1.75, -D + 0.3, R.c, 3, 0.25);
      rbx(g, -1.5, 1.5, 0.7, 0.76, -D + 1.3, -D + 2.1, M.timberDark, 0.02); bx(g, -1.4, -1.3, 0, 0.7, -D + 1.4, -D + 2.0, M.dark); bx(g, 1.3, 1.4, 0, 0.7, -D + 1.4, -D + 2.0, M.dark); contact(g, -1.5, 1.5, -D + 1.3, -D + 2.1);
      const cones = [-1.05, 1.05].map((x) => { rbx(g, x - 0.17, x + 0.17, 0.76, 1.22, -D + 1.4, -D + 1.75, M.dark, 0.02); return disc(g, new THREE.CircleGeometry(0.11, 20), own(R, lam({ color: 0x2a2a2a })), x, 0.98, -D + 1.76); });
      R.rig = { hemi: 0.3, spot: { p: [0, 3.0, -3.6], t: [0, 0, -4.2], c: 0xd8d0ff, i: 6, a: 1.1, d: 9 }, pts: [{ p: [0, 1.6, -D + 1.0], c: R.c.getHex(), i: 9, d: 9 }, { p: [-2.4, 1.2, -D + 1.4], c: c2.getHex(), i: 6, d: 7 }] };
      R.fx = (dt, A) => { tubes.forEach((m, i) => m.color.copy(i % 2 ? c2 : R.c).multiplyScalar(0.35 + A.bands[2 + i * 2] * 3.6)); rm.color.copy(R.c).multiplyScalar(0.8 + A.kick * 3); ring.scale.setScalar(1 + (A.red ? 0 : A.kick * 0.12)); halo.material.opacity = 0.15 + A.kick * 0.3; for (const c of cones) c.position.z = -D + 1.76 + A.kick * 0.03; W.gain.pts[0] = 0.5 + A.level + A.kick; W.gain.pts[1] = 0.4 + A.high * 1.6 + A.snare; };
    },
    fire(R) {
      R.W = 7; R.D = 7; R.H = 3.3; const g = R.g, D = R.D, w = R.W, bt = own(R, T.spines.clone()); bt.repeat.set(3, 4); bt.needsUpdate = true; const books = own(R, lam({ map: bt }));
      shell(R, M.timberDark, M.floor, M.timberDark);
      for (const s of [-1, 1]) plane(g, D - 0.6, 2.6, books, s * (w / 2 - 0.02), 1.4, -D / 2, -s * Math.PI / 2);
      bx(g, -w / 2, w / 2, 0, R.H, -D, -D + 0.25, M.stone); bx(g, -0.95, 0.95, 0, 1.15, -D + 0.2, -D + 0.3, M.dark); rbx(g, -1.3, 1.3, 1.2, 1.32, -D + 0.2, -D + 0.5, M.timber, 0.02);
      const flames = [0, 1, 2].map((i) => { const s = new THREE.Sprite(own(R, new THREE.SpriteMaterial({ map: T.glow, color: i ? R.c : R.c.clone().lerp(col(0xffffff), 0.5), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))); s.position.set((i - 1) * 0.36, 0.4, -D + 0.42); g.add(s); return s; });
      bx(g, -1.9, 1.9, 0, 0.015, -D + 1.0, -D + 4.2, M.rug);
      for (const s of [-1, 1]) { rbx(g, s * 1.2 - 0.45, s * 1.2 + 0.45, 0.14, 0.46, -D + 2.2, -D + 3.1, M.sofa, 0.07); rbx(g, s * 1.2 - 0.45, s * 1.2 + 0.45, 0.44, 0.98, -D + 2.95, -D + 3.15, M.sofa, 0.08); contact(g, s * 1.2 - 0.45, s * 1.2 + 0.45, -D + 2.2, -D + 3.15); }
      R.rig = { hemi: 0.36, spot: { p: [0, 3.1, -3.4], t: [0, 0, -4], c: 0xffc890, i: 7, a: 1.1, d: 9 }, pts: [{ p: [0, 0.7, -D + 1.1], c: R.c.getHex(), i: 15, d: 9 }] };
      let fl = 0.5;
      R.fx = (dt, A) => { const n = 0.5 + 0.5 * Math.sin(A.t * 9.1) * Math.sin(A.t * 5.3 + 1); fl += ((0.45 + n * (A.red ? 0.1 : 0.3) + A.bass * 0.7) - fl) * Math.min(1, dt * 14); flames.forEach((s, i) => { s.scale.set(0.7 + fl * 0.35, 0.8 + fl * (1.1 + i * 0.25) + A.kick * 0.5, 1); s.position.y = 0.25 + s.scale.y * 0.32; s.material.opacity = 0.5 + fl * 0.4; }); W.gain.pts[0] = 0.5 + fl * 0.9; };
    },
    pool(R) {
      R.W = 8; R.D = 9; R.H = 3.6; const g = R.g, D = R.D, w = R.W, wall = tint(R, M.concrete, R.v ? 0x6a5248 : 0x4a6064);
      shell(R, wall, M.paving, wall);
      const under = own(R, emisMat(R.c, 0.5)); plane(g, 4.8, 4.6, under, 0, 0.012, -5.8, 0, -Math.PI / 2);
      plane(g, 4.8, 4.6, own(R, std({ color: R.c.clone().multiplyScalar(0.12), roughness: 0.04, metalness: 0.6, envMap: opts.coolEnv || null, envMapIntensity: 1.2, transparent: true, opacity: 0.8, depthWrite: false })), 0, 0.03, -5.8, 0, -Math.PI / 2);
      bx(g, -2.55, 2.55, 0, 0.06, -8.25, -8.1, M.concrete); bx(g, -2.55, 2.55, 0, 0.06, -3.5, -3.35, M.concrete); bx(g, -2.55, -2.4, 0, 0.06, -8.1, -3.5, M.concrete); bx(g, 2.4, 2.55, 0, 0.06, -8.1, -3.5, M.concrete);
      const c1 = own(R, T.caustic.clone()), c2 = own(R, T.caustic.clone()); c1.repeat.set(3, 1.4); c2.repeat.set(2.2, 2.2); c1.needsUpdate = c2.needsUpdate = true;
      const cm1 = own(R, new THREE.MeshBasicMaterial({ map: c1, color: R.c, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })), cm2 = own(R, cm1.clone()); cm2.map = c2;
      plane(g, w, R.H, cm1, 0, R.H / 2, -D + 0.02); plane(g, w, D, cm2, 0, R.H - 0.02, -D / 2, 0, Math.PI / 2); for (const s of [-1, 1]) plane(g, D, R.H, cm1, s * (w / 2 - 0.02), R.H / 2, -D / 2, -s * Math.PI / 2);
      for (const x of [-3.2, 3.2]) for (const z of [-7.6, -4.2]) { const co = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, R.H, 16), M.concrete)); co.position.set(x, R.H / 2, z); g.add(co); }
      R.rig = { hemi: 0.4, spot: { p: [0, 3.4, -3.2], t: [0, 0, -4], c: 0xf0f4ff, i: 5, a: 1.1, d: 9 }, pts: [{ p: [0, 1.0, -5.8], c: R.c.getHex(), i: 12, d: 11 }] };
      R.fx = (dt, A) => { const sp = (A.red ? 0.2 : 1) * (0.035 + A.mid * 0.09); c1.offset.x += dt * sp; c1.offset.y += dt * sp * 0.6; c2.offset.x -= dt * sp * 0.7; c2.offset.y += dt * sp; cm1.opacity = 0.42 + A.level * 0.35 + A.kick * 0.2; cm2.opacity = 0.3 + A.high * 0.4; under.color.copy(R.c).multiplyScalar(0.3 + A.bass * 0.9 + A.kick * 0.5); W.gain.pts[0] = 0.5 + A.level * 0.8 + A.kick * 0.6; };
    },
    terrace(R) {
      R.W = 9; R.D = 9; R.H = 3.2; R.openFar = true; const g = R.g, D = R.D, w = R.W;
      shell(R, M.stone, M.paving, null, 1.05); bx(g, -w / 2, w / 2, 0, 1.05, -D - 0.3, -D, M.stone);
      plane(g, 44, 13, own(R, new THREE.MeshBasicMaterial({ map: T.trees, transparent: true, alphaTest: 0.3, fog: false })), 0, 4, -D - 14);
      const moon = new THREE.Sprite(moonMat); moon.position.set(-9, 30, -D - 60); moon.scale.setScalar(9); g.add(moon);
      const N = 30, inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), own(R, new THREE.MeshBasicMaterial({ fog: false })), N), o = new THREE.Object3D(), c = new THREE.Color();
      for (let i = 0; i < N; i++) { const row = i % 2, u = (i >> 1) / (N / 2 - 1); o.position.set(-w / 2 + 0.3 + u * (w - 0.6), 2.75 - Math.sin(Math.PI * u) * 0.55, row ? -2.6 : -6.6); o.updateMatrix(); inst.setMatrixAt(i, o.matrix); inst.setColorAt(i, c.set(0x332211)); }
      inst.frustumCulled = false; g.add(inst); for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) for (const z of [-2.6, -6.6]) bx(g, x - 0.03, x + 0.03, 0, 2.8, z - 0.03, z + 0.03, M.dark);
      for (const x of [-1.6, 1.6]) { rbx(g, x - 0.45, x + 0.45, 0.2, 0.36, -6.2, -4.2, M.cream, 0.05); rbx(g, x - 0.45, x + 0.45, 0.3, 0.8, -4.45, -4.2, M.cream, 0.06); contact(g, x - 0.45, x + 0.45, -6.2, -4.2); }
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.36, 0.3, 20), M.bronze); bowl.position.set(0, 0.15, -7.4); g.add(bowl); const ember = glow(g, 0, 0.5, -7.4, R.c, 1.4, 0.5);
      pot(g, -3.6, 0, -8.2, 0.34, 0.7); plant(g, -3.6, 0.65, -8.2, 1.4, T.leaf, 8, 0.8, 61); pot(g, 3.6, 0, -8.2, 0.34, 0.7); plant(g, 3.6, 0.65, -8.2, 1.5, T.fern, 9, 0.8, 63);
      R.rig = { hemi: 0.6, spot: { p: [-3, 16, -D - 6], t: [0, 0, -4.6], c: 0xb4c8ff, i: 5, a: 0.5, d: 0, k: 0 }, pts: [{ p: [0, 2.3, -4.6], c: R.c.getHex(), i: 12, d: 10 }, { p: [0, 0.7, -7.4], c: R.c.getHex(), i: 5, d: 6 }] };
      R.notePos = [w / 2 - 0.02, 0.62, -3.4, -Math.PI / 2];
      R.fx = (dt, A) => { for (let i = 0; i < N; i++) { const tw = A.red ? 0 : A.hat * (((i * 7 + (A.t * 12 | 0)) % 5) === 0 ? 3 : 0); inst.setColorAt(i, c.copy(R.c).multiplyScalar(0.7 + A.bands[(i * 5) % 16] * 3.2 + tw)); } inst.instanceColor.needsUpdate = true; ember.material.opacity = 0.35 + A.bass * 0.45; ember.scale.setScalar(1.2 + A.kick * 0.7); W.gain.pts[0] = 0.6 + A.level * 0.8; W.gain.pts[1] = 0.5 + A.bass * 1.5; };
    },
  };

  // Build (once) and show room `index` behind door `slot`. extra = { note: {title,text}, screen: {title,label}, egg: bool }
  W.showRoom = function (index, slot, extra = {}) {
    let R = W.rooms[index]; if (R) return R;
    const def = ROOM_DEFS[index % ROOM_DEFS.length], geo = slotGeo(slot);
    R = W.rooms[index] = { index, slot, g: new THREE.Group(), own: [], hits: [], c: col(def.c), v: def.v || 0, fx: () => {} };
    R.g.position.fromArray(geo.origin); R.g.rotation.y = geo.rot; scene.add(R.g);
    ARCH[def.a](R);
    R.rig.hemi = (R.rig.hemi || 0.5) * 2.1; if (R.rig.spot.k !== 0) R.rig.spot.i *= 1.7; R.rig.pts.forEach((q) => { q.i *= 1.35; });
    const loc = (p) => roomPoint(slot, p); R.rig.spot.p = loc(R.rig.spot.p); R.rig.spot.t = loc(R.rig.spot.t); R.rig.pts.forEach((q) => { q.p = loc(q.p); });
    hit(R.g, 'exit', -0.8, 0.8, 0, 2.6, -0.3, 0.3, R.hits);
    if (extra.note) { // a note from the artist, pinned to a wall
      const P = R.notePos || [R.W / 2 - 1.0, 1.6, -R.D + 0.04, 0], m = plane(R.g, 0.4, 0.5, own(R, lam({ map: own(R, T.note(extra.note.title, extra.note.text)), emissive: 0x2a2218 })), P[0], P[1], P[2], P[3]); m.rotation.z = 0.03;
      const n = [Math.sin(P[3]), Math.cos(P[3])]; glow(R.g, P[0] + n[0] * 0.05, P[1], P[2] + n[1] * 0.05, 0xffd9a0, 0.9, 0.1); hit(R.g, 'note', P[0] - 0.3 + n[0] * 0.1, P[0] + 0.3 + n[0] * 0.1, P[1] - 0.32, P[1] + 0.32, P[2] - 0.3 + n[1] * 0.1, P[2] + 0.3 + n[1] * 0.1, R.hits);
    }
    if (extra.screen) { // a screen on a brass stand, angled to where you stand; it shows the title and the song's live spectrum
      const s = new THREE.Group(); s.position.set(opts.tall ? -0.62 : -1.55, 0, opts.tall ? -6.4 : -6.1); s.rotation.y = opts.tall ? 0.1 : 0.26; s.scale.setScalar(opts.tall ? 0.72 : 0.9); R.g.add(s); // nearer the middle on an upright phone, where the view is narrow
      rbx(s, -0.72, 0.72, 0.82, 1.66, -0.03, 0.02, M.dark, 0.012); bx(s, -0.02, 0.02, 0, 0.82, -0.03, 0.0, M.brass); bx(s, -0.3, 0.3, 0, 0.02, -0.16, 0.14, M.brass); contact(R.g, s.position.x - 0.3, s.position.x + 0.3, s.position.z - 0.2, s.position.z + 0.2, 0.02, 0.2);
      const [c, g] = cnv(480, 270), t = own(R, new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; plane(s, 1.38, 0.78, own(R, new THREE.MeshBasicMaterial({ map: t, color: col(0xffffff).multiplyScalar(1.15) })), 0, 1.24, 0.024);
      hit(s, 'screen', -0.72, 0.72, 0.8, 1.68, -0.1, 0.2, R.hits);
      let last = -1; const title = extra.screen.title, label = extra.screen.label.toUpperCase().split('').join(' ');
      R.tv = (A) => {
        if (A.t - last < 1 / 15 && last >= 0) return; last = A.t; // fifteen frames a second is plenty for a spectrum and keeps texture uploads cheap
        g.fillStyle = '#0a0705'; g.fillRect(0, 0, 480, 270);
        for (let i = 0; i < 32; i++) { const v = A.bands[i >> 1] * (i % 2 ? 0.9 : 1), h = Math.max(2, v * 130); g.fillStyle = `rgba(230,160,80,${(0.18 + v * 0.55).toFixed(2)})`; g.fillRect(i * 15 + 2, 270 - h, 11, h); }
        g.textAlign = 'center'; g.fillStyle = '#cfa462'; g.font = '500 12px "Avenir Next","Helvetica Neue",sans-serif'; g.fillText('V I D E O', 240, 88);
        g.fillStyle = '#f1e8da'; let fs = 36; g.font = `400 ${fs}px "Iowan Old Style",Palatino,Georgia,serif`; while (g.measureText(title).width > 420 && fs > 18) { fs -= 2; g.font = `400 ${fs}px "Iowan Old Style",Palatino,Georgia,serif`; } g.fillText(title, 240, 132);
        g.strokeStyle = 'rgba(241,232,218,.85)'; g.lineWidth = 1.5; g.beginPath(); g.arc(240, 172, 14, 0, 7); g.stroke(); g.beginPath(); g.moveTo(236, 165); g.lineTo(236, 179); g.lineTo(247, 172); g.closePath(); g.fill();
        g.font = '500 11px "Avenir Next","Helvetica Neue",sans-serif'; g.fillStyle = 'rgba(241,232,218,.8)'; g.fillText(label, 240, 210); t.needsUpdate = true;
      };
    }
    if (extra.egg) { const x = R.W / 2 - 0.7, z = -1.1; pot(R.g, x, 0, z, 0.22, 0.5); plant(R.g, x, 0.45, z, 0.9, T.ganja, 7, 0.5, 91, 0xffffff); glow(R.g, x, 0.9, z, 0xc8ff9a, 1.5, 0.16); hit(R.g, 'egg', x - 0.4, x + 0.4, 0, 1.6, z - 0.4, z + 0.4, R.hits); }
    R.hits.forEach((h) => { h.userData.room = index; }); W.shadowFrames = 8; return R;
  };
  W.hideRoom = function (index) {
    const R = W.rooms[index]; if (!R) return; delete W.rooms[index]; scene.remove(R.g);
    R.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); R.own.forEach((m) => m.dispose && m.dispose());
  };
  W.activeHits = function () { let a = W.hits; for (const k in W.rooms) a = a.concat(W.rooms[k].hits); return a; };

  /* ---------- per frame ---------- */
  // s = { reduced, time, zone: 'outside' | 'hall' | room index, rooms: { index: A }, focus: slot or -1, preview: A or null, camZ }
  W.update = function (dt, s) {
    for (const d of W.doors.concat(W.front)) { const before = d.angle; d.angle += (d.target - d.angle) * Math.min(1, dt * 2.4); d.pivot.rotation.y = d.yawClosed + d.sign * d.angle; if (Math.abs(d.angle - before) > 0.0005) W.shadowFrames = Math.max(W.shadowFrames, 2); }
    EXT.visible = W.floor === 0 && s.camZ > 0.5; if (EXT.visible) W.extRain(dt, s.reduced ? 0.15 : 1);
    for (const k in W.rooms) { const R = W.rooms[k], A = s.rooms[k]; if (!A) continue; R.fx(dt, A); if (R.tv) R.tv(A); if (s.zone !== R.index) { W.gain.spot = 1; W.gain.pts[0] = W.gain.pts[1] = W.gain.pts[2] = 1; } }
    // each door's light strip glows in its room's colour; the door you are overhearing pulses with that song
    W.sills.forEach((q, k) => { if (!q.on) return; const live = s.focus === k && s.preview ? 0.6 + s.preview.bass * 2.2 + s.preview.kick * 1.4 : 0.55; q.mat.color.copy(q.color).multiplyScalar(live * 1.6); q.glow.material.color.copy(q.color); q.glow.material.opacity = 0.12 + live * 0.12; });
    for (const f of W.frames) if (f.anim && f.mesh.visible) { f.t += dt * (s.reduced ? 0.3 : 1); const n = f.anim.n, i = Math.floor(f.t * f.anim.fps) % (n * 2 - 2), k = i < n ? i : n * 2 - 2 - i; f.mat.map.offset.set((k % f.anim.cols) / f.anim.cols, 1 - (Math.floor(k / f.anim.cols) + 1) / f.anim.rows); }
    const R = typeof s.zone === 'number' ? W.rooms[s.zone] : null, rigNow = s.zone === 'outside' ? W.rigOutside : R ? R.rig : hallRig;
    if (rigNow === hallRig) { const q = hallRig.pts[2]; if (s.focus >= 0 && W.sills[s.focus].on) { const g = slotGeo(s.focus); q.p = [g.sill[0] * 0.6, 1.1, g.sill[2] + (PLAN.SLOTS[s.focus].side ? 0 : 0.8)]; q.c = W.sills[s.focus].color.getHex(); q.i = 5 + (s.preview ? s.preview.bass * 6 : 0); } else q.i = 0; }
    W.setRig(rigNow); driveLights(dt);
  };
  return W;
}

// A small lit studio rendered once into an environment map, so brass, glass and polished floors have something to reflect.
// The 'cool' variant is a blue-hour sky with no lamps, used by wet floors and water.
function buildEnvironment(renderer, cool) {
  const s = new THREE.Scene();
  const [c, g] = cnv(16, 256), gr = g.createLinearGradient(0, 0, 0, 256);
  if (cool) { gr.addColorStop(0, '#0a1230'); gr.addColorStop(0.4, '#1c2c66'); gr.addColorStop(0.52, '#141c40'); gr.addColorStop(1, '#03050a'); }
  else { gr.addColorStop(0, '#0a0c1c'); gr.addColorStop(0.45, '#1c1a2c'); gr.addColorStop(0.55, '#3a2012'); gr.addColorStop(1, '#070504'); }
  g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 12), new THREE.MeshBasicMaterial({ map: tex(c, { repeat: false }), side: THREE.BackSide })); s.add(dome);
  for (const [x, y, z, hex, k] of cool ? [[4, 9, -6, 0x7f9cff, 5], [-8, 6, 5, 0x5670d0, 3], [0, 12, 0, 0xb4c8ff, 4]] : [[6, 2.5, -3, 0xffa040, 9], [-7, 1.5, 4, 0xff8a30, 7], [0, 5, 8, 0xffb060, 6], [-3, 4, -9, 0x4a5aa0, 3], [8, 7, 6, 0x34427a, 2.5], [0, 9, 0, 0xffc890, 3]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) })); m.position.set(x, y, z); s.add(m);
  }
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(s, 0.03); pm.dispose();
  return rt.texture;
}
