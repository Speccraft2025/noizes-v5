/* ExperienceDirector — assembles the edition and runs it.
 *
 * The loop is: read the playhead → reduce the sequence → evaluate the paused
 * choreography at that time → build the frame. Nothing accumulates.
 */

class ExperienceDirector {
  constructor() {
    this.el = {
      stage: dom.$('#stage'),
      world: dom.$('#world'),
      essential: dom.$('#essential'),
      threshold: dom.$('#threshold'),
      thresholdButton: dom.$('#threshold-action'),
      thresholdHint: dom.$('#threshold-hint'),
      caption: dom.$('#caption'),
      utility: dom.$('#utility'),
      sheet: dom.$('#sheet'),
      sheetClose: dom.$('#sheet-close'),
      audio: dom.$('#audio'),
      live: dom.$('#live'),
      status: dom.$('#status'),
      sceneTitle: dom.$('#scene-title'),
      sceneDescription: dom.$('#scene-description'),
      stableLyric: dom.$('#stable-lyric'),
      lyricList: dom.$('#lyric-list'),
      memory: dom.$('#memory'),
      residue: dom.$('#residue'),
      residueHash: dom.$('#residue-hash'),
      residueStatement: dom.$('#residue-statement'),
      replay: dom.$('#replay'),
      transport: dom.$('#transport'),
      seek: dom.$('#sheet-seek'),
      elapsed: dom.$('#elapsed'),
      volume: dom.$('#volume'),
      qualityButtons: dom.all('[data-quality-option]'),
      motionToggle: dom.$('#motion-toggle'),
      contrastToggle: dom.$('#contrast-toggle'),
      captionToggle: dom.$('#caption-toggle'),
      worldSoundToggle: dom.$('#world-sound-toggle'),
      hud: dom.$('#hud'),
      hudToggle: dom.$('#hud-toggle'),
      hudElapsed: dom.$('#hud-elapsed'),
      timelineMarks: dom.$('#timeline-marks'),
      timelineHead: dom.$('#timeline-head'),
      freqBands: dom.$('#freq-bands'),
      callouts: dom.$('#callouts'),
      debug: dom.$('#debug'),
    };

    this.payload = JSON.parse(dom.$('#analysis-payload').textContent);
    this.edition = JSON.parse(dom.$('#edition-payload').textContent);
    this.analysis = new AnalysisTrack(this.payload);
    this.cues = new CueEngine(SEQUENCE, this.analysis);
    this.clock = new AudioClock(this.el.audio, { end: TX.slice.end });
    this.a11y = new AccessibilityController(this.el, this.analysis);
    this.archive = new ArchiveLayer(this.analysis, this.edition);
    this.audio = new SpatialAudioSystem(this.el.audio, this.analysis);

    this.mode = 'sealed';
    this.nedTracks = {};
    this.reducedMotion = this.a11y.reducedMotion;
    this.highContrast = this.a11y.highContrast;
    this.debug = new URLSearchParams(location.search).get('debug') === '1';
    this.descent = 0;
    this.contact = 0;
    this.lastFrameWall = 0;
    this.frameCount = 0;
    this.running = false;
    this.rafHandle = 0;
    this.contextLost = false;

    this.chore = { exposure: 0.72, specimen: 0 };

    this.quality = this._detectQuality();
    this.governor = new PerformanceGovernor({
      initial: this.quality,
      onChange: (quality, reason) => this._applyQuality(quality, reason),
    });
  }

  /* ------------------------------------------------------------ capability */

