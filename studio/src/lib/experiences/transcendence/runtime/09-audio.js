/* SpatialAudioSystem.
 *
 * The master recording is sovereign. It is routed on its own bus straight to
 * the destination through a single gain the listener controls, and no visual
 * event ever ducks, filters, delays or processes it. Nothing in this file
 * touches the `music` bus except the volume control and the mute.
 *
 * Everything else — room tone, the horn's resonance, the settling of dust, the
 * reversal — lives on separate buses well below the music, exists only to
 * establish where the listener is standing, and is generated procedurally from
 * a fixed seed so it adds no bytes to the package and reproduces exactly.
 */

class SpatialAudioSystem {
  constructor(element, analysis) {
    this.element = element;
    this.analysis = analysis;
    this.ready = false;
    this.enabled = true;
    this.nodes = [];      // fixed pool: nothing is allocated per frame
  }

  /** Must be called inside the threshold gesture so both media and context unlock. */
  unlock() {
    if (this.ready) return true;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    try {
      this.ctx = new Context({ latencyHint: 'playback' });
    } catch { return false; }

    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(ctx.destination);

    // --- the music bus ------------------------------------------------------
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 1;
    try {
      this.source = ctx.createMediaElementSource(this.element);
      this.source.connect(this.musicBus);
      this.musicBus.connect(this.master);
    } catch {
      // If the element cannot be routed (some viewers reuse it), leave the
      // master recording playing directly through the element. The world buses
      // still work; the music is never put at risk to gain an effect.
      this.musicBus = null;
    }

    // --- the world buses ----------------------------------------------------
    this.worldBus = ctx.createGain();
    this.worldBus.gain.value = 0;
    this.nearBus = ctx.createGain();
    this.nearBus.gain.value = 0;
    this.transitionBus = ctx.createGain();
    this.transitionBus.gain.value = 0;
    for (const bus of [this.worldBus, this.nearBus, this.transitionBus]) bus.connect(this.master);

    this._buildRoomTone();
    this._buildNearField();
    this._buildTransition();

    this.ready = true;
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  /** Deterministic noise buffer — the shellac surface, and the air of the room. */
  _noiseBuffer(seconds, seed, shape) {
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const random = mulberry32(seed);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = random() * 2 - 1;
      // One-pole low-pass toward brown noise; `shape` sets how dark it is.
      last = last * shape + white * (1 - shape);
      data[i] = last * 3.2;
    }
    // Seamless loop: cross-fade the tail into the head.
    const fade = Math.min(length >> 2, Math.floor(ctx.sampleRate * 0.5));
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      data[i] = data[i] * t + data[length - fade + i] * (1 - t);
    }
    return buffer;
  }

  _loop(buffer, destination, { gain = 1, filter, q = 0.7, type = 'lowpass', pan = 0 } = {}) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    let node = source;
    if (filter) {
      const biquad = ctx.createBiquadFilter();
      biquad.type = type;
      biquad.frequency.value = filter;
      biquad.Q.value = q;
      node.connect(biquad);
      node = biquad;
      this.nodes.push(biquad);
    }
    const g = ctx.createGain();
    g.gain.value = gain;
    node.connect(g);
    if (pan !== 0 && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      g.connect(panner);
      panner.connect(destination);
      this.nodes.push(panner);
    } else {
      g.connect(destination);
    }
    source.start(0);
    this.nodes.push(source, g);
    return { source, gain: g, filter: node === source ? null : node };
  }

  _buildRoomTone() {
    // The room the horn is standing in: a large, dead space with a low floor.
    const air = this._noiseBuffer(6, 0x1101, 0.986);
    this.room = this._loop(air, this.worldBus, { gain: 0.42, filter: 260, type: 'lowpass', q: 0.5 });
    // The horn itself resonates around its own air column.
    const resonant = this._noiseBuffer(5, 0x1102, 0.94);
    this.hornTone = this._loop(resonant, this.worldBus, { gain: 0.16, filter: 420, type: 'bandpass', q: 3.2 });
    this.hornTone2 = this._loop(resonant, this.worldBus, { gain: 0.10, filter: 1180, type: 'bandpass', q: 5.0, pan: -0.3 });
  }

  _buildNearField() {
    // Dust settling: very quiet, very close, slightly to one side so the
    // listener's head is in a place rather than in the middle of a mix.
    const grit = this._noiseBuffer(4, 0x1103, 0.55);
    this.settling = this._loop(grit, this.nearBus, { gain: 0.30, filter: 5200, type: 'highpass', q: 0.7, pan: 0.22 });
  }

  _buildTransition() {
    const swell = this._noiseBuffer(5, 0x1104, 0.9975);
    this.transition = this._loop(swell, this.transitionBus, { gain: 0.8, filter: 120, type: 'lowpass', q: 1.1 });
  }

  /** Per-frame, but every value is derived from the playhead, not from a timer. */
  update(f) {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;
    const ramp = (param, value) => {
      const v = clamp(value, 0, 4);
      if (Math.abs(param.value - v) < 0.0008) return;
      param.setTargetAtTime(v, now, 0.09);
    };

    const level = this.enabled ? 1 : 0;
    // World sound establishes location. It is loudest when the record is
    // quietest, so that the silences feel like a place rather than a gap.
    const presence = this.analysis.mean('presence', f.time, 0.6);
    ramp(this.worldBus.gain, level * f.presence.air * mix(0.13, 0.045, presence));
    ramp(this.nearBus.gain, level * f.settle * f.presence.plate * 0.035);
    ramp(this.transitionBus.gain, level * f.transition * 0.16);

    // Crossing the diaphragm occludes the room above: the horn's resonance is
    // filtered away and the near field takes over.
    if (this.hornTone.filter) ramp(this.hornTone.filter.frequency, mix(420, 90, f.invert));
    if (this.hornTone2.filter) ramp(this.hornTone2.filter.frequency, mix(1180, 200, f.invert));
    if (this.room.filter) ramp(this.room.filter.frequency, mix(260, 120, f.invert));
    if (this.settling.filter) ramp(this.settling.filter.frequency, mix(5200, 2600, f.invert));
  }

  setVolume(value) { if (this.master) this.master.gain.value = clamp(value, 0, 1); }
  setWorldEnabled(on) { this.enabled = on; }

  dispose() {
    for (const node of this.nodes) {
      try { node.stop?.(); } catch {}
      try { node.disconnect(); } catch {}
    }
    this.nodes.length = 0;
    try { this.ctx?.close(); } catch {}
    this.ready = false;
  }
}
