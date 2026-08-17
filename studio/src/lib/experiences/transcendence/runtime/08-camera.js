/* CameraDirector — the guided flight.
 *
 * The camera's position along the world is never authored directly: it is
 * derived from the playhead, so the flight cannot drift out of sync with the
 * recording. A shot only says where to sit *relative* to that point — which
 * frequency band to fly over, how high above the ground, how far back, and
 * where to look.
 *
 * Shots are rails, not paths the camera follows exactly. The rail is evaluated
 * from the playhead and the camera springs toward it, which is what gives the
 * flight inertia and a settling time instead of a mechanical slide.
 *
 * There is no ambient shake anywhere in this edition. The only impact is the
 * one motivated by the largest low-frequency event in the passage, at 91.5 s.
 *
 * In reduced-motion mode the rails are not travelled: each shot resolves to a
 * single authored still and the transitions become dissolves.
 */

class CameraDirector {
  constructor(camera, options) {
    this.T = options.THREE;
    this.camera = camera;
    this.analysis = options.analysis;
    this.world = options.world;
    this.reducedMotion = !!options.reducedMotion;

    this.position = new Spring3(0, 100, 0, 0.40);
    this.target = new Spring3(0, 0, -300, 0.48);
    this.fov = new Spring(48, 0.45);
    this.roll = new Spring(0, 0.7);

    this._pos = new this.T.Vector3();
    this._tgt = new this.T.Vector3();
    this.initialised = false;
  }

  static evaluate(shot, p, reducedMotion) {
    const t = reducedMotion ? shot.still : ease[shot.ease || 'inOutCubic'](clamp01(p));
    const l = (a, b) => a + (b - a) * t;
    const f = shot.from, o = shot.to;
    return {
      band: l(f.band, o.band), alt: l(f.alt, o.alt), lead: l(f.lead, o.lead),
      look: l(f.look, o.look), lookBand: l(f.lookBand, o.lookBand), lookAlt: l(f.lookAlt, o.lookAlt),
      fov: l(f.fov, o.fov), roll: l(f.roll, o.roll),
    };
  }

  /**
   * Convert a shot's relative framing into world coordinates.
   * `ground` is sampled from the same terrain data the shader uses, smoothed
   * over a short window so the flight rides the shape of the land rather than
   * every individual ridge.
   */
  _frame(shot, progress, seconds, presence, state) {
    const scale = WorldRenderer.scale;
    const f = CameraDirector.evaluate(shot, progress, this.reducedMotion);

    // The creator's altitude bias scales every shot together, so each shot's
    // composed framing survives: a higher flight is the same flight, further up.
    let band = f.band, lookBand = f.lookBand, alt = f.alt * ART.flightAltitude;
    if (!this.reducedMotion && state.attentionEnabled && presence) {
      // Attention is presence, not control: it moves the flight a little across
      // the frequency axis and a little in altitude, and never takes the shot
      // away from its authored framing.
      band += presence.attention.x * 0.10;
      lookBand += presence.attention.x * 0.13;
      alt *= 1 + presence.attention.y * 0.18;
    }

    const x = band * (scale.BAND_WIDTH * 0.5);
    const z = -seconds * scale.TIME_SCALE + f.lead;
    const lookX = lookBand * (scale.BAND_WIDTH * 0.5);
    const lookZ = z - f.look;

    const groundHere = this.world ? this.world.groundNear(x, z) : 0;
    const groundThere = this.world ? this.world.groundNear(lookX, lookZ) : 0;

    let py = groundHere + alt;
    let ty = groundThere + f.lookAlt;

    let fov = f.fov, roll = f.roll;
    if (!this.reducedMotion) {
      const breathe = this.analysis.mean('loudness_medium', seconds, 2.4);
      py += Math.sin(seconds * 0.21) * alt * 0.012 * (0.4 + breathe);
      fov += (breathe - 0.35) * 2.2;
      roll += Math.sin(seconds * 0.13) * 0.22 * breathe;
    }

    return { px: x, py, pz: z, tx: lookX, ty, tz: lookZ, fov, roll, alt };
  }

  reset(state) {
    const shot = SHOTS[state.shot];
    const f = this._frame(shot, state.progress, state.seconds, null, state);
    this.position.reset(f.px, f.py, f.pz);
    this.target.reset(f.tx, f.ty, f.tz);
    this.fov.reset(f.fov);
    this.roll.reset(f.roll);
    this.initialised = true;
  }

  update(state, dt, presence) {
    const shot = SHOTS[state.shot];
    if (!this.initialised) this.reset(state);
    const f = this._frame(shot, state.progress, state.seconds, presence, state);

    let py = f.py, tz = f.tz;
    if (!this.reducedMotion && shot.impact) {
      const hit = Math.exp(-Math.pow((state.seconds - state.cue.time) * 3.2, 2));
      py += hit * shot.impact * f.alt * 0.06;
      tz -= hit * shot.impact * 26;
    }

    // Springs give the flight weight. The half-life scales with altitude so a
    // ground-level pass is responsive while an atlas move stays majestic.
    const heavy = clamp01(f.alt / 200);
    this.position.halfLife = this.reducedMotion ? 0.85 : mix(0.24, 0.75, heavy);
    this.target.halfLife = this.reducedMotion ? 0.95 : mix(0.32, 0.9, heavy);

    this.position.step(f.px, py, f.pz, dt);
    this.target.step(f.tx, f.ty, tz, dt);
    this.fov.step(f.fov, dt);
    this.roll.step(f.roll, dt);

    this.position.applyTo(this._pos);
    this.target.applyTo(this._tgt);

    if (this.world) {
      const floor = this.world.groundNear(this._pos.x, this._pos.z) + 1.6;
      if (this._pos.y < floor) {
        this._pos.y = floor;
        this.position.y.value = floor;
        this.position.y.velocity = Math.max(this.position.y.velocity, 0);
      }
    }

    this.camera.position.copy(this._pos);
    this.camera.up.set(Math.sin(this.roll.value * 0.0175), Math.cos(this.roll.value * 0.0175), 0);
    this.camera.lookAt(this._tgt);
    this.camera.fov = this.fov.value;
    this.camera.updateProjectionMatrix();

    const distance = this._pos.distanceTo(this._tgt);
    return {
      focus: distance * 0.55,
      focusRange: mix(90, 520, clamp01(distance / 700)),
      altitude: f.alt,
    };
  }
}
