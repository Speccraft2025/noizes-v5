/* The House That Remembered Us — sound.
   One deck per song. The app only ever states a wish: "this track, at this
   clarity" (0 = muffled behind a door, 1 = in the room). The engine walks every
   deck toward that wish each frame and enforces the one rule that matters:
   a deck may not start until every other deck is silent and paused. */
function createAudioEngine(tracks, saved) {
  const LEAK = 0.16, FADE_OUT = 5, FADE_IN = 1.5;
  // file:// pages get silence from MediaElementSource (opaque origin), so fall back to plain element volume there.
  const AC = window.AudioContext || window.webkitAudioContext;
  let graph = !!AC && location.protocol !== 'file:';
  let ctx = null, master = null, rainGain = null;
  const E = { master: saved.volume != null ? saved.volume : 0.9, wish: { track: -1, clarity: 0 }, rain: 0, enabled: false, decks: [], graph: () => graph, onstate: () => {}, onblocked: () => {} };

  function impulse(seconds, decay, bright) {
    const n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { const v = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); lp += (v - lp) * bright; d[i] = lp; } }
    return b;
  }
  // Each room has its own acoustic: a close, dry den; a tall glass hall; an open stone court.
  // One medium room response per song; how much of it you hear, and the tone, is set per room by the app (E.setRoom).
  const IR = [1.4, 3.0, 0.6];

  function makeDeck(track, i) {
    const el = new Audio(); el.preload = 'auto'; el.src = track.src; el.playsInline = true;
    const d = { i, el, track, cur: 0, P: saved.positions && saved.positions[track.key || track.id] > 0 ? saved.positions[track.key || track.id] : 0, userPaused: false, dip: false, wantPlay: false, pendingSeek: null, silentFor: 0 };
    el.addEventListener('loadedmetadata', () => { if (d.P > 0 && d.P < el.duration - 2) el.currentTime = d.P; else d.P = 0; });
    el.addEventListener('ended', () => { d.P = 0; d.userPaused = true; d.ended = true; el.currentTime = 0; E.onstate(); });
    el.addEventListener('play', () => E.onstate()); el.addEventListener('pause', () => E.onstate());
    if (graph) wire(d);
    return d;
  }
  function wire(d) {
    d.src = ctx.createMediaElementSource(d.el);
    d.filter = ctx.createBiquadFilter(); d.filter.type = 'lowpass'; d.filter.frequency.value = 320; d.filter.Q.value = 0.6;
    d.shelf = ctx.createBiquadFilter(); d.shelf.type = 'highshelf'; d.shelf.frequency.value = 5000; d.shelf.gain.value = 0; d.wetAmt = 0.1;
    d.gain = ctx.createGain(); d.gain.gain.value = 0;
    d.conv = ctx.createConvolver(); d.conv.buffer = impulse(...IR);
    d.wet = ctx.createGain(); d.wet.gain.value = 0;
    d.probe = ctx.createAnalyser(); d.probe.fftSize = 256;
    d.src.connect(d.probe);
    // a separate pre-fade spectrum, so the rooms react to the song itself and not to how loud the door lets it through
    d.spec = ctx.createAnalyser(); d.spec.fftSize = 1024; d.spec.smoothingTimeConstant = 0.45; d.spec.minDecibels = -90; d.spec.maxDecibels = -18; d.src.connect(d.spec);
    d.src.connect(d.filter); d.filter.connect(d.shelf); d.shelf.connect(d.gain); d.gain.connect(master);
    d.gain.connect(d.conv); d.conv.connect(d.wet); d.wet.connect(master);
  }

  E.init = function () {
    if (graph) {
      try {
        ctx = new AC(); master = ctx.createGain(); master.gain.value = E.master; master.connect(ctx.destination);
        // soft rain bed for the forecourt and corridor: filtered noise, never in a room
        const n = ctx.sampleRate * 3, buf = ctx.createBuffer(1, n, ctx.sampleRate), ch = buf.getChannelData(0);
        for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
        rainGain = ctx.createGain(); rainGain.gain.value = 0; src.connect(hp); hp.connect(lp); lp.connect(rainGain); rainGain.connect(master); src.start();
      } catch (e) { graph = false; ctx = null; }
    }
    E.decks = tracks.map(makeDeck);
  };
  // Must run inside the "Enter house" gesture: resumes the context and unlocks every element.
  E.unlock = function () {
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    const jobs = E.decks.map((d) => {
      d.el.muted = true;
      const p = d.el.play();
      return (p && p.then ? p : Promise.resolve()).then(() => { d.el.pause(); }).catch(() => {}).then(() => { d.el.muted = false; if (d.el.readyState > 0) d.el.currentTime = d.P; });
    });
    return Promise.all(jobs).then(() => { E.enabled = true; });
  };
  E.setRoom = function (i, wet, tone) { const d = E.decks[i]; if (!d || !d.shelf) return; d.wetAmt = wet; d.shelf.gain.setTargetAtTime(tone || 0, ctx.currentTime, 0.3); };
  E.setVolume = function (v) { E.master = Math.max(0, Math.min(1, v)); };
  E.deck = (i) => E.decks[i];
  E.toggle = function (i) {
    const d = E.decks[i]; if (!d) return;
    d.userPaused = !d.userPaused; d.ended = false;
    if (d.userPaused) d.el.pause();
    E.onstate();
  };
  E.replay = function (i) { const d = E.decks[i]; if (!d) return; d.P = 0; d.ended = false; d.userPaused = false; d.pendingSeek = 0; d.dip = true; E.onstate(); };
  E.seek = function (i, t) { const d = E.decks[i]; if (!d || !isFinite(d.el.duration)) return; d.P = Math.max(0, Math.min(d.el.duration - 0.25, t)); d.ended = false; d.pendingSeek = d.P; d.dip = true; };
  // Entering a room: if the muffled preview has wandered away from where you last listened, duck and return there.
  E.arrive = function (i) { const d = E.decks[i]; if (!d) return; d.userPaused = false; d.ended = false; if (Math.abs(d.el.currentTime - d.P) > 3) { d.pendingSeek = d.P; d.dip = true; } };
  E.stopAll = function () { E.wish = { track: -1, clarity: 0 }; for (const d of E.decks) { d.el.pause(); d.cur = 0; if (d.gain) d.gain.gain.value = 0; } };
  // Live reading of a playing deck: bass, mids, highs and overall level (each 0..1 with slow automatic gain),
  // a kick pulse that jumps to 1 on a bass hit and decays, and the raw spectrum for anything that draws one.
  // Returns null when there is no audio graph (file:// or a degraded device); the rooms then use the pre-analysed energy.
  E.levels = function (i, dt) {
    const d = E.decks[i]; if (!d || !d.spec || d.el.paused) return null;
    if (!d.lv) { d.fbuf = new Uint8Array(d.spec.frequencyBinCount); d.lv = { bass: 0, mid: 0, high: 0, level: 0, pulse: 0, hit: false, avg: 0.3, since: 1, lo: null, hi: null, spec: d.fbuf, bands: new Float32Array(16), snare: 0, hat: 0, mavg: 0.3, havg: 0.3, s2: 1, s3: 1 }; }
    d.spec.getByteFrequencyData(d.fbuf);
    const hz = ctx.sampleRate / d.spec.fftSize, L = d.lv;
    const band = (a, b) => { let s = 0, n = 0; for (let k = Math.max(1, Math.round(a / hz)); k <= Math.round(b / hz); k++) { s += d.fbuf[k]; n++; } return n ? s / n / 255 : 0; };
    const raw = [band(35, 140), band(250, 2000), band(3000, 11000)]; raw.push(raw[0] * 0.5 + raw[1] * 0.35 + raw[2] * 0.15);
    // each band is placed between a floor that rises slowly and a ceiling that falls slowly, so a loud master still moves 0..1
    if (!L.lo) { L.lo = raw.map((x) => x * 0.8); L.hi = raw.map((x) => x + 0.15); }
    const v = raw.map((x, j) => {
      L.lo[j] = Math.min(x, L.lo[j] + dt * 0.03); L.hi[j] = Math.max(x, L.hi[j] - dt * 0.03, L.lo[j] + 0.12);
      return Math.max(0, Math.min(1, (x - L.lo[j]) / (L.hi[j] - L.lo[j])));
    });
    const sm = (o, x, up, down) => o + (x - o) * Math.min(1, dt * (x > o ? up : down));
    L.bass = sm(L.bass, v[0], 20, 7); L.mid = sm(L.mid, v[1], 8, 3); L.high = sm(L.high, v[2], 12, 5); L.level = sm(L.level, v[3], 5, 1.6);
    L.avg += (v[0] - L.avg) * Math.min(1, dt * 2.5); L.since += dt; L.hit = false;
    if (v[0] > L.avg + 0.22 && v[0] > 0.5 && L.since > 0.26) { L.hit = true; L.since = 0; L.pulse = 1; }
    L.pulse = Math.max(0, L.pulse - dt * 4.5);
    // snare/clap and hi-hat: sudden rises in the mids and highs
    L.mavg += (v[1] - L.mavg) * Math.min(1, dt * 3); L.havg += (v[2] - L.havg) * Math.min(1, dt * 3); L.s2 += dt; L.s3 += dt;
    if (v[1] > L.mavg + 0.2 && L.s2 > 0.14) { L.snare = 1; L.s2 = 0; } if (v[2] > L.havg + 0.18 && L.s3 > 0.09) { L.hat = 1; L.s3 = 0; }
    L.snare = Math.max(0, L.snare - dt * 6); L.hat = Math.max(0, L.hat - dt * 9);
    // sixteen log-spaced bands for anything that draws a spectrum
    for (let b = 0; b < 16; b++) {
      const k0 = Math.floor(2 * Math.pow(150, b / 16)), k1 = Math.max(k0 + 1, Math.floor(2 * Math.pow(150, (b + 1) / 16))); let sum = 0; for (let k = k0; k < k1; k++) sum += d.fbuf[k];
      const x = Math.min(1, Math.pow(sum / (k1 - k0) / 255, 2.6) * (1.05 + b * 0.05)); L.bands[b] += (x - L.bands[b]) * Math.min(1, dt * (x > L.bands[b] ? 30 : 7));
    }
    return L;
  };
  E.positions = function () { const o = {}; for (const d of E.decks) o[d.track.key || d.track.id] = Math.round(d.P * 10) / 10; return o; };

  E.update = function (dt) {
    if (!E.enabled) return;
    const now = ctx ? ctx.currentTime : 0, w = E.wish;
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    let othersBusy = false;
    for (const d of E.decks) if (d.i !== w.track && (d.cur > 0.01 || !d.el.paused)) othersBusy = true;
    for (const d of E.decks) {
      const wanted = d.i === w.track, inRoom = wanted && w.clarity >= 0.999;
      let target = wanted && !othersBusy && !d.dip ? LEAK + (1 - LEAK) * w.clarity : 0;
      if (d.userPaused) target = 0;
      d.cur += Math.sign(target - d.cur) * Math.min(Math.abs(target - d.cur), dt * (target < d.cur ? FADE_OUT : FADE_IN));
      // a duck-and-seek: wait for silence, move the playhead, release
      if (d.dip && d.cur <= 0.01) { if (d.pendingSeek != null && d.el.readyState > 0) { try { d.el.currentTime = d.pendingSeek; } catch (e) {} } d.pendingSeek = null; d.dip = false; }
      const shouldPlay = wanted && !othersBusy && !d.userPaused;
      if (shouldPlay && d.el.paused && !d.starting) {
        d.starting = true;
        const p = d.el.play(); if (p && p.then) p.then(() => { d.starting = false; }).catch(() => { d.starting = false; d.blocked = true; E.onblocked(); }); else d.starting = false;
      }
      if (!shouldPlay && !d.el.paused && d.cur <= 0.01 && !d.starting) {
        d.el.pause();
        // leaving (or a preview ending) always parks the song where you last sat with it
        if (!d.userPaused && d.el.readyState > 0 && Math.abs(d.el.currentTime - d.P) > 0.05) { try { d.el.currentTime = d.P; } catch (e) {} }
      }
      if (inRoom && !d.el.paused && !d.dip && d.pendingSeek == null) d.P = d.el.currentTime;
      const c = wanted ? w.clarity : 0;
      if (d.gain) {
        d.gain.gain.setTargetAtTime(d.cur, now, 0.02);
        d.filter.frequency.setTargetAtTime(320 * Math.pow(60, c), now, 0.05); // 320 Hz behind the door, ~19 kHz in the room
        d.wet.gain.setTargetAtTime(d.wetAmt * c, now, 0.1);
        // watchdog: if the element is running but the graph hears nothing, this context taints media; rebuild without the graph
        if (!d.el.paused && d.cur > 0.3 && d.el.currentTime > 0.5) {
          const a = new Uint8Array(d.probe.fftSize); d.probe.getByteTimeDomainData(a); let quiet = true; for (let k = 0; k < a.length; k += 8) if (Math.abs(a[k] - 128) > 1) { quiet = false; break; }
          d.silentFor = quiet ? d.silentFor + dt : 0;
          if (d.silentFor > 2.5) return E.degrade();
        } else d.silentFor = 0;
      } else {
        const v = Math.max(0, Math.min(1, d.cur * E.master * (0.45 + 0.55 * c)));
        if (Math.abs(d.el.volume - v) > 0.004) d.el.volume = v;
      }
    }
    if (master) master.gain.setTargetAtTime(E.master, now, 0.03);
    if (rainGain) rainGain.gain.setTargetAtTime(E.rain, now, 0.4);
  };
  // Rebuild every deck as a plain element (no filter or reverb) keeping positions.
  E.degrade = function () {
    const wish = E.wish; graph = false;
    for (const d of E.decks) { d.el.pause(); d.el.removeAttribute('src'); }
    try { ctx.close(); } catch (e) {}
    ctx = null; master = null; rainGain = null;
    const old = E.decks; E.decks = tracks.map(makeDeck);
    E.decks.forEach((d, i) => { d.P = old[i].P; d.el.addEventListener('loadedmetadata', () => { d.el.currentTime = d.P; }, { once: true }); });
    E.wish = wish; E.onstate();
  };
  return E;
}
