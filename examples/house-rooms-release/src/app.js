/* The House That Remembered Us — walking, looking, listening.
   Places: 'outside', 'hall' (the corridor of the current floor) and rooms 0..N-1.
   Room i is on floor (i / 5 | 0) behind door (i % 5). */
(function () {
  const CFG = window.NZ_CONFIG, $ = (id) => document.getElementById(id), QS = new URLSearchParams(location.search);
  const TRACKS = CFG.tracks, PER = PLAN.SLOTS.length, NR = Math.min((CFG.rooms || []).length, ROOM_DEFS.length), FLOORS = Math.max(1, Math.ceil(NR / PER));
  const ROOMS = []; for (let i = 0; i < NR; i++) ROOMS.push({ i, def: ROOM_DEFS[i], name: ROOM_DEFS[i].name, track: CFG.rooms[i].track, floor: (i / PER) | 0, slot: i % PER });
  const NOTES = CFG.notes || {}, EGGS = (CFG.eggs || []).map((e, id) => Object.assign({ id }, e));
  const isRoom = (k) => typeof k === 'number', trackOf = (k) => (isRoom(k) ? ROOMS[k].track : -1);
  const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), two = (n) => String(n).padStart(2, '0');

  /* ---------- saved state: viewer bridge first, localStorage when available ---------- */
  let saved = {};
  try { if (window.NZ_VIEWER_STATE && window.NZ_VIEWER_STATE.resume) saved = window.NZ_VIEWER_STATE.resume; else { const raw = localStorage.getItem(CFG.resumeKey); if (raw) saved = JSON.parse(raw); } } catch (e) { saved = {}; }
  if (!saved || typeof saved !== 'object') saved = {};
  let reduced = saved.reduced != null ? !!saved.reduced : !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let auto = QS.get('auto') === '0' ? false : saved.auto !== false;
  const seen = new Set(saved.tips || []), found = new Set(saved.eggs || []);
  let lastSave = '';
  function persist() {
    if (!engine) return;
    const value = JSON.stringify({ kind: 'house-rooms', positions: engine.positions(), volume: engine.master, reduced, auto, last_room: isRoom(loc) ? loc : null, tips: [...seen], eggs: [...found], audio_path: engine.graph() ? 'webaudio' : 'element' });
    if (value === lastSave) return; lastSave = value;
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'noizes:storage:set', key: CFG.resumeKey, value }, '*'); } catch (e) {}
    try { localStorage.setItem(CFG.resumeKey, value); } catch (e) {}
  }

  /* ---------- simple accessible player (also the fallback when WebGL is unavailable) ---------- */
  let engine = null, simpleBuilt = false, simpleMode = false;
  function showSimple(reason) {
    simpleMode = true; if (engine) engine.stopAll();
    document.body.classList.add('simple'); $('simple-reason').textContent = reason || '';
    if (!simpleBuilt) {
      simpleBuilt = true; const list = $('simple-list'), els = [];
      TRACKS.forEach((t, i) => {
        const li = document.createElement('li'), h = document.createElement('h3'), p = document.createElement('p'), a = document.createElement('audio');
        h.textContent = (i + 1) + '. ' + t.title; p.textContent = (t.artist ? t.artist + ' · ' : '') + fmt(t.duration);
        a.controls = true; a.preload = 'metadata'; a.src = t.src; a.setAttribute('aria-label', t.title);
        if (engine && engine.deck(i) && engine.deck(i).P > 0) a.addEventListener('loadedmetadata', () => { a.currentTime = engine.deck(i).P; }, { once: true });
        a.addEventListener('play', () => els.forEach((o) => { if (o !== a) o.pause(); }));
        els.push(a); li.append(h, p, a); list.appendChild(li);
      });
    }
    $('simple').focus();
  }
  $('to-simple').addEventListener('click', () => showSimple(''));
  $('simple-back').addEventListener('click', () => { document.querySelectorAll('#simple-list audio').forEach((a) => a.pause()); document.body.classList.remove('simple'); simpleMode = false; });

  /* ---------- scene ---------- */
  let renderer, scene, camera, W, matte = null, post = null, prBase = 1, prScale = 1, tier = 0, FRAMES = [];
  try {
    const canvas = $('scene'), coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    prBase = Math.min(window.devicePixelRatio || 1, 1.5); renderer.setPixelRatio(prBase);
    renderer.shadowMap.enabled = !coarse;
    if (QS.get('post') !== '0') post = createPost(renderer, { samples: coarse ? 0 : 4 });
    renderer.toneMapping = post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
    scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x080b18, 0.011); scene.background = new THREE.Color(0x05060c);
    scene.environment = buildEnvironment(renderer); scene.environmentIntensity = 0.4;
    camera = new THREE.PerspectiveCamera(58, 1, 0.08, 400); camera.rotation.order = 'YXZ';
    W = buildWorld(scene, buildTextures(), { shadowSize: coarse ? 0 : 1024, env: scene.environment, coolEnv: buildEnvironment(renderer, true), floors: FLOORS, tall: window.innerWidth < window.innerHeight });
    FRAMES = (CFG.frames || []).map((f) => {
      const img = new Image(), t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; if (f.anim) t.repeat.set(1 / f.anim.cols, 1 / f.anim.rows);
      img.onload = () => { t.needsUpdate = true; }; img.src = f.src; return { tex: t, anim: f.anim || null };
    });
    // the supplied exterior image, thrown from the front steps onto forecourt, steps, porch and facade
    if (CFG.mattes && CFG.mattes.outside && QS.get('matte') !== '0') matte = createMatte(scene, CFG.mattes.outside, {
      pos: PLAN.outside.pos, look: [-1.06, 1.9, -6], vfov: 56, aspect: 2, gain: 1.32,
      planes: [[[-60, -3, 4.5], [60, -3, 4.5], [60, 40, 4.5], [-60, 40, 4.5]], [[-60, 0, 7.26], [60, 0, 7.26], [60, 0, 4.5], [-60, 0, 4.5]], [[-60, -0.42, 8.57], [60, -0.42, 8.57], [60, 0, 7.26], [-60, 0, 7.26]], [[-60, -0.42, 30], [60, -0.42, 30], [60, -0.42, 8.57], [-60, -0.42, 8.57]]],
    });
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); showSimple('The 3D view was interrupted on this device. The songs are all here.'); });
  } catch (err) {
    $('simple-back').hidden = true; document.body.classList.add('no-3d');
    showSimple('The 3D house could not start on this device, so here are the songs.');
    return;
  }
  engine = createAudioEngine(TRACKS, saved); engine.init();

  /* ---------- where you are ---------- */
  const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  let loc = 'outside', floor = 0, started = false, move = null, queue = [], lift = null, overlay = null, videoPaused = -1;
  ROOMS.forEach((r) => { r.pos = V(roomPoint(r.slot, PLAN.roomPos)); r.look = V(roomPoint(r.slot, PLAN.roomLook)); const g = slotGeo(r.slot); r.door = V(g.door); r.sill = V(g.sill); r.reach = r.door.distanceTo(r.pos); });
  const station = (k) => (isRoom(k) ? ROOMS[k] : { pos: V(PLAN[k].pos), look: V(PLAN[k].look) });
  const dirAngles = (from, to) => { const d = to.clone().sub(from).normalize(); return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(clamp(d.y, -1, 1)) }; };
  const stationAngles = (k) => { const s = station(k); return dirAngles(s.pos, s.look); };
  let yaw = 0, pitch = 0, lookYaw = 0, lookPitch = 0;
  { const a = stationAngles('outside'); yaw = a.yaw; pitch = a.pitch; camera.position.copy(V(PLAN.outside.pos)); }
  const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const legs = (k) => (k === 'outside' ? [V(PLAN.outside.pos), ...PLAN.porch.map(V)] : k === 'hall' ? [V(PLAN.hall.pos)] : [ROOMS[k].pos.clone(), ROOMS[k].sill.clone(), ROOMS[k].door.clone()]);
  const route = (from, to) => [...legs(from), ...legs(to).reverse()];

  const eggIn = (i) => EGGS.find((e) => e.room === i), eggOnFloor = (f) => EGGS.find((e) => e.room == null && (e.floor || 1) - 1 === f);
  function floorInfo(f) {
    return { rooms: ROOMS.filter((r) => r.floor === f).map((r) => ({ index: r.i, title: TRACKS[r.track].title, color: r.def.c })), frames: [0, 1, 2, 3].map((k) => (FRAMES.length ? FRAMES[(f * 4 + k) % FRAMES.length] : null)), egg: !!eggOnFloor(f) };
  }
  function setFloor(f) { floor = f; W.setFloor(f, floorInfo(f)); updateLabels(); }
  const stale = {};
  function showRoom(i) {
    delete stale[i]; const r = ROOMS[i], t = TRACKS[r.track], n = NOTES[i];
    W.showRoom(i, r.slot, { note: n && n.text ? { title: n.title || 'Note from the artist', text: n.text } : null, screen: t.screen ? { title: t.title, label: t.screen.label || 'Watch the video' } : null, egg: !!eggIn(i) });
  }

  // Getting somewhere is a short list of steps: walk to the corridor, take the lift, walk into a room.
  function travel(target) {
    if (!started || simpleMode || overlay) return;
    const cur = move ? move.to : loc, steps = [], f = lift ? lift.to : floor;
    if (isRoom(target)) { const tf = ROOMS[target].floor; if (cur === 'outside') steps.push('hall'); if (tf !== f) { if (isRoom(cur)) steps.push('hall'); steps.push({ floor: tf }); } steps.push(target); }
    else if (target === 'hall') steps.push('hall');
    else { if (isRoom(cur)) steps.push('hall'); if (f !== 0) steps.push({ floor: 0 }); steps.push('outside'); }
    queue = steps; autoDelay = -1; if (!move && !lift) next();
  }
  function toFloor(f) { if (!started || overlay) return; const cur = move ? move.to : loc; queue = cur === 'outside' ? ['hall', { floor: f }] : isRoom(cur) ? ['hall', { floor: f }] : [{ floor: f }]; autoDelay = -1; if (!move && !lift) next(); }
  function next() {
    while (queue.length) {
      const s = queue.shift();
      if (typeof s === 'object') { if (s.floor !== floor) { lift = { to: s.floor, t: 0, done: false }; closePanel(); render(); return; } continue; }
      if (s === loc) continue;
      const pts = route(loc, s), curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), len = curve.getLength();
      move = { from: loc, to: s, curve, len, t: 0, dur: reduced ? 0.6 : clamp(len / 2.05, 2.1, 6.2), cut: reduced, done: false };
      if (isRoom(s)) { showRoom(s); const r = ROOMS[s]; engine.arrive(r.track); engine.setRoom(r.track, r.def.wet, r.def.tone); }
      closePanel(); render(); return;
    }
  }
  function arrive() {
    const from = move.from; loc = move.to; move = null;
    if (isRoom(from)) { const d = engine.deck(ROOMS[from].track); if (!d.ended && trackOf(loc) !== ROOMS[from].track) d.userPaused = false; }
    for (const k in W.rooms) if (+k !== loc && queue[0] !== +k) stale[k] = 1.6; // let the door close before the room behind it is put away
    lookYaw = 0; lookPitch = 0; autoWait = 0; persist(); render(); announce(); coach();
    if (loc === 'hall' && auto && !toured && !queue.length) { toured = true; autoDelay = 2.8; }
    next();
  }
  const back = () => { const here = move ? move.to : loc; if (isRoom(here)) travel('hall'); else if (here === 'hall') { if (floor === 0) travel('outside'); else openLift(); } };

  /* ---------- the tour: on by default, it walks you into each room in order and moves on when its song ends ---------- */
  let autoDelay = -1, autoWait = 0, toured = false;
  function setAuto(v) { auto = !!v; $('auto-box').checked = auto; if (!auto) autoDelay = -1; persist(); render(); }
  $('auto-box').addEventListener('change', (e) => setAuto(e.target.checked));

  /* ---------- the guide: one short tip at a time, each shown once ---------- */
  const tips = []; let tipLeft = 0;
  function tip(id, text, force) { if (!force && seen.has(id)) return; seen.add(id); tips.push(text); }
  function hideTip() { $('guide').hidden = true; tipLeft = 0; }
  $('guide-close').addEventListener('click', hideTip);
  function coach() {
    if (loc === 'outside') tip('start', 'Tap the front door to step inside. You can drag to look around at any time.');
    else if (loc === 'hall') {
      tip('hall', auto ? 'Each door is a song. The tour will walk you into the first room in a moment, or tap any door to choose for yourself.' : 'Each door is a song. Tap a door to go in.');
      if (seen.has('room')) tip('lift', FLOORS + ' floors, ' + PER + ' rooms on each. Tap the lift on your left to change floor, or open Tracks to jump to any room.');
      const e = eggOnFloor(floor) || EGGS.find((q) => q.room != null && ROOMS[q.room] && ROOMS[q.room].floor === floor); if (e && !found.has(e.id)) tip('egg-' + e.id, 'Something is hidden on this floor. Look for a plant that does not belong.');
    } else {
      tip('room', 'The song plays while you are in its room, and the room moves with it. Tap Corridor to leave.' + (auto ? ' The tour moves on when the song ends.' : ''));
      if (TRACKS[ROOMS[loc].track].screen) tip('screen', 'This room has a screen. Tap it to watch the video without leaving.');
      if (NOTES[loc] && NOTES[loc].text) tip('note', 'A note from the artist is pinned in this room. Tap it to read.');
    }
  }
  $('tips-btn').addEventListener('click', () => { seen.clear(); tips.length = 0; hideTip(); closePanel(); coach(); persist(); });

  /* ---------- interface ---------- */
  const labels = {}, anchors = { front: new THREE.Vector3(matte ? -1.35 : -0.7, matte ? 2.3 : 2.05, 4.1), lift: new THREE.Vector3(-1.7, 2.3, -0.5) };
  let hoverDoor = -1;
  function makeLabel(key, onGo, slot) {
    const b = document.createElement('button'); b.className = 'door-label'; b.type = 'button'; b.append(document.createElement('i'), document.createElement('strong'), document.createElement('span'));
    b.addEventListener('click', onGo);
    if (slot != null) { const on = () => { hoverDoor = slot; }, off = () => { if (hoverDoor === slot) hoverDoor = -1; }; b.addEventListener('pointerenter', on); b.addEventListener('pointerleave', off); b.addEventListener('focus', on); b.addEventListener('blur', off); }
    $('labels').appendChild(b); labels[key] = b; return b;
  }
  const setLabel = (key, a, b, c) => { const el = labels[key]; el.children[0].textContent = a; el.children[1].textContent = b; el.children[2].textContent = c; };
  makeLabel('front', () => travel('hall')); setLabel('front', 'Enter', 'Front door', '');
  makeLabel('lift', () => openLift());
  for (let k = 0; k < PER; k++) { makeLabel('d' + k, () => { const ri = floor * PER + k; if (ri < NR) travel(ri); }, k); anchors['d' + k] = V(slotGeo(k).label); }
  function updateLabels() {
    setLabel('lift', 'Lift', 'Floor ' + (floor + 1) + ' of ' + FLOORS, 'Change floor');
    for (let k = 0; k < PER; k++) { const r = ROOMS[floor * PER + k]; labels['d' + k].dataset.off = r ? '' : '1'; if (r) setLabel('d' + k, two(r.i + 1), TRACKS[r.track].title, r.name); }
  }

  { // the room list, grouped by floor
    const list = $('track-list');
    for (let f = 0; f < FLOORS; f++) {
      const head = document.createElement('li'); head.className = 'floor-head'; head.textContent = 'Floor ' + (f + 1); list.appendChild(head);
      ROOMS.filter((r) => r.floor === f).forEach((r) => {
        const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.dataset.i = r.i;
        b.innerHTML = '<span class="n"></span><span class="t"><strong></strong><em></em></span><span class="d"></span>';
        b.querySelector('.n').textContent = two(r.i + 1); b.querySelector('strong').textContent = TRACKS[r.track].title; b.querySelector('.d').textContent = fmt(TRACKS[r.track].duration);
        b.addEventListener('click', () => travel(r.i)); li.appendChild(b); list.appendChild(li);
      });
    }
  }
  function closePanel() { $('panel').hidden = true; $('tracks-btn').setAttribute('aria-expanded', 'false'); }
  $('tracks-btn').addEventListener('click', () => { const open = $('panel').hidden; $('panel').hidden = !open; $('tracks-btn').setAttribute('aria-expanded', String(open)); if (open) { render(); const here = $('track-list').querySelector('button.here') || $('track-list').querySelector('button'); here.focus(); } });
  $('back-btn').addEventListener('click', back);
  const setReduced = (v) => { reduced = !!v; $('reduce-a').checked = reduced; $('reduce-b').checked = reduced; persist(); };
  $('reduce-a').addEventListener('change', (e) => setReduced(e.target.checked)); $('reduce-b').addEventListener('change', (e) => setReduced(e.target.checked)); setReduced(reduced); $('auto-box').checked = auto;
  $('play-btn').addEventListener('click', () => { if (isRoom(loc)) engine.toggle(trackOf(loc)); });
  $('replay-btn').addEventListener('click', () => { if (isRoom(loc)) engine.replay(trackOf(loc)); });
  const fill = (el) => el.style.setProperty('--p', (el.max > 0 ? el.value / el.max * 100 : 0) + '%');
  $('volume').value = Math.round(engine.master * 100); fill($('volume'));
  $('volume').addEventListener('input', (e) => { engine.setVolume(e.target.value / 100); fill(e.target); persist(); });
  let seeking = false;
  $('seek').addEventListener('input', () => { seeking = true; fill($('seek')); $('time').textContent = fmt($('seek').value) + ' / ' + fmt(isRoom(loc) ? TRACKS[trackOf(loc)].duration : 0); });
  $('seek').addEventListener('change', (e) => { if (isRoom(loc)) engine.seek(trackOf(loc), +e.target.value); seeking = false; });
  engine.onstate = () => render();
  engine.onblocked = () => { $('hint').textContent = 'Sound is blocked. Tap Play to start the song.'; };

  $('enter-btn').addEventListener('click', () => {
    if (started) return;
    engine.unlock(); started = true; document.body.classList.add('started'); render(); announce(); coach();
    labels.front.focus({ preventScroll: true });
  });

  function announce() {
    let text = '';
    if (loc === 'outside') text = 'Front steps at dusk. The front door is ahead.';
    else if (loc === 'hall') text = 'Corridor, floor ' + (floor + 1) + ' of ' + FLOORS + '. ' + ROOMS.filter((r) => r.floor === floor).map((r) => 'Door ' + (r.i + 1) + ': ' + TRACKS[r.track].title + ', ' + r.name).join('. ') + '.';
    else text = ROOMS[loc].name + '. Now playing ' + TRACKS[trackOf(loc)].title + '.';
    $('live').textContent = text;
  }
  function render() {
    const idle = !move && !lift, inRoom = idle && isRoom(loc);
    document.body.dataset.loc = !idle ? 'moving' : inRoom ? 'room' : loc;
    $('hud').hidden = !inRoom; $('back-btn').hidden = !started || !idle || loc === 'outside';
    $('back-btn').textContent = inRoom ? 'Corridor' : floor === 0 ? 'Front steps' : 'Lift';
    $('back-btn').setAttribute('aria-label', inRoom ? 'Back to the corridor' : floor === 0 ? 'Back out to the front steps' : 'Open the lift');
    $('hint').textContent = !started || !idle ? '' : loc === 'outside' ? 'Tap the front door' : loc === 'hall' ? 'Floor ' + (floor + 1) + '  ·  choose a door' + (auto && autoDelay >= 0 ? '  ·  tour starting' : '') : '';
    if (inRoom) {
      const r = ROOMS[loc], t = TRACKS[r.track], d = engine.deck(r.track), paused = d.userPaused || d.ended;
      $('hud-n').textContent = two(loc + 1) + ' — ' + r.name + ' · floor ' + (r.floor + 1) + (auto ? ' · tour on' : ''); $('hud-title').textContent = t.title; $('hud-artist').textContent = t.artist || '';
      $('play-btn').textContent = paused ? 'Play' : 'Pause'; $('play-btn').setAttribute('aria-pressed', String(!paused));
      $('seek').max = Math.floor(t.duration); $('note-btn').hidden = !(NOTES[loc] && NOTES[loc].text); $('video-btn').hidden = !t.screen;
    }
    document.querySelectorAll('#track-list button').forEach((b) => {
      const k = +b.dataset.i, r = ROOMS[k], d = engine.deck(r.track), here = loc === k && !move;
      b.classList.toggle('here', here); b.querySelector('em').textContent = r.name + (here ? ' · you are here' : d.P > 1 ? ' · resumes at ' + fmt(d.P) : '');
    });
  }

  /* ---------- overlays: lift, note, video, hidden reward ---------- */
  let lastFocus = null;
  const openOverlay = (kind, el, focusEl) => { overlay = kind; lastFocus = document.activeElement; el.hidden = false; if (focusEl) focusEl.focus(); };
  const closeOverlay = (el) => { el.hidden = true; overlay = null; if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); };
  { const box = $('lift-floors'); for (let f = FLOORS - 1; f >= 0; f--) { const b = document.createElement('button'); b.type = 'button'; b.dataset.f = f; b.innerHTML = '<i></i><strong></strong>'; b.children[0].textContent = two(f + 1); b.children[1].textContent = ROOMS.filter((r) => r.floor === f).map((r) => r.name).join(' · '); b.addEventListener('click', () => { closeOverlay($('lift-view')); toFloor(f); }); box.appendChild(b); } }
  function openLift() { if (overlay || move || lift || !started) return; document.querySelectorAll('#lift-floors button').forEach((b) => b.classList.toggle('here', +b.dataset.f === floor)); openOverlay('lift', $('lift-view'), $('lift-floors').querySelector('button.here')); }
  $('lift-close').addEventListener('click', () => closeOverlay($('lift-view')));
  function openNote(k) { const n = NOTES[k]; if (!n || overlay) return; $('note-title').textContent = n.title || 'Note from the artist'; $('note-text').textContent = n.text; openOverlay('note', $('note-view'), $('note-close')); }
  $('note-close').addEventListener('click', () => closeOverlay($('note-view')));
  $('note-btn').addEventListener('click', () => openNote(loc));
  function openEgg(e) {
    if (!e || overlay) return; found.add(e.id); persist();
    $('egg-title').textContent = e.title || 'You found it'; $('egg-text').textContent = e.message || ''; $('egg-code').textContent = e.code || ''; $('egg-where').textContent = e.where || ''; $('egg-copy').textContent = 'Copy code';
    openOverlay('egg', $('egg-view'), $('egg-close')); $('live').textContent = 'Hidden reward found. Code: ' + (e.code || '');
  }
  $('egg-close').addEventListener('click', () => closeOverlay($('egg-view')));
  $('egg-copy').addEventListener('click', () => {
    const code = $('egg-code'), sel = () => { const r = document.createRange(); r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('egg-copy').textContent = 'Selected — copy it'; };
    try { navigator.clipboard.writeText(code.textContent).then(() => { $('egg-copy').textContent = 'Copied'; }, sel); } catch (err) { sel(); }
  });
  for (const id of ['note-view', 'egg-view', 'lift-view']) $(id).addEventListener('click', (e) => { if (e.target === $(id)) closeOverlay($(id)); });
  // The video always plays inside Noizes. In the viewer the viewer itself shows the player (YouTube cannot run inside
  // the sandbox the house runs in); served on its own, the house shows the player in its own overlay.
  const viewerCaps = (window.NZ_VIEWER_STATE && window.NZ_VIEWER_STATE.capabilities) || {};
  const viaViewer = window.parent !== window && Array.isArray(viewerCaps.media_overlay) && viewerCaps.media_overlay.indexOf('youtube') >= 0;
  function openScreen(k) {
    const i = trackOf(k), t = TRACKS[i]; if (i < 0 || !t.screen || overlay) return;
    const d = engine.deck(i); videoPaused = !d.userPaused && !d.ended ? i : -1; if (videoPaused >= 0) engine.toggle(i);
    overlay = 'video'; lastFocus = document.activeElement;
    if (viaViewer) { window.parent.postMessage({ type: 'noizes:media:open', provider: 'youtube', video_id: t.screen.video_id, title: t.title }, '*'); return; }
    const f = document.createElement('iframe'); f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(t.screen.video_id) + '?autoplay=1&playsinline=1&rel=0&modestbranding=1';
    f.title = t.title + ' — video'; f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true; f.referrerPolicy = 'strict-origin-when-cross-origin';
    $('video-frame').replaceChildren(f); $('video-title').textContent = t.title; $('video-offline').hidden = navigator.onLine !== false; $('video-view').hidden = false; $('video-close').focus();
  }
  function closeScreen() {
    if (overlay !== 'video') return;
    $('video-frame').replaceChildren(); $('video-view').hidden = true; document.body.classList.remove('video-max'); if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    overlay = null; if (videoPaused >= 0) { engine.deck(videoPaused).userPaused = false; engine.onstate(); } videoPaused = -1;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $('video-close').addEventListener('click', closeScreen);
  $('video-full').addEventListener('click', () => {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    const v = $('video-view'), p = v.requestFullscreen ? v.requestFullscreen() : null;
    if (p && p.catch) p.catch(() => document.body.classList.toggle('video-max')); else if (!p) document.body.classList.toggle('video-max');
  });
  $('video-btn').addEventListener('click', () => openScreen(loc));
  window.addEventListener('message', (e) => { if (e.source === window.parent && e.data && e.data.type === 'noizes:media:closed') closeScreen(); });
  function escapeOverlay() { if (overlay === 'video') closeScreen(); else if (overlay === 'note') closeOverlay($('note-view')); else if (overlay === 'egg') closeOverlay($('egg-view')); else if (overlay === 'lift') closeOverlay($('lift-view')); }

  /* ---------- input: tap doors and things, drag to look, keys ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), canvas = $('scene');
  function actionFor(o) {
    const key = o.userData.hit, rm = o.userData.room;
    if (loc === 'outside') return key === 'front' ? { to: 'hall' } : null;
    if (loc === 'hall') {
      if (rm != null) return null;
      if (key.indexOf('door:') === 0) { const k = +key.slice(5), ri = floor * PER + k; return ri < NR ? { to: ri, door: k } : null; }
      return key === 'front' ? (floor === 0 ? { to: 'outside' } : null) : key === 'lift' ? { lift: true } : key === 'egg' ? { egg: eggOnFloor(floor) } : null;
    }
    if (rm === loc) return key === 'note' ? { note: loc } : key === 'screen' ? { screen: loc } : key === 'egg' ? { egg: eggIn(loc) } : key === 'exit' ? { to: 'hall' } : null;
    return key === 'door:' + ROOMS[loc].slot ? { to: 'hall' } : null;
  }
  function pick(x, y) {
    if (move || lift || !started || overlay) return null;
    const r = canvas.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    for (const h of ray.intersectObjects(W.activeHits(), false)) { const a = actionFor(h.object); if (a) return a; }
    return null;
  }
  function act(a) { if (a.note != null) openNote(a.note); else if (a.screen != null) openScreen(a.screen); else if (a.egg) openEgg(a.egg); else if (a.lift) openLift(); else if (a.to != null) travel(a.to); }
  let drag = null, lastHover = 0;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 7) drag.moved = true;
      if (drag.moved && !move && !lift) { lookYaw += dx * 0.0042; lookPitch += dy * 0.0042; clampLook(); }
    } else if (e.pointerType === 'mouse' && e.timeStamp - lastHover > 60) { lastHover = e.timeStamp; const a = pick(e.clientX, e.clientY); canvas.style.cursor = a ? 'pointer' : 'grab'; hoverDoor = a && a.door != null ? a.door : -1; }
  });
  const endDrag = (e) => { if (!drag) return; const tap = !drag.moved && performance.now() - drag.t < 600; drag = null; if (tap) { const a = pick(e.clientX, e.clientY); if (a) act(a); } };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', () => { drag = null; });
  function clampLook() {
    if (loc === 'outside' && matte && matte.opacity > 0.5) { const tall = window.innerWidth < window.innerHeight; lookYaw = clamp(lookYaw, tall ? -0.3 : -0.05, tall ? 0.3 : 0.05); lookPitch = clamp(lookPitch, -0.03, 0.03); return; }
    const m = isRoom(loc) ? 2.7 : loc === 'hall' ? 1.2 : 0.6; lookYaw = clamp(lookYaw, -m, m); lookPitch = clamp(lookPitch, -0.5, 0.5);
  }
  const keys = {};
  window.addEventListener('keydown', (e) => {
    if (simpleMode || e.metaKey || e.ctrlKey || e.altKey) return;
    if (overlay) { if (e.key === 'Escape') escapeOverlay(); return; }
    const tag = e.target && e.target.tagName, onControl = tag === 'INPUT' || tag === 'BUTTON' || tag === 'AUDIO';
    if (e.key === 'Escape') { if (!$('panel').hidden) { closePanel(); $('tracks-btn').focus(); } else if (!$('guide').hidden) hideTip(); else back(); return; }
    if (!started) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { if (tag === 'INPUT') return; keys[e.key] = true; e.preventDefault(); return; }
    if (tag === 'INPUT') return;
    if (e.key >= '1' && e.key <= String(PER)) { const ri = (lift ? lift.to : floor) * PER + (+e.key - 1); if (ri < NR) travel(ri); return; }
    if (e.key === '0' || e.key === 'h' || e.key === 'H') { travel('hall'); return; }
    if (e.key === 'PageUp') { e.preventDefault(); if (floor < FLOORS - 1) toFloor(floor + 1); return; }
    if (e.key === 'PageDown') { e.preventDefault(); if (floor > 0) toFloor(floor - 1); return; }
    if (e.key === 'l' || e.key === 'L') { openLift(); return; }
    if (e.key === 'a' || e.key === 'A') { setAuto(!auto); return; }
    if (e.key === 'Backspace') { back(); return; }
    if (e.key === 't' || e.key === 'T') { $('tracks-btn').click(); return; }
    if (onControl) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (loc === 'outside') travel('hall'); else if (isRoom(loc) && !move) engine.toggle(trackOf(loc)); }
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  /* ---------- frame ---------- */
  let baseFov = 58;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight; renderer.setPixelRatio(prBase * prScale); renderer.setSize(w, h, false);
    if (post) { const b = renderer.getDrawingBufferSize(new THREE.Vector2()); post.setSize(b.x, b.y); }
    camera.aspect = w / h; baseFov = w / h < 0.8 ? 75 : w / h < 1.2 ? 67 : 58; camera.fov = baseFov; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const tmpB = new THREE.Vector3(), proj = new THREE.Vector3(), fade = $('fade');
  const clarity = (i) => clamp(1 - camera.position.distanceTo(ROOMS[i].pos) / ROOMS[i].reach, 0, 1);
  const energyAt = (t, time) => { const e = t.energy, i = clamp(Math.floor(time), 0, e.length - 1), j = Math.min(e.length - 1, i + 1), f = clamp(time - i, 0, 1); return e[i] + (e[j] - e[i]) * f; };
  // What each song sounds like right now, read live where possible and estimated from the pre-analysed song where not.
  const HEAR = TRACKS.map(() => ({ on: false, level: 0, bass: 0, mid: 0, high: 0, kick: 0, snare: 0, hat: 0, hit: false, bands: new Float32Array(16), fb: new Float32Array(16), ph: 0, red: false, t: 0 }));
  let heardAt = TRACKS.map(() => -1), frameNo = 0, clock = 0;
  function hear(i, dt) {
    const A = HEAR[i]; if (heardAt[i] === frameNo) return A; heardAt[i] = frameNo;
    const d = engine.deck(i), t = TRACKS[i], time = d.el.currentTime, on = started && !d.el.paused && d.cur > 0.05, L = on ? engine.levels(i, dt) : null;
    A.on = on; A.red = reduced; A.t = clock;
    if (L) { A.level = L.level; A.bass = L.bass * (reduced ? 0.4 : 1); A.mid = L.mid; A.high = L.high; A.kick = reduced ? 0 : L.pulse; A.snare = L.snare; A.hat = L.hat; A.hit = L.hit; A.bands = L.bands; }
    else {
      const e = on ? energyAt(t, time) : 0, ph = (time * t.bpm / 60) % 1, k = on && time >= (t.onset || 0) ? Math.pow(1 - ph, 3) * e : 0;
      A.level += (e - A.level) * Math.min(1, dt * 3); A.bass = k * (reduced ? 0.4 : 1); A.mid = A.level * 0.7; A.high = A.level * 0.5; A.kick = reduced ? 0 : k; A.snare = 0; A.hat = 0; A.hit = on && ph < A.ph && k > 0.1; A.ph = ph;
      for (let b = 0; b < 16; b++) A.fb[b] = A.level * (0.4 + 0.3 * Math.sin(b * 0.7 + clock * 1.3)) * (1 - b / 26) + (b < 4 ? k * 0.4 : 0); A.bands = A.fb;
    }
    return A;
  }
  let last = performance.now(), hudTick = 0, saveTick = 0;

  // If the device cannot hold the frame rate, step the finish down rather than stutter: resolution, then the glow and grade pass, then resolution again.
  let perfN = 0, perfSum = 0; const fixedTier = QS.get('tier') != null || QS.get('view') != null;
  function stepDown() {
    tier++;
    if (tier === 1) prScale = 0.8; else if (tier === 2) { if (post) { post.dispose(); post = null; renderer.toneMapping = THREE.ACESFilmicToneMapping; } } else prScale = 0.62;
    resize();
  }
  function frame(now) {
    requestAnimationFrame(frame); const raw = (now - last) / 1000, dt = Math.min(0.1, raw); last = now;
    if (started && !fixedTier && !document.hidden && raw < 0.25 && tier < 3) { perfSum += raw; if (++perfN >= 90) { if (perfSum / perfN > 0.0235) stepDown(); perfN = 0; perfSum = 0; } }
    tick(dt);
  }
  let idleT = 0; const wake = () => { idleT = 0; if (document.body.classList.contains('idle')) document.body.classList.remove('idle'); };
  for (const ev of ['pointerdown', 'pointermove', 'keydown', 'focusin', 'touchstart']) window.addEventListener(ev, wake, { passive: true });

  function tick(dt) {
    clock += dt; frameNo++;
    if (simpleMode) return;
    idleT += dt; if (idleT > 6 && started && !fixedTier && !move && $('panel').hidden && !document.body.classList.contains('idle')) document.body.classList.add('idle');
    // the lift: a fade, the floor changes while it is dark
    if (lift) {
      lift.t += dt; const q = lift.t / 1.5; fade.style.opacity = String(clamp(q < 0.3 ? q / 0.3 : q < 0.7 ? 1 : (1 - q) / 0.3, 0, 1));
      if (q >= 0.3 && !lift.done) { lift.done = true; setFloor(lift.to); $('floor-card').textContent = 'Floor ' + (lift.to + 1); $('floor-card').hidden = false; for (const k in W.rooms) W.hideRoom(+k); }
      if (q >= 0.72) $('floor-card').hidden = true;
      if (q >= 1) { lift = null; fade.style.opacity = '0'; render(); announce(); coach(); next(); }
    }
    // movement
    let ty, tp;
    if (move) {
      move.t += dt; const q = clamp(move.t / move.dur, 0, 1), end = stationAngles(move.to);
      if (move.cut) {
        fade.style.opacity = String(q < 0.5 ? q * 2 : 2 - q * 2);
        if (q >= 0.5 && !move.done) { move.done = true; camera.position.copy(station(move.to).pos); yaw = end.yaw; pitch = end.pitch; for (const d of W.doors.concat(W.front)) d.angle = d.target; W.shadowFrames = 3; }
        ty = move.done ? end.yaw : yaw; tp = move.done ? end.pitch : pitch;
      } else {
        const u = ease(q); move.curve.getPointAt(u, camera.position);
        camera.position.y += Math.sin(u * move.len * 3.6) * 0.009 * Math.sin(Math.PI * q);
        move.curve.getPointAt(Math.min(1, u + 0.07), tmpB); const d = dirAngles(camera.position, tmpB), w = clamp((u - 0.62) / 0.38, 0, 1), k = w * w * (3 - 2 * w);
        ty = u > 0.93 ? end.yaw : d.yaw + wrap(end.yaw - d.yaw) * k; tp = (u > 0.93 ? end.pitch : d.pitch * 0.5 * (1 - k) + end.pitch * k);
      }
      lookYaw *= Math.max(0, 1 - dt * 5); lookPitch *= Math.max(0, 1 - dt * 5);
      if (q >= 1) { camera.position.copy(station(move.to).pos); fade.style.opacity = '0'; arrive(); }
    } else { const a = stationAngles(loc); ty = a.yaw; tp = a.pitch; }
    const rate = Math.min(1, dt * (move ? 3.4 : 2.6));
    yaw += wrap(ty - yaw) * rate; pitch += (tp - pitch) * rate;
    if (!move && !lift) { const sp = dt * 1.4; if (keys.ArrowLeft) lookYaw += sp; if (keys.ArrowRight) lookYaw -= sp; if (keys.ArrowUp) lookPitch += sp * 0.7; if (keys.ArrowDown) lookPitch -= sp * 0.7; clampLook(); }
    const sway = reduced || move ? 0 : 1;
    camera.rotation.set(pitch + lookPitch + Math.sin(clock * 0.23) * 0.004 * sway, yaw + lookYaw + Math.sin(clock * 0.31) * 0.006 * sway, 0);

    // doors
    const frontOpen = floor === 0 && move && (move.from === 'outside' || move.to === 'outside');
    W.front[0].target = frontOpen ? W.front[0].open : 0; W.front[1].target = frontOpen ? W.front[1].open : W.front[1].rest;
    for (let k = 0; k < PER; k++) { const ri = floor * PER + k, open = ri < NR && (loc === ri || (move && (move.from === ri || move.to === ri))); W.doors[k].target = open ? W.doors[k].open : 0; }
    for (const k in stale) { stale[k] -= dt; if (stale[k] <= 0) { delete stale[k]; const i = +k; if (loc !== i && !(move && (move.to === i || move.from === i))) W.hideRoom(i); } }

    // what should be heard
    const focus = !move && !lift && loc === 'hall' ? focusDoor() : -1, focusRoom = focus >= 0 && floor * PER + focus < NR ? floor * PER + focus : -1;
    let wish = { track: -1, clarity: 0 }, zone = floor === 0 && camera.position.z > 3.6 ? 'outside' : 'hall', near = 0;
    if (started) {
      if (move) {
        const f = trackOf(move.from), t = trackOf(move.to), cf = f >= 0 ? clarity(move.from) : 0, ct = t >= 0 ? clarity(move.to) : 0;
        if (f >= 0 && cf > 0.02) wish = { track: f, clarity: cf }; else if (t >= 0) wish = { track: t, clarity: Math.min(0.998, ct) }; else if (f >= 0) wish = { track: f, clarity: 0 };
        if (cf > 0.3) { zone = move.from; near = cf; } else if (ct > 0.3) { zone = move.to; near = ct; }
      } else if (isRoom(loc)) { wish = { track: trackOf(loc), clarity: 1 }; zone = loc; near = 1; }
      else if (focusRoom >= 0) wish = { track: trackOf(focusRoom), clarity: 0 };
    }
    engine.wish = wish; engine.rain = !started ? 0 : zone === 'outside' ? 0.05 : floor === 0 ? 0.02 * (1 - Math.min(1, near * 2.5)) : 0;
    engine.update(dt);

    // the rooms answer their songs
    const s = { reduced, time: clock, zone, rooms: {}, focus: focusRoom >= 0 ? focus : -1, preview: focusRoom >= 0 ? hear(trackOf(focusRoom), dt) : null, camZ: camera.position.z };
    for (const k in W.rooms) s.rooms[k] = hear(ROOMS[+k].track, dt);
    W.update(dt, s);
    if (matte) { const z = camera.position.z, k = floor === 0 ? clamp((z - 7.8) / 3.7, 0, 1) : 0; matte.set(k * k * (3 - 2 * k)); }
    const here = isRoom(loc) && !move ? HEAR[trackOf(loc)] : null;
    if (post) post.uniforms.uBloom.value = 0.1 + (here && here.on ? here.bass * (reduced ? 0.015 : 0.06) : 0);
    const fov = baseFov - (here && here.on && !reduced ? here.kick * 0.55 : 0); if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    if (post) post.render(scene, camera, clock, reduced); else { renderer.setRenderTarget(null); renderer.render(scene, camera); }

    // door labels follow their doors
    const w = window.innerWidth, h = window.innerHeight, placed = [];
    for (const key in labels) {
      const el = labels[key], show = started && !move && !lift && !el.dataset.off && (key === 'front' ? loc === 'outside' : loc === 'hall');
      let vis = false;
      if (show) { proj.copy(anchors[key]).project(camera); if (proj.z < 1 && Math.abs(proj.x) < 1.25) vis = true; }
      if (vis) { // keep labels from sitting on top of each other
        const hw = el.offsetWidth / 2 || 60, hh = el.offsetHeight / 2 || 24; let x = clamp((proj.x * 0.5 + 0.5) * w, hw + 8, w - hw - 8), y = clamp((-proj.y * 0.5 + 0.5) * h, 70, h - 150);
        for (const o of placed) if (Math.abs(o.x - x) < o.hw + hw + 6 && Math.abs(o.y - y) < o.hh + hh + 6) y = o.y + o.hh + hh + 8;
        placed.push({ x, y, hw, hh }); el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%)';
      }
      if (el.dataset.vis !== String(vis)) { el.dataset.vis = String(vis); el.classList.toggle('on', vis); el.tabIndex = vis ? 0 : -1; el.setAttribute('aria-hidden', String(!vis)); }
    }

    // the tour
    if (autoDelay >= 0) { if (loc === 'hall' && !move && !lift && !overlay && $('panel').hidden) { autoDelay -= dt; if (autoDelay < 0) { travel(floor * PER < NR ? floor * PER : 0); } } }
    if (auto && isRoom(loc) && !move && !lift && !overlay) {
      if (engine.deck(trackOf(loc)).ended) { autoWait += dt; if (autoWait > 1.4) { autoWait = 0; if (loc + 1 < NR) travel(loc + 1); else { travel('hall'); tip('tour-end', 'That was the last room, so the tour is over. Wander wherever you like.', true); } } } else autoWait = 0;
    }
    // the guide
    if (tipLeft > 0) { tipLeft -= dt; if (tipLeft <= 0) hideTip(); }
    else if (tips.length && started && !overlay && !lift) { $('guide-text').textContent = tips.shift(); $('guide').hidden = false; tipLeft = 9; }

    hudTick += dt; saveTick += dt;
    if (hudTick > 0.25) {
      hudTick = 0;
      if (!move && isRoom(loc) && !seeking) { const d = engine.deck(trackOf(loc)), t = d.pendingSeek != null ? d.pendingSeek : d.el.currentTime; $('seek').value = Math.floor(t); fill($('seek')); $('time').textContent = fmt(t) + ' / ' + fmt(TRACKS[trackOf(loc)].duration); }
    }
    if (saveTick > 3) { saveTick = 0; persist(); }
  }
  // In the corridor the door you point at, tab to, or face is the one you overhear.
  function focusDoor() {
    if (hoverDoor >= 0) return hoverDoor;
    let best = -1, bd = 9;
    for (let k = 0; k < PER; k++) { if (floor * PER + k >= NR) continue; const a = dirAngles(camera.position, anchors['d' + k]), d = Math.abs(wrap(a.yaw - (yaw + lookYaw))); if (d < bd) { bd = d; best = k; } }
    return bd < 0.45 ? best : -1;
  }
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

  setFloor(0);
  // test hooks: advance the house in fixed steps (used when the page is throttled or headless), and look inside
  window.__house = {
    engine, scene, renderer, travel, toFloor, setAuto, openEgg,
    state: () => ({ loc, floor, moving: !!move, to: move && move.to, queue: queue.slice(), lift: !!lift, auto, tier, overlay, rooms: Object.keys(W.rooms), wish: engine.wish, playing: engine.decks.map((d) => !d.el.paused), gains: engine.decks.map((d) => +d.cur.toFixed(3)), times: engine.decks.map((d) => +d.el.currentTime.toFixed(2)), P: engine.decks.map((d) => +d.P.toFixed(2)), graph: engine.graph() }),
    step: (seconds) => { for (let i = 0, n = Math.round(seconds * 30); i < n; i++) tick(1 / 30); },
    look: (y, p) => { lookYaw = y; lookPitch = p || 0; },
  };
  // ?view=outside | hall | <room number 1..N> shows a silent still of that spot (used for captures; sound is never started). &floor=1..4 picks the corridor.
  const still = QS.get('view');
  if (still) {
    const ri = /^\d+$/.test(still) ? +still - 1 : -1, where = ri >= 0 && ri < NR ? ri : still === 'hall' ? 'hall' : 'outside';
    started = true; auto = false; loc = where; document.body.classList.add('started', 'still');
    setFloor(isRoom(where) ? ROOMS[where].floor : where === 'hall' ? clamp((+QS.get('floor') || 1) - 1, 0, FLOORS - 1) : 0); if (isRoom(where)) showRoom(where);
    camera.position.copy(station(where).pos); const a = stationAngles(where); yaw = a.yaw; pitch = a.pitch; lookYaw = parseFloat(QS.get('yaw')) || 0;
    const pf = parseFloat(QS.get('fov')); if (pf) { baseFov = pf; camera.fov = pf; camera.updateProjectionMatrix(); }
    if (QS.get('plate') === '1' && post) { post.uniforms.uGrain.value = 0; post.uniforms.uVignette.value = 0; }
    for (let i = 0; i < 90; i++) tick(1 / 30);
    if (QS.get('ui') === '0' || QS.get('plate') === '1') document.body.classList.add('bare');
  }
  render(); requestAnimationFrame(frame);
})();