  _detectQuality() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'essential';
    const memory = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    const handheld = window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(hover: none)').matches;
    const narrow = window.innerWidth < 640;
    let quality = 'balanced';
    if (handheld || narrow || memory <= 3 || cores <= 3) quality = 'lite';
    else if (memory >= 8 && cores >= 8 && window.devicePixelRatio >= 1.5) quality = 'cinematic';
    try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
    return quality;
  }

  /* ---------------------------------------------------------------- assets */

  _loadTextures(THREE, entries) {
    const loader = new THREE.TextureLoader();
    return Promise.all(entries.map(([key, path]) => new Promise(resolve => {
      loader.load(
        path,
        texture => resolve([key, texture]),
        undefined,
        // A missing texture must never stop the experience. The shaders are
        // written so that a null map degrades to the analytic surface rather
        // than to a black frame.
        () => { this._note(`texture unavailable: ${path}`); resolve([key, null]); },
      );
    }))).then(pairs => Object.fromEntries(pairs.filter(([, texture]) => texture)));
  }

  async boot() {
    this._wireInterface();
    this._buildChoreography();

    if (this.quality === 'essential' || typeof THREE === 'undefined') {
      this._startEssential('no WebGL context is available');
    } else {
      const THREE_NS = THREE;
      // First load only what the sealed object needs, so the package presents
      // its first meaningful frame without waiting for the whole world.
      // The terrain image is the world; nothing can be drawn before it exists.
      this.textures = await this._loadTextures(THREE_NS, [
        ['terrain', TX.assets.terrain],
        ['dustGrain', TX.assets.dustGrain],
        ['blueNoise', TX.assets.blueNoise],
      ].filter(([, path]) => path));
      this._decodeTerrain();
      try {
        this.world = new WorldRenderer(this.el.world, {
          THREE: THREE_NS, analysis: this.analysis, profile: this.quality,
          textures: this.textures, reducedMotion: this.reducedMotion, highContrast: this.highContrast,
        }).init();
      } catch (error) {
        this._startEssential('the renderer could not be created');
        this._note(String(error && error.message));
        return this._begin();
      }
      this.director = new CameraDirector(this.world.camera, {
        THREE: THREE_NS, analysis: this.analysis, world: this.world, reducedMotion: this.reducedMotion,
      });
      this._watchContextLoss();

      this._buildLandmarks();
    }

    return this._begin();
  }

  /* The terrain image is also read on the CPU, so the flight, the Essential
   * stage and the tests all see exactly the landscape the shader sees. */
  _decodeTerrain() {
    const texture = this.textures.terrain;
    if (!texture || !texture.image) { this._note('terrain image unavailable'); return; }
    const image = texture.image;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, image.width, image.height).data;
    this.analysis.setTerrainImage(data, image.width, image.height);
  }

  _buildLandmarks() {
    const lines = SEQUENCE.filter(c => c.lyric !== undefined).map(c => this.analysis.lyrics[c.lyric]);
    const scale = WorldRenderer.scale;
    this.landmarkField = new LandmarkField(lines, {
      timeScale: scale.TIME_SCALE,
      bandWidth: scale.BAND_WIDTH,
      bands: 128,
    }).build();
    if (this.world) this.world.attachLandmarks(this.landmarkField.marks);
  }

  /* ------------------------------------------------------- instrument layer */

  /* The world is an exhibit, so it carries the apparatus of one: where you are
   * in the recording, what the ground under you is made of, and what the
   * landmarks are. None of it is a transport — playback stays in the utility
   * sheet, so the frame still contains no player. */
  _buildHud() {
    const el = this.el;

    // Section timeline. Every mark is a measured musical event taken from the
    // authored sequence, not a round number.
    const MARKS = ['atlas', 'descent', 'ranges', 'voice', 'summit', 'approach', 'converge', 'specimen'];
    el.timelineMarks.innerHTML = '';
    this.timelineMarks = [];
    for (const id of MARKS) {
      const cue = SEQUENCE.find(c => c.id === id);
      if (!cue) continue;
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = `<b></b><small></small>`;
      button.querySelector('b').textContent = cue.title;
      button.querySelector('small').textContent = timecode(cue.time);
      button.setAttribute('aria-label', `Go to ${cue.title} at ${timecode(cue.time)}`);
      button.onclick = () => {
        if (this.mode !== 'world') return;
        this.clock.seek(cue.time);
        this.director?.reset(this.cues.reduce(cue.time));
      };
      li.append(button);
      li.dataset.time = String(cue.time);
      el.timelineMarks.append(li);
      this.timelineMarks.push({ li, time: cue.time });
    }

    // Frequency axis. Labelled from the analysis's own band centres, so it can
    // never claim a range the terrain does not actually cover.
    const centres = this.payload.parameters.terrain.band_centres_hz;
    const lo = centres[0], hi = centres[centres.length - 1];
    const hz = v => (v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, '')} kHz` : `${Math.round(v)} Hz`);
    const OCTAVES = 6;
    el.freqBands.innerHTML = '';
    // Listed high to low so the axis reads the way a spectrogram does.
    for (let i = OCTAVES - 1; i >= 0; i--) {
      const from = lo * Math.pow(hi / lo, i / OCTAVES);
      const to = lo * Math.pow(hi / lo, (i + 1) / OCTAVES);
      const names = ['Sub / low', 'Bass', 'Low mid', 'Mid', 'Upper mid', 'High / air'];
      const li = document.createElement('li');
      li.innerHTML = '<b></b><small></small>';
      li.querySelector('b').textContent = names[i];
      li.querySelector('small').textContent = `${hz(from)} – ${hz(to)}`;
      el.freqBands.append(li);
    }

    // Landmark callouts, projected from their world anchors every frame.
    el.callouts.innerHTML = '';
    this.calloutNodes = [];
    const marks = this.landmarkField ? this.landmarkField.marks : [];
    for (const mark of marks) {
      const node = document.createElement('div');
      node.className = 'callout';
      node.dataset.visible = 'false';
      node.innerHTML = '<span class="callout-stem"></span><span class="callout-body">'
        + '<span class="callout-kind">Lyric landmark</span>'
        + '<span class="callout-text"></span>'
        + '<span class="callout-meta"></span></span>';
      node.querySelector('.callout-text').textContent = `“${mark.text}”`;
      node.querySelector('.callout-meta').textContent = `${timecode(mark.seconds)} · ${Math.round(mark.hz)} Hz · cut into the singer’s own partial`;
      el.callouts.append(node);
      this.calloutNodes.push({ node, mark });
    }

    this._hudVector = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
  }

  _updateHud(exact, state) {
    const el = this.el;
    if (el.hud.dataset.visible !== 'true') return;

    el.hudElapsed.textContent = timecode(exact);
    const progress = clamp01(exact / TX.slice.end);
    el.timelineHead.style.left = `${(progress * 100).toFixed(2)}%`;
    for (const entry of this.timelineMarks) {
      entry.li.dataset.active = String(state.cue.time >= entry.time
        && !this.timelineMarks.some(o => o.time > entry.time && o.time <= state.cue.time));
    }

    // Callouts follow their anchors in the world. A landmark behind the camera,
    // off screen, or too far to read is simply not drawn.
    if (!this.calloutNodes || !this.world || !this._hudVector) return;
    const camera = this.world.camera;
    const width = el.stage.clientWidth, height = el.stage.clientHeight;
    for (let i = 0; i < this.calloutNodes.length; i++) {
      const { node, mark } = this.calloutNodes[i];
      const reveal = state.landmarks[i] || 0;
      const ground = this.world.groundNear(mark.x, mark.z);
      this._hudVector.set(mark.x, ground + 6, mark.z);
      const distance = this._hudVector.distanceTo(camera.position);
      this._hudVector.project(camera);
      const x = (this._hudVector.x * 0.5 + 0.5) * width;
      const y = (-this._hudVector.y * 0.5 + 0.5) * height;
      const onScreen = this._hudVector.z < 1
        && x > -120 && x < width + 120 && y > 60 && y < height - 10
        && distance < 900 && distance > 20;
      const visible = onScreen && reveal > 0.02;
      node.dataset.visible = String(visible);
      if (visible) node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-1px, -100%)`;
    }
  }

  _setHud(on, silent) {
    this.el.hud.dataset.visible = String(on);
    this.el.hudToggle.setAttribute('aria-pressed', String(on));
    this.el.hudToggle.querySelector('b').textContent = on ? 'On' : 'Off';
    if (!silent) {
      this.a11y.announce(on
        ? 'Instrument layer on: section timeline, frequency axis and landmark callouts are shown.'
        : 'Instrument layer off: the world is shown alone.');
    }
  }

  _fillColophon() {
    const el = dom.$('#colophon-text');
    if (!el || !this.edition) return;
    const e = this.edition;
    const parts = [];
    if (e.name) parts.push(e.name);
    if (e.copy) parts.push(`Copy ${e.copy}`);
    if (e.principle) parts.push(e.principle);
    el.textContent = parts.join('. ') + (parts.length ? '.' : '');
    if (e.edition_id) {
      const id = document.createElement('span');
      id.className = 'colophon-id';
      id.textContent = e.edition_id;
      el.after(id);
    }
  }

  _begin() {
    this._resize();
    dom.on(window, 'resize', () => this._resize());
    dom.on(document, 'visibilitychange', () => {
      // Nothing to reconcile: state is a function of the playhead, so the world
      // simply rebuilds itself on the next visible frame.
      if (!document.hidden) this.director?.reset(this.cues.reduce(this.clock.exact));
    });
    this.interaction = new InteractionSystem(this.el.stage, {
      onThresholdHold: () => this._onHold(),
      onThresholdRelease: () => this._onRelease(),
    });
    this._buildHud();
    this._setHud(true, true);
    this._fillColophon();
    if (this.debug) this._buildInspector();
    this.running = true;
    this.lastFrameWall = performance.now() / 1000;
    this._loop();
    this.el.stage.dataset.ready = 'true';
    return this;
  }

  /* --------------------------------------------------------- choreography */

  /* GSAP is used strictly as a paused evaluator: it is never allowed to run on
   * its own clock. Every frame we tell it what time the recording is at. */
  _buildChoreography() {
    const c = this.chore;
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });

    // Exposure follows the recording's own dynamics, not a taste curve.
    tl.set(c, { exposure: 0.72 }, 0)
      .to(c, { exposure: 0.86, duration: 4.2 }, 0.4)
      .to(c, { exposure: 1.05, duration: 3.4, ease: 'power2.out' }, 4.6)
      .to(c, { exposure: 1.12, duration: 7.2 }, 8.0)
      .to(c, { exposure: 1.18, duration: 3.4 }, 15.2)
      .to(c, { exposure: 1.24, duration: 2.0 }, 18.65)
      .to(c, { exposure: 1.00, duration: 1.6 }, 29.5)
      .to(c, { exposure: 1.22, duration: 1.8 }, 31.25)
      .to(c, { exposure: 1.36, duration: 1.4 }, 36.4)
      .to(c, { exposure: 1.14, duration: 5.0 }, 39.0)
      .to(c, { exposure: 0.94, duration: 2.6 }, 48.0)
      .to(c, { exposure: 1.10, duration: 4.0 }, 58.0)
      .to(c, { exposure: 1.20, duration: 2.0 }, 64.71)
      .to(c, { exposure: 1.02, duration: 2.2 }, 75.5)
      .to(c, { exposure: 1.22, duration: 2.4 }, 79.04)
      .to(c, { exposure: 1.44, duration: 3.5, ease: 'power2.in' }, 88.0)
      .to(c, { exposure: 1.18, duration: 3.0 }, 92.0)
      .to(c, { exposure: 0.96, duration: 4.0 }, 95.0)
      .to(c, { exposure: 0.80, duration: 2.0 }, 99.0)
      .to(c, { exposure: 1.05, duration: 2.4 }, 101.0);

    // The world contracts into the specimen the listener keeps.
    tl.to(c, { specimen: 1, duration: 2.6, ease: 'power2.out' }, 100.4);

    tl.duration(TX.slice.end);
    this.timeline = tl;
  }

  /* -------------------------------------------------------------- threshold */

  _onHold() {
    if (this.mode === 'sealed') {
      this.holdStart = performance.now();
      this.el.threshold.dataset.holding = 'true';
    } else if (this.mode === 'world') {
      const window_ = this.cues.reduce(this.clock.exact).engraveWindow;
      if (window_) this.archive.recordEngrave(window_.lyric);
    }
  }

  _onRelease() {
    if (this.mode === 'sealed') {
      this.el.threshold.dataset.holding = 'false';
      if (this.descent < 0.999) this.holdStart = 0;
    }
  }

  async _cross() {
    if (this.mode !== 'sealed') return;
    this.mode = 'world';
    this.el.stage.dataset.mode = 'world';
    this.el.threshold.dataset.crossing = 'true';
    // One gesture unlocks both the media element and the AudioContext.
    this.audio.unlock();
    const started = await this.clock.play();
    if (!started) {
      this.el.stage.dataset.blocked = 'true';
      this.a11y.status('Playback was blocked. Press and hold again to lower the stylus.');
      this.el.threshold.dataset.crossing = 'false';
      this.el.thresholdHint.textContent = 'The browser held the stylus back. Press and hold again.';
      this.mode = 'sealed';
      this.el.stage.dataset.mode = 'sealed';
      this.descent = 0;
      this.holdStart = 0;
      return;
    }
    setTimeout(() => { this.el.threshold.hidden = true; }, 650);
    this.director?.reset(this.cues.reduce(0));
    this.a11y.announce('The stylus is down. The recording begins.');
  }

  /* ------------------------------------------------------------- interface */

  _wireInterface() {
    const el = this.el;

    // The one discreet control. It hides when the pointer rests and returns on
    // any pointer, touch, focus or key activity.
    const reveal = () => {
      el.stage.dataset.chrome = 'visible';
      clearTimeout(this._chromeTimer);
      this._chromeTimer = setTimeout(() => {
        if (el.sheet.hidden && document.activeElement !== el.utility) el.stage.dataset.chrome = 'hidden';
      }, 2600);
    };
    for (const type of ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'focusin']) {
      dom.on(window, type, reveal, { passive: true });
    }
    reveal();

    const setSheet = open => {
      el.sheet.hidden = !open;
      el.utility.setAttribute('aria-expanded', String(open));
      el.stage.dataset.sheet = String(open);
      if (open) { el.sheetClose.focus(); reveal(); } else el.utility.focus();
    };
    dom.on(el.utility, 'click', () => setSheet(el.sheet.hidden));
    dom.on(el.sheetClose, 'click', () => setSheet(false));

    dom.on(el.thresholdButton, 'pointerdown', () => this._onHold());
    dom.on(el.thresholdButton, 'keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) { event.preventDefault(); this._onHold(); }
    });
    dom.on(el.thresholdButton, 'keyup', event => {
      if (event.key === 'Enter' || event.key === ' ') this._onRelease();
    });

    dom.on(el.transport, 'click', () => {
      this.clock.toggle();
      this._syncTransport();
    });
    dom.on(el.seek, 'input', () => {
      this.clock.seek(Number(el.seek.value));
      this.director?.reset(this.cues.reduce(this.clock.exact));
    });
    dom.on(el.volume, 'input', () => {
      const value = Number(el.volume.value);
      el.audio.volume = value;
      this.audio.setVolume(1);
      el.volume.setAttribute('aria-valuetext', `${Math.round(value * 100)} per cent`);
    });
    dom.on(el.replay, 'click', () => {
      this.clock.seek(0);
      this.clock.play();
      el.residue.hidden = true;
      this.director?.reset(this.cues.reduce(0));
    });

    for (const button of el.qualityButtons) {
      dom.on(button, 'click', () => {
        const quality = button.dataset.qualityOption;
        this.governor.lock(quality);
        this._applyQuality(quality, 'listener');
      });
    }
    dom.on(el.motionToggle, 'click', () => this._setReducedMotion(!this.reducedMotion));
    dom.on(el.contrastToggle, 'click', () => this._setHighContrast(!this.highContrast));
    dom.on(el.captionToggle, 'click', () => {
      this.a11y.captions = !this.a11y.captions;
      el.captionToggle.setAttribute('aria-pressed', String(this.a11y.captions));
      el.captionToggle.querySelector('b').textContent = this.a11y.captions ? 'On' : 'Off';
      if (!this.a11y.captions) el.caption.dataset.visible = 'false';
    });
    dom.on(el.hudToggle, 'click', () => this._setHud(el.hud.dataset.visible !== 'true'));
    dom.on(el.worldSoundToggle, 'click', () => {
      const on = !this.audio.enabled;
      this.audio.setWorldEnabled(on);
      el.worldSoundToggle.setAttribute('aria-pressed', String(on));
      el.worldSoundToggle.querySelector('b').textContent = on ? 'On' : 'Off';
    });

    dom.on(el.lyricList, 'click', event => {
      const button = event.target.closest('.lyric-jump');
      if (!button) return;
      const time = Number(button.parentElement.dataset.time);
      if (this.mode === 'sealed') return;
      this.clock.seek(time);
      this.director?.reset(this.cues.reduce(time));
    });

    dom.on(window, 'keydown', event => {
      const typing = event.target instanceof HTMLInputElement;
      if (event.key === 'Escape' && !el.sheet.hidden) { setSheet(false); return; }
      if (typing) return;
      if (event.key === ' ' && this.mode === 'world') {
        event.preventDefault();
        this.clock.toggle();
        this._syncTransport();
      }
      if (event.key === '?' || (event.key === '/' && event.shiftKey)) setSheet(true);
    });

    this._setReducedMotion(this.reducedMotion, true);
    this._setHighContrast(this.highContrast, true);
    el.stage.dataset.quality = this.quality;
    this._markQuality();
  }

  _syncTransport() {
    const paused = this.el.audio.paused;
    this.el.transport.setAttribute('aria-label', paused ? 'Resume the recording' : 'Pause the recording');
    this.el.transport.querySelector('b').textContent = paused ? 'Resume' : 'Pause';
  }

  _markQuality() {
    for (const button of this.el.qualityButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.qualityOption === this.quality));
    }
  }

  _setReducedMotion(on, silent) {
    this.reducedMotion = on;
    this.el.stage.dataset.reducedMotion = String(on);
    this.el.motionToggle.setAttribute('aria-pressed', String(on));
    this.el.motionToggle.querySelector('b').textContent = on ? 'Reduced' : 'Full';
    if (this.director) { this.director.reducedMotion = on; this.director.initialised = false; }
    if (this.world) this.world.reducedMotion = on;
    if (this.essential) this.essential.reducedMotion = on;
    if (!silent) {
      this.a11y.announce(on
        ? 'Reduced motion. The camera no longer travels: each beat is held as a still composition and the transitions are dissolves.'
        : 'Full motion restored.');
    }
  }

  _setHighContrast(on, silent) {
    this.highContrast = on;
    this.el.stage.dataset.highContrast = String(on);
    this.el.contrastToggle.setAttribute('aria-pressed', String(on));
    this.el.contrastToggle.querySelector('b').textContent = on ? 'High' : 'Standard';
    this.world?.setHighContrast(on);
    if (this.essential) this.essential.highContrast = on;
    if (!silent) this.a11y.announce(on ? 'High contrast on.' : 'Standard contrast.');
  }

  _applyQuality(quality, reason) {
    if (quality === this.quality) return;
    if (quality === 'essential') { this._startEssential('the quality profile was set to Essential'); this.quality = quality; this._markQuality(); return; }
    const previous = this.quality;
    this.quality = quality;
    this.el.stage.dataset.quality = quality;
    this._markQuality();

    if (this.essential && !this.world) {
      // Coming back up from Essential requires a renderer; only the listener
      // may ask for that, never the governor.
      if (reason !== 'listener') { this.quality = previous; return; }
    }
    if (this.world) {
      const textures = this.world.textures;
      this.world.dispose();
      this.world = new WorldRenderer(this.el.world, {
        THREE, analysis: this.analysis, profile: quality, textures,
        reducedMotion: this.reducedMotion, highContrast: this.highContrast,
      }).init();
      this._buildLandmarks();
      this.director = new CameraDirector(this.world.camera, {
        THREE, analysis: this.analysis, reducedMotion: this.reducedMotion,
      });
      this._watchContextLoss();
      this._resize();
    }
    this.a11y.status(reason === 'governor'
      ? `Quality reduced to ${QUALITY_PROFILES[quality].label} to hold a steady frame rate.`
      : `Quality set to ${QUALITY_PROFILES[quality].label}.`);
  }

  _watchContextLoss() {
    dom.on(this.el.world, 'webglcontextlost', event => {
      event.preventDefault();
      this.contextLost = true;
      this._startEssential('the graphics context was lost');
    });
  }

  _startEssential(reason) {
    this.quality = 'essential';
    this.el.stage.dataset.quality = 'essential';
    this.el.world.hidden = true;
    this.el.essential.hidden = false;
    this.essential = new EssentialStage(this.el.essential, {
      analysis: this.analysis, reducedMotion: this.reducedMotion, highContrast: this.highContrast,
    });
    if (this.world) { try { this.world.dispose(); } catch {} this.world = null; }
    this.director = null;
    this._resize();
    this._markQuality();
    this.a11y.status(`Essential mode: ${reason}. The recording, the lyric and the full sequence continue.`);
    this._note(`essential mode — ${reason}`);
  }

  _note(message) {
    this._notes = this._notes || [];
    this._notes.push(message);
    if (this.debug) console.info('[transcendence]', message);
  }

  _resize() {
    if (this._resizeTimer) return;
    this._resizeTimer = setTimeout(() => {
      this._resizeTimer = 0;
      const width = this.el.stage.clientWidth || window.innerWidth;
      const height = this.el.stage.clientHeight || window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      this.world?.resize(width, height, dpr);
      this.essential?.resize(width, height, dpr);
    }, 80);
  }

  /* ------------------------------------------------------------------ loop */

  _loop() {
    if (!this.running) return;
    this.rafHandle = window.requestAnimationFrame(() => this._loop());
    if (document.hidden) return;
    const started = performance.now();
    const wall = started / 1000;
    const dt = clamp(wall - this.lastFrameWall, 0, 0.1);
    this.lastFrameWall = wall;
    this.frameCount++;

    const settle = this.interaction ? this.interaction.update(dt) : 0;

    if (this.mode === 'sealed') {
      this._renderSealed(wall, dt);
    } else {
      this._renderWorld(wall, dt, settle);
    }

    const frameMs = performance.now() - started;
    // The governor only judges the world. The sealed object is a different,
    // much cheaper frame, and the first seconds after crossing include texture
    // uploads and shader compilation that say nothing about steady state.
    if (this.mode === 'world' && !this.capturing) this.governor.sample(frameMs);
    if (this.world) this.world.stats.frameMs = frameMs;
    if (this.debug) this._updateInspector(frameMs);
  }

  _renderSealed(wall, dt) {
    // Before the gesture the recording exists but has not been lit: the shape of
    // the whole track is there in the dark, and nothing has been travelled.
    const target = this.holdStart ? clamp01((performance.now() - this.holdStart) / 900) : 0;
    this.descent += (target - this.descent) * Math.min(1, dt * (target > this.descent ? 5.5 : 3.0));
    this.el.threshold.style.setProperty('--descent', this.descent.toFixed(3));
    if (this.descent > 0.995 && this.holdStart) { this._cross(); return; }

    const state = this.cues.reduce(0);
    const frame = {
      time: 0, exact: 0, phase: 'sealed',
      presence: { air: 0.16 },
      relief: 1, atmosphere: 1.45, ahead: 0.96,
      exposure: mix(0.30, 0.62, this.descent),
      contrast: this.highContrast ? 1.22 : 1,
      specimen: 0, specimenAt: { x: 0, y: 0, z: 0 },
      landmarks: [0, 0, 0, 0],
      settle: 0, focus: 400, focusRange: 500,
    };
    if (this.world && this.director) {
      this.director.reducedMotion = true;      // the object is still until asked
      this.director.update(state, dt, { attention: { x: 0, y: 0 } });
      this.director.reducedMotion = this.reducedMotion;
      this.world.update(frame);
      this.world.render(this.world.camera);
    } else if (this.essential) {
      this.essential.render(frame);
    }
  }

  _renderWorld(wall, dt, settle) {
    const time = this.clock.sample(wall);
    const exact = this.clock.exact;
    const state = this.cues.reduce(exact);

    this.timeline.time(clamp(exact, 0, TX.slice.end));
    const c = this.chore;

    // Pressing while a line is being cut commits it deeper — the only thing
    // the listener can change, and it changes nothing but the artefact.
    const window_ = state.engraveWindow;
    if (window_ && this.interaction?.holding) this.archive.recordEngrave(window_.lyric);
    this.archive.accumulate(dt, settle);

    const attention = this.interaction ? this.interaction.attention : { x: 0, y: 0 };
    const scale = WorldRenderer.scale;

    const frame = {
      time, exact, phase: state.phase,
      presence: { air: state.world.air },
      relief: state.world.relief,
      atmosphere: state.world.atmosphere,
      ahead: state.world.ahead,
      exposure: c.exposure,
      contrast: this.highContrast ? 1.22 : 1,
      specimen: c.specimen,
      specimenAt: this._specimenAnchor(exact),
      landmarks: state.landmarks,
      settle,
      focus: 200, focusRange: 300,
    };

    const nt = this.nedTracks;
    if (nt.exposure) { const v = evaluateTrack(nt.exposure, exact); if (v !== null) frame.exposure = v; }
    if (nt.relief) { const v = evaluateTrack(nt.relief, exact); if (v !== null) frame.relief = v; }
    if (nt.atmosphere) { const v = evaluateTrack(nt.atmosphere, exact); if (v !== null) frame.atmosphere = v; }
    if (nt.ahead) { const v = evaluateTrack(nt.ahead, exact); if (v !== null) frame.ahead = v; }
    if (nt.air) { const v = evaluateTrack(nt.air, exact); if (v !== null) frame.presence.air = v; }

    if (this.world && this.director) {
      const lens = this.director.update(state, dt, { attention });
      frame.focus = lens.focus;
      frame.focusRange = lens.focusRange;
      frame.altitude = lens.altitude;
      this.world.update(frame);
      this.world.render(this.world.camera);
    } else if (this.essential) {
      this.essential.render(frame);
    }

    this.audio.update({ ...frame, invert: 0, transition: 0, presence: { air: state.world.air, plate: 1 } });
    this.a11y.update(state, { memory: this.archive.summary().statement });
    this._updateHud(exact, state);
    this._syncSheet(exact, state);
  }

  /* The specimen is held in front of the camera at the end, so it reads as an
   * object in the hand rather than a piece of scenery left behind. */
  _specimenAnchor(seconds) {
    const cam = this.world ? this.world.camera : null;
    if (!cam) return { x: 0, y: 0, z: 0 };
    const forward = new THREE.Vector3();
    cam.getWorldDirection(forward);
    return {
      x: cam.position.x + forward.x * 5.2,
      y: cam.position.y + forward.y * 5.2 - 0.35,
      z: cam.position.z + forward.z * 5.2,
    };
  }

  _syncSheet(time, state) {
    if (this.el.sheet.hidden) return;
    this.el.seek.value = String(time.toFixed(2));
    this.el.elapsed.textContent = `${timecode(time)} / ${timecode(TX.slice.end)}`;
  }

  /* ------------------------------------------------------ residue and ending */

  showResidue() {
    const summary = this.archive.summary();
    this.el.residueHash.textContent = summary.hash;
    this.el.residueStatement.textContent = summary.statement;
    this.el.residue.hidden = false;
    this.a11y.announce(`The recording has ended. ${summary.statement} This copy is identified ${summary.hash.split('').join(' ')}.`);
  }

  /* ------------------------------------------------------------- inspector */

  /* Developer-only. Reached with ?debug=1 and never present otherwise: the
   * markup is removed from the document unless the flag is set. */
  _buildInspector() {
    const panel = this.el.debug;
    panel.hidden = false;
    const jumps = panel.querySelector('.debug-jumps');
    for (const cue of SEQUENCE) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${cue.time.toFixed(2)} ${cue.id}`;
      button.onclick = () => {
        if (this.mode === 'sealed') { this.holdStart = performance.now() - 1000; this._cross().then(() => this.clock.seek(cue.time)); }
        else { this.clock.seek(cue.time); this.director?.reset(this.cues.reduce(cue.time)); }
      };
      jumps.append(button);
    }
    this.debugOutput = panel.querySelector('#debug-output');
    this.debugTime = panel.querySelector('#debug-time');
    dom.on(this.debugTime, 'input', () => {
      const t = Number(this.debugTime.value);
      if (this.mode !== 'world') return;
      this.clock.seek(t);
      this.director?.reset(this.cues.reduce(t));
    });

    // Frame-capture and scrubbing hooks used by the build's review pass.
    window.__TRANSCENDENCE__ = {
      version: TX.version,
      seek: async t => {
        if (this.mode === 'sealed') { this.holdStart = performance.now() - 2000; await this._cross(); }
        this.clock.pause();
        this.clock.seek(t);
        // A media element seek is asynchronous; a frame captured before it
        // lands would be a picture of the wrong second.
        await new Promise(resolve => {
          if (Math.abs(this.el.audio.currentTime - t) < 0.05) return resolve();
          const done = () => { this.el.audio.removeEventListener('seeked', done); resolve(); };
          this.el.audio.addEventListener('seeked', done);
          setTimeout(done, 1500);
        });
        this.clock.relock();
        const state = this.cues.reduce(this.clock.exact);
        this.director?.reset(state);
        // Let the springs settle so a captured frame matches the authored rail.
        for (let i = 0; i < 45; i++) {
          this._renderWorld(performance.now() / 1000, 1 / 60, this.interaction?.settle || 0);
        }
        return { cue: state.cue.id, time: this.clock.exact };
      },
      state: () => this.cues.reduce(this.clock.exact),
      stats: () => (this.world ? this.world.stats : this.essential.stats),
      quality: () => this.quality,
      setQuality: q => this._applyQuality(q, 'listener'),
      archive: () => this.archive.summary(),
      notes: () => this._notes || [],
    };
  }

  _updateInspector(frameMs) {
    if (!this.debugOutput || this.frameCount % 6) return;
    const state = this.cues.reduce(this.clock.exact);
    const stats = this.world ? this.world.stats : this.essential.stats;
    this.debugTime.value = String(this.clock.exact.toFixed(2));
    this.debugOutput.textContent = [
      `t ${this.clock.exact.toFixed(2)}  cue ${state.cue.id}  phase ${state.phase}  shot ${state.shot}`,
      `quality ${this.quality}  frame ${frameMs.toFixed(1)}ms  ema ${this.governor.ema.toFixed(1)}ms`,
      `draws ${stats.drawCalls}  tris ${stats.triangles}  points ${stats.points}`,
      `voice ${this.analysis.at('voice', this.clock.exact).toFixed(2)}  low ${this.analysis.at('low', this.clock.exact).toFixed(2)}  bright ${this.analysis.at('brightness', this.clock.exact).toFixed(2)}`,
      `inscriptions ${state.inscriptions.map(i => i.weight.toFixed(2)).join(' ')}`,
    ].join('\n');
  }

  dispose() {
    this.running = false;
    window.cancelAnimationFrame(this.rafHandle);
    this.interaction?.dispose();
    this.clock.dispose();
    this.audio.dispose();
    this.world?.dispose();
  }
}

/* ------------------------------------------------------------------ bootstrap */

(function start() {
  window.addEventListener('message', function(event) {
    if (event.source !== window.parent) return;
    var d = event.data;
    if (!d) return;
    if (d.type === 'ned:visual-update' && d.artDirection) {
      WorldRenderer.updateArt(d.artDirection);
      var w = window.__TX_DIRECTOR__ && window.__TX_DIRECTOR__.world;
      if (w && typeof w.applyArt === 'function') w.applyArt(d.artDirection);
    }
    if (d.type === 'ned:direction-tracks' && d.tracks) {
      var dir = window.__TX_DIRECTOR__;
      if (dir) dir.nedTracks = d.tracks;
    }
  });

  const run = () => {
    const director = new ExperienceDirector();
    window.__TX_DIRECTOR__ = director;
    director.clock.onChange(type => {
      if (type === 'slice-end') director.showResidue();
    });
    director.boot().catch(error => {
      console.error(error);
      const stage = dom.$('#stage');
      stage.dataset.mode = 'world';
      stage.dataset.quality = 'essential';
      dom.$('#status').textContent = 'The world could not be assembled. The recording and the lyric remain available in the panel.';
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
