/* The House That Remembered Us — procedural textures.
   Every surface is drawn at boot on a 2D canvas, so the package ships no image
   assets for the scene and nothing can be blocked by file:// or sandbox CORS. */
function makeRng(seed) { return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; }
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, opts = {}) {
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function grain(g, w, h, n, r, lightA, darkA, size = 2) {
  for (let i = 0; i < n; i++) {
    const v = r();
    g.fillStyle = v > 0.5 ? `rgba(255,240,220,${lightA * r()})` : `rgba(0,0,0,${darkA * r()})`;
    g.fillRect(r() * w, r() * h, 1 + r() * size, 1 + r() * size);
  }
}

function buildTextures() {
  const T = {};

  { // coursed basalt: long honed stones in level courses with tight dark joints, plus a height map for relief
    const [c, g] = cnv(512, 512), [hc, h] = cnv(512, 512), r = makeRng(7);
    g.fillStyle = '#0c0b0b'; g.fillRect(0, 0, 512, 512); h.fillStyle = '#000'; h.fillRect(0, 0, 512, 512);
    let y = 0;
    for (const rh of [92, 60, 100, 64, 88, 108]) {
      const o = r() * 140 | 0, end = o + 512; let x = o;
      while (x < end) {
        let w = 120 + (r() * 190 | 0); if (end - x - w < 100) w = end - x;
        const l = 56 + r() * 22, lift = 130 + (r() * 100 | 0);
        for (const dx of [0, -512]) {
          const gr = g.createLinearGradient(0, y, 0, y + rh); gr.addColorStop(0, `rgb(${l + 9 | 0},${l + 6 | 0},${l + 4 | 0})`); gr.addColorStop(1, `rgb(${l - 4 | 0},${l - 6 | 0},${l - 7 | 0})`);
          g.fillStyle = gr; g.fillRect(x + dx + 1.2, y + 1.2, w - 2.4, rh - 2.4);
          h.fillStyle = `rgb(${lift},${lift},${lift})`; h.fillRect(x + dx + 2.5, y + 2.5, w - 5, rh - 5);
        }
        x += w;
      }
      y += rh;
    }
    for (let i = 0; i < 60; i++) { // slow mottling across stones
      const x = r() * 512, yy = r() * 512, rad = 30 + r() * 110, gr = g.createRadialGradient(x, yy, 0, x, yy, rad);
      gr.addColorStop(0, r() > 0.5 ? 'rgba(0,0,0,.16)' : 'rgba(200,185,170,.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    }
    grain(g, 512, 512, 9000, r, 0.07, 0.22, 2); grain(h, 512, 512, 9000, r, 0.12, 0.2, 2);
    T.stone = tex(c); T.stoneBump = tex(hc, { srgb: false });
  }
  { // timber planks, vertical grain; drawn neutral-warm so doors can be tinted
    const [c, g] = cnv(512, 512), r = makeRng(11);
    const planks = 6, pw = 512 / planks;
    for (let p = 0; p < planks; p++) {
      const l = 0.82 + r() * 0.3;
      g.fillStyle = `rgb(${112 * l | 0},${76 * l | 0},${52 * l | 0})`; g.fillRect(p * pw, 0, pw, 512);
      for (let i = 0; i < 46; i++) {
        const x = p * pw + r() * pw;
        g.strokeStyle = r() > 0.5 ? `rgba(40,14,4,${0.1 + r() * 0.25})` : `rgba(240,205,170,${0.03 + r() * 0.08})`;
        g.lineWidth = 0.6 + r() * 1.6; g.beginPath(); g.moveTo(x, 0);
        g.bezierCurveTo(x + (r() - 0.5) * 7, 170, x + (r() - 0.5) * 7, 340, x, 512); g.stroke();
      }
      g.fillStyle = 'rgba(12,4,1,.75)'; g.fillRect(p * pw, 0, 2.5, 512);
    }
    T.timber = tex(c);
  }
  { // board-formed concrete
    const [c, g] = cnv(512, 512), r = makeRng(23);
    g.fillStyle = '#6f6257'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 70; i++) {
      const x = r() * 512, y = r() * 512, rad = 40 + r() * 120, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const d = r() > 0.5; gr.addColorStop(0, d ? 'rgba(30,24,20,.2)' : 'rgba(190,170,150,.13)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    }
    for (let y = 0; y < 512; y += 64) { g.fillStyle = 'rgba(20,15,12,.28)'; g.fillRect(0, y, 512, 1.5); }
    grain(g, 512, 512, 12000, r, 0.1, 0.22);
    T.concrete = tex(c);
  }
  { // polished floor: quieter mottling, no board lines
    const [c, g] = cnv(512, 512), r = makeRng(31);
    g.fillStyle = '#5b5148'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) {
      const x = r() * 512, y = r() * 512, rad = 30 + r() * 140, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, r() > 0.5 ? 'rgba(20,16,14,.22)' : 'rgba(210,180,150,.1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    }
    grain(g, 512, 512, 5000, r, 0.06, 0.15);
    T.floor = tex(c);
  }
  { // wet stone paving: large honed slabs laid in a staggered bond (also the courtyard and rain-room floor)
    const [c, g] = cnv(512, 512), r = makeRng(41), tone = [];
    g.fillStyle = '#0d0c0c'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) tone.push(46 + r() * 16);
    for (let y = 0; y < 4; y++) for (let x = -1; x < 3; x++) {
      const px = x * 256 + (y % 2) * 128, l = tone[y * 2 + ((x % 2) + 2) % 2];
      const gr = g.createLinearGradient(px, 0, px + 256, 0); gr.addColorStop(0, `rgb(${l + 5 | 0},${l + 2 | 0},${l | 0})`); gr.addColorStop(1, `rgb(${l - 3 | 0},${l - 4 | 0},${l - 4 | 0})`);
      g.fillStyle = gr; g.fillRect(px + 1.2, y * 128 + 1.2, 253.6, 125.6);
    }
    for (let i = 0; i < 50; i++) {
      const x = r() * 512, y = r() * 512, rad = 30 + r() * 120, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, r() > 0.5 ? 'rgba(0,0,0,.2)' : 'rgba(190,180,175,.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    }
    grain(g, 512, 512, 9000, r, 0.07, 0.25, 2);
    T.paving = tex(c);
  }
  { // jute runner
    const [c, g] = cnv(256, 256), r = makeRng(53);
    g.fillStyle = '#6e5638'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 8) for (let x = 0; x < 256; x += 8) {
      const o = (y / 8) % 2 ? 4 : 0, l = 0.88 + r() * 0.22;
      g.fillStyle = `rgb(${128 * l | 0},${100 * l | 0},${66 * l | 0})`; g.fillRect(x + o, y + 1, 7, 5);
      g.fillStyle = 'rgba(40,24,10,.28)'; g.fillRect(x + o, y + 6, 8, 2);
    }
    T.jute = tex(c);
  }
  { // woven red rug
    const [c, g] = cnv(256, 256), r = makeRng(61);
    g.fillStyle = '#6e2413'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 16) {
      g.fillStyle = (y / 16) % 4 === 0 ? '#3b130b' : (y / 16) % 4 === 2 ? '#9a4320' : '#7a2b16'; g.fillRect(0, y, 256, 9);
      for (let x = 0; x < 256; x += 16) { g.fillStyle = 'rgba(230,170,110,.28)'; g.fillRect(x + ((y / 16) % 2) * 8, y + 3, 6, 3); }
    }
    grain(g, 256, 256, 5000, r, 0.1, 0.3);
    T.rug = tex(c);
  }
  { // breeze block screen: colour + emissive (backlit cut-outs)
    const [c, g] = cnv(256, 256), [e, h] = cnv(256, 256);
    g.fillStyle = '#5a4a3c'; g.fillRect(0, 0, 256, 256); h.fillStyle = '#000'; h.fillRect(0, 0, 256, 256);
    const n = 4, s = 64;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const cx = x * s + 32, cy = y * s + 32;
      g.strokeStyle = '#2a211a'; g.lineWidth = 3; g.strokeRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3);
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const px = cx + dx * 14, py = cy + dy * 14;
        g.fillStyle = '#17110c'; g.fillRect(px - 9, py - 9, 18, 18);
        const gr = h.createRadialGradient(px, py, 1, px, py, 12); gr.addColorStop(0, '#ffb45e'); gr.addColorStop(1, '#5a2a08');
        h.fillStyle = gr; h.fillRect(px - 8, py - 8, 16, 16);
      }
      g.fillStyle = '#17110c'; g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill();
    }
    T.block = tex(c); T.blockGlow = tex(e);
  }
  { // record spines
    const [c, g] = cnv(512, 128), r = makeRng(71);
    g.fillStyle = '#120b07'; g.fillRect(0, 0, 512, 128);
    const cols = ['#b9a27a', '#7d2f1c', '#d9c9a3', '#33414f', '#a8642e', '#1c1a18', '#5d6b4a', '#c98b3a', '#8f8576', '#40251a'];
    for (let x = 4; x < 508;) { const w = 3 + r() * 5; g.fillStyle = cols[r() * cols.length | 0]; g.fillRect(x, 10 + r() * 6, w, 112); x += w + 0.8; if (r() > 0.93) x += 10; }
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, 512, 18);
    T.spines = tex(c, { repeat: false });
  }
  { // brass grille sidelight (emissive)
    const [c, g] = cnv(128, 512);
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#6b3a12'); gr.addColorStop(0.55, '#e39a45'); gr.addColorStop(1, '#5a2c0c');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 512);
    g.strokeStyle = '#2a1a08'; g.lineWidth = 7;
    for (let x = 0; x <= 128; x += 42.6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
    for (const y of [0, 60, 120, 260, 400, 452, 512]) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
    T.grille = tex(c, { repeat: false });
  }
  { // lit wing seen from the garden: warm room behind glass
    const [c, g] = cnv(1024, 256), r = makeRng(83);
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#8a4a16'); gr.addColorStop(0.5, '#d58a3a'); gr.addColorStop(1, '#4a2208');
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 9; i++) { // low furniture, shelves and lamp pools
      const x = 30 + i * 112 + r() * 30, top = 150 + r() * 50, w = 70 + r() * 50;
      g.fillStyle = 'rgba(46,20,6,.55)'; g.beginPath(); g.roundRect(x, top, w, 256 - top, 10); g.fill();
      if (i % 3 === 0) { g.fillStyle = 'rgba(40,16,5,.5)'; g.fillRect(x + 8, 40, 84, 110); for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(255,200,130,.25)'; g.fillRect(x + 12, 46 + k * 27, 76, 3); } }
      const lx = x + w + 14, ly = 120 + r() * 40, lg = g.createRadialGradient(lx, ly, 2, lx, ly, 80);
      lg.addColorStop(0, 'rgba(255,228,170,.9)'); lg.addColorStop(1, 'rgba(255,180,90,0)'); g.fillStyle = lg; g.fillRect(lx - 80, ly - 80, 160, 160);
    }
    g.fillStyle = '#120b06'; for (let x = 0; x <= 1024; x += 128) g.fillRect(x - 3, 0, 6, 256);
    g.fillRect(0, 0, 1024, 8); g.fillRect(0, 248, 1024, 8);
    T.wing = tex(c, { repeat: false });
  }
  { // dusk sky dome: equirect-ish vertical gradient, blue hour with a warm horizon
    const [c, g] = cnv(16, 512);
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#060a1c'); gr.addColorStop(0.2, '#0f1740'); gr.addColorStop(0.33, '#2b2b6a'); gr.addColorStop(0.42, '#5c3d74'); gr.addColorStop(0.485, '#a8626a'); gr.addColorStop(0.52, '#3b2a45'); gr.addColorStop(1, '#05060c');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
    T.sky = tex(c, { repeat: false });
  }
  { // acacia silhouettes
    const [c, g] = cnv(512, 256), r = makeRng(97);
    g.clearRect(0, 0, 512, 256); g.fillStyle = '#04060b';
    for (let t = 0; t < 3; t++) {
      const x = 90 + t * 165 + r() * 30, top = 60 + r() * 50;
      g.beginPath(); g.moveTo(x - 5, 256); g.quadraticCurveTo(x + 6, 170, x - 30, top + 30); g.lineTo(x - 22, top + 30); g.quadraticCurveTo(x + 14, 170, x + 5, 256); g.fill();
      g.beginPath(); g.moveTo(x, 190); g.quadraticCurveTo(x + 30, 140, x + 55, top + 34); g.lineTo(x + 60, top + 36); g.quadraticCurveTo(x + 34, 150, x + 4, 200); g.fill();
      for (let i = 0; i < 16; i++) { g.beginPath(); g.ellipse(x + (r() - 0.5) * 170, top + r() * 26, 26 + r() * 30, 7 + r() * 8, 0, 0, 7); g.fill(); }
    }
    T.trees = tex(c, { repeat: false });
  }
  { // fern frond (alpha)
    const [c, g] = cnv(128, 512);
    g.strokeStyle = '#2f5a25'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 512); g.lineTo(64, 10); g.stroke();
    for (let y = 500; y > 12; y -= 11) {
      const len = 58 * Math.sin((512 - y) / 512 * Math.PI * 0.92 + 0.15), l = 60 + (512 - y) / 512 * 70;
      for (const s of [-1, 1]) {
        g.fillStyle = `rgb(${l * 0.45 | 0},${l | 0},${l * 0.32 | 0})`;
        g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(64 + s * len * 0.6, y - 12, 64 + s * len, y - 5); g.quadraticCurveTo(64 + s * len * 0.5, y + 3, 64, y + 5); g.fill();
      }
    }
    T.fern = tex(c, { repeat: false });
  }
  { // broad split leaf (alpha)
    const [c, g] = cnv(256, 512);
    g.strokeStyle = '#2c4f25'; g.lineWidth = 6; g.beginPath(); g.moveTo(128, 512); g.lineTo(128, 250); g.stroke();
    const gr = g.createLinearGradient(0, 0, 256, 300); gr.addColorStop(0, '#3f7a35'); gr.addColorStop(1, '#1b3a1a');
    g.fillStyle = gr; g.beginPath(); g.moveTo(128, 300);
    g.bezierCurveTo(-30, 280, -10, 40, 128, 8); g.bezierCurveTo(266, 40, 286, 280, 128, 300); g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
      const y = 70 + i * 42; g.beginPath(); g.moveTo(128 + s * 130, y - 14); g.lineTo(128 + s * 38, y + 8); g.lineTo(128 + s * 130, y + 12); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(160,210,120,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(128, 300); g.lineTo(128, 20); g.stroke();
    T.leaf = tex(c, { repeat: false });
  }
  { // soft glow sprite
    const [c, g] = cnv(128, 128), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    T.glow = tex(c, { repeat: false });
  }
  { // rain-light streaks that slide across the wet floor of the blue room
    const [c, g] = cnv(256, 512), r = makeRng(101);
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 46; i++) {
      const x = r() * 256, w = 2 + r() * 9, y = r() * 512, len = 80 + r() * 260, a = 0.15 + r() * 0.5;
      for (const oy of [0, -512, 512]) {
        const gr = g.createLinearGradient(0, y + oy, 0, y + oy + len);
        gr.addColorStop(0, 'rgba(120,160,255,0)'); gr.addColorStop(0.5, `rgba(150,185,255,${a})`); gr.addColorStop(1, 'rgba(120,160,255,0)');
        g.fillStyle = gr; g.fillRect(x, y + oy, w, len);
      }
    }
    T.streaks = tex(c);
  }
  { // rain on glass (alpha streaks + beads)
    const [c, g] = cnv(256, 512), r = makeRng(109);
    for (let i = 0; i < 120; i++) {
      const x = r() * 256, y = r() * 512, len = 6 + r() * 34;
      g.strokeStyle = `rgba(170,200,255,${0.1 + r() * 0.3})`; g.lineWidth = 0.6 + r() * 1.2;
      for (const oy of [0, -512, 512]) { g.beginPath(); g.moveTo(x, y + oy); g.lineTo(x + (r() - 0.5) * 2, y + oy + len); g.stroke(); }
    }
    T.rainGlass = tex(c);
  }
  { // blue forest beyond the rain room glass
    const [c, g] = cnv(512, 256), r = makeRng(113);
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1d2c6a'); gr.addColorStop(0.55, '#2a3f8a'); gr.addColorStop(1, '#0a1230');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    for (let layer = 0; layer < 3; layer++) {
      g.fillStyle = ['#0c1840', '#081030', '#040818'][layer];
      for (let i = 0; i < 9; i++) {
        const x = r() * 512, w = 6 + r() * 10, top = 40 + layer * 34 + r() * 50;
        g.fillRect(x, top, w, 256 - top);
        for (let k = 0; k < 9; k++) { g.beginPath(); g.ellipse(x + (r() - 0.5) * 120, top + (r() - 0.3) * 60, 30 + r() * 34, 14 + r() * 14, 0, 0, 7); g.fill(); }
      }
    }
    T.forest = tex(c, { repeat: false });
  }
  { // moon
    const [c, g] = cnv(128, 128), r = makeRng(127);
    const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64);
    gr.addColorStop(0, 'rgba(240,244,255,1)'); gr.addColorStop(0.42, 'rgba(232,238,255,1)'); gr.addColorStop(0.5, 'rgba(170,190,255,.35)'); gr.addColorStop(1, 'rgba(120,150,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(150,160,190,${0.12 + r() * 0.16})`; g.beginPath(); g.arc(46 + r() * 36, 46 + r() * 36, 3 + r() * 7, 0, 7); g.fill(); }
    T.moon = tex(c, { repeat: false });
  }
  { // sheer fabric weave (alpha varies so light breaks through)
    const [c, g] = cnv(128, 128), r = makeRng(131);
    g.fillStyle = 'rgba(205,218,255,.5)'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 3) { g.fillStyle = `rgba(235,240,255,${0.2 + r() * 0.3})`; g.fillRect(i, 0, 1, 128); g.fillRect(0, i, 128, 1); }
    T.fabric = tex(c);
  }
  // door emblems: one small framed picture per room, as in the corridor reference
  T.emblems = ['amber', 'blue', 'green'].map((kind) => {
    const [c, g] = cnv(128, 128);
    if (kind === 'amber') {
      const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#f0a03c'); gr.addColorStop(1, '#7a2a0c'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(64, 78, 20, 0, 7); g.fill();
      g.fillStyle = '#2a0f05'; g.fillRect(0, 100, 128, 28); g.fillRect(60, 60, 5, 44); g.beginPath(); g.ellipse(62, 56, 34, 9, 0, 0, 7); g.fill();
    } else if (kind === 'blue') {
      g.fillStyle = '#0d1f4a'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#8fb4ff'; g.lineWidth = 2;
      for (let i = 1; i < 6; i++) { g.globalAlpha = 1 - i * 0.15; g.beginPath(); g.ellipse(64, 76, i * 11, i * 5, 0, 0, 7); g.stroke(); }
      g.globalAlpha = 1; g.fillStyle = '#cfe0ff'; g.beginPath(); g.arc(64, 76, 3, 0, 7); g.fill();
    } else {
      g.fillStyle = '#12301a'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#9fe07a'; g.lineWidth = 2.5;
      for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.3; g.beginPath(); g.moveTo(64, 112); g.quadraticCurveTo(64 + Math.cos(a) * 30, 70, 64 + Math.cos(a) * 62, 112 + Math.sin(a) * 92); g.stroke(); }
    }
    g.strokeStyle = '#c69a4a'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
    return tex(c, { repeat: false });
  });
  { // soft dark blob laid under furniture and pots so they sit on the floor
    const [c, g] = cnv(128, 128), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,.92)'); gr.addColorStop(0.45, 'rgba(0,0,0,.6)'); gr.addColorStop(0.8, 'rgba(0,0,0,.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); T.contact = tex(c, { repeat: false });
  }
  // engraved brass door plaque: number over title
  T.plaque = (num, title) => {
    const [c, g] = cnv(512, 256), [hc, h] = cnv(512, 256), r = makeRng(num * 31 + 5);
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#c9a25c'); gr.addColorStop(0.5, '#b08a48'); gr.addColorStop(1, '#8f6c34'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() > 0.5 ? '255,240,200' : '40,24,6'},${0.03 + r() * 0.05})`; g.fillRect(0, r() * 256, 512, 1); }
    h.fillStyle = '#fff'; h.fillRect(0, 0, 512, 256);
    for (const [ctx, ink] of [[g, '#1c1206'], [h, '#000']]) {
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '500 34px "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif'; ctx.fillText(String(num).padStart(2, '0'), 256, 62);
      ctx.fillRect(226, 96, 60, 2);
      let size = 64; ctx.font = `500 ${size}px "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif`;
      while (ctx.measureText(title).width > 440 && size > 30) { size -= 4; ctx.font = `500 ${size}px "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif`; }
      ctx.fillText(title, 256, 164);
    }
    return { map: tex(c, { repeat: false }), bump: tex(hc, { repeat: false, srgb: false }) };
  };
  // a handwritten-feeling note on warm paper, pinned at the top
  T.note = (title, text) => {
    const [c, g] = cnv(512, 640), r = makeRng(title.length * 13 + text.length);
    const gr = g.createLinearGradient(0, 0, 512, 640); gr.addColorStop(0, '#ece3d1'); gr.addColorStop(1, '#d9ccb4'); g.fillStyle = gr; g.fillRect(0, 0, 512, 640);
    grain(g, 512, 640, 7000, r, 0.05, 0.08, 2);
    g.fillStyle = 'rgba(120,90,50,.12)'; g.fillRect(0, 0, 512, 6); g.fillRect(0, 634, 512, 6);
    g.fillStyle = '#2a1f14'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = '500 17px "Avenir Next","Helvetica Neue",sans-serif'; g.letterSpacing = '4px'; g.fillStyle = '#8a6a3a'; g.fillText(title.toUpperCase(), 46, 96);
    g.fillStyle = '#8a6a3a'; g.fillRect(46, 112, 40, 1.5);
    g.fillStyle = '#2a1f14'; g.letterSpacing = '0px'; g.font = 'italic 31px "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif';
    const words = text.split(/\s+/); let line = '', y = 168;
    for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > 420 && line) { g.fillText(line, 46, y); y += 44; line = w; if (y > 590) break; } else line = t; }
    if (line && y <= 590) g.fillText(line, 46, y);
    const pin = g.createRadialGradient(252, 30, 2, 256, 34, 14); pin.addColorStop(0, '#f0d7a0'); pin.addColorStop(0.5, '#b8873e'); pin.addColorStop(1, '#5a3c14');
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(260, 40, 13, 0, 7); g.fill(); g.fillStyle = pin; g.beginPath(); g.arc(256, 34, 13, 0, 7); g.fill();
    return tex(c, { repeat: false });
  };
  { // back-bar: a warm backlit wall with bottle silhouettes on three shelves
    const [c, g] = cnv(512, 256), r = makeRng(71);
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#ffd9a0'); gr.addColorStop(1, '#c06a20'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    for (let row = 0; row < 3; row++) {
      const base = 78 + row * 84; g.fillStyle = '#140a04'; g.fillRect(0, base, 512, 7);
      for (let x = 8; x < 500;) { const w = 12 + r() * 12, h = 34 + r() * 34; g.fillStyle = `rgba(${20 + r() * 50 | 0},${10 + r() * 24 | 0},6,${0.72 + r() * 0.28})`; g.fillRect(x, base - h, w, h); g.fillRect(x + w * 0.3, base - h - 12, w * 0.4, 13); x += w + 4 + r() * 9; }
    }
    T.bottles = tex(c, { repeat: false });
  }
  { // water caustics: bright wandering lines on black, used additively
    const [c, g] = cnv(256, 256), r = makeRng(83);
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = r() * 256, y = r() * 256; g.strokeStyle = `rgba(255,255,255,${0.1 + r() * 0.3})`; g.lineWidth = 1 + r() * 3;
      for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.bezierCurveTo(x + ox + 30 - r() * 60, y + oy + 30, x + ox + 60, y + oy - 30 + r() * 60, x + ox + 40 + r() * 50, y + oy + 20 - r() * 40); g.stroke(); }
    }
    T.caustic = tex(c);
  }
  { // the hidden plant: a seven-fingered serrated leaf
    const [c, g] = cnv(256, 256);
    g.translate(128, 236);
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.42, len = 210 - Math.abs(i) * 42, w = 26 - Math.abs(i) * 3;
      g.save(); g.rotate(a); const gr = g.createLinearGradient(0, 0, 0, -len); gr.addColorStop(0, '#1d4a1c'); gr.addColorStop(1, '#5fae3c'); g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, 0);
      for (let k = 1; k <= 9; k++) { const t = k / 10, y = -len * t, x = w * Math.sin(Math.PI * t); g.lineTo(x * 0.7, y + 6); g.lineTo(x, y); }
      g.lineTo(0, -len);
      for (let k = 9; k >= 1; k--) { const t = k / 10, y = -len * t, x = w * Math.sin(Math.PI * t); g.lineTo(-x, y); g.lineTo(-x * 0.7, y + 6); }
      g.closePath(); g.fill(); g.strokeStyle = 'rgba(10,40,10,.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len); g.stroke(); g.restore();
    }
    T.ganja = tex(c, { repeat: false });
  }
  // small brass sign above the lift
  T.floorSign = (n, of) => {
    const [c, g] = cnv(256, 128); g.fillStyle = '#0c0a08'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#b08a48'; g.lineWidth = 4; g.strokeRect(4, 4, 248, 120);
    g.fillStyle = '#ffcf8a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '500 20px "Avenir Next","Helvetica Neue",sans-serif'; g.fillText('F L O O R', 128, 30);
    g.font = '500 62px "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif'; g.fillText(n + ' / ' + of, 128, 82);
    return tex(c, { repeat: false });
  };
  return T;
}
