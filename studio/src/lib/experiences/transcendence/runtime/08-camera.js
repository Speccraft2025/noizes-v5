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
    this.position.halfLife = this.reducedMotion ? 0.85 : mix(0.38, 0.90, heavy);
    this.target.halfLife = this.reducedMotion ? 0.95 : mix(0.48, 1.05, heavy);

    this.position.step(f.px, py, f.pz, dt);
    this.target.step(f.tx, f.ty, tz, dt);
    this.fov.step(f.fov, dt);
    this.roll.step(f.roll, dt);

    this.position.applyTo(this._pos);
    this.target.applyTo(this._tgt);

    if (this.world) {
      const px = this._pos.x, pz = this._pos.z;
      let ground = this.world.heightAt(px, pz);

      const vx = this.position.x.velocity;
      const vz = this.position.z.velocity;
      const hSpeed = Math.sqrt(vx * vx + vz * vz);
      if (hSpeed > 1) {
        const nx = vx / hSpeed, nz = vz / hSpeed;
        ground = Math.max(ground, this.world.heightAt(px + nx * 4, pz + nz * 4));
      }

      const floor = ground + 1.2;
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

class FreeRoamCamera {
  constructor(camera, options) {
    this.T = options.THREE;
    this.camera = camera;
    this.world = options.world;
    this.root = options.root;
    this.active = false;
    this._disposers = [];

    this.yaw = 0;
    this.pitch = -0.15;
    this.altitude = 40;
    this.speed = 60;
    this.fov = new Spring(52, 0.5);

    this._pos = new this.T.Vector3();
    this._vel = new this.T.Vector3();
    this._keys = new Set();
    this._dragging = false;
    this._lastMouse = { x: 0, y: 0 };
  }

  activate(fromCamera) {
    this._pos.copy(fromCamera.position);
    const dir = new this.T.Vector3();
    fromCamera.getWorldDirection(dir);
    this.yaw = Math.atan2(dir.x, dir.z);
    this.pitch = Math.asin(clamp(dir.y, -0.99, 0.99));
    this.altitude = this._pos.y;
    this.fov.reset(fromCamera.fov);
    this._vel.set(0, 0, 0);
    this.active = true;
    this._bind();
  }

  _bind() {
    const add = (target, type, handler, opts) => {
      target.addEventListener(type, handler, opts);
      this._disposers.push(() => target.removeEventListener(type, handler, opts));
    };
    add(this.root, 'pointerdown', e => {
      if (e.target.closest('button, a, input, [role="button"]')) return;
      this._dragging = true;
      this._lastMouse = { x: e.clientX, y: e.clientY };
    });
    add(window, 'pointermove', e => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastMouse.x;
      const dy = e.clientY - this._lastMouse.y;
      this._lastMouse = { x: e.clientX, y: e.clientY };
      this.yaw -= dx * 0.003;
      this.pitch = clamp(this.pitch - dy * 0.003, -1.4, 1.4);
    }, { passive: true });
    add(window, 'pointerup', () => { this._dragging = false; });
    add(window, 'keydown', e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this._keys.add(e.key.toLowerCase());
    });
    add(window, 'keyup', e => { this._keys.delete(e.key.toLowerCase()); });
    add(window, 'blur', () => { this._keys.clear(); this._dragging = false; });
    add(this.root, 'wheel', e => {
      this.altitude = Math.max(4, this.altitude + e.deltaY * 0.08);
    }, { passive: true });
  }

  update(dt) {
    if (!this.active) return null;

    const forward = new this.T.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new this.T.Vector3(forward.z, 0, -forward.x);
    const accel = new this.T.Vector3();

    if (this._keys.has('w') || this._keys.has('arrowup')) accel.add(forward);
    if (this._keys.has('s') || this._keys.has('arrowdown')) accel.sub(forward);
    if (this._keys.has('d') || this._keys.has('arrowright')) accel.add(right);
    if (this._keys.has('a') || this._keys.has('arrowleft')) accel.sub(right);
    if (this._keys.has(' ')) this.altitude += this.speed * dt * 0.5;
    if (this._keys.has('shift')) this.altitude = Math.max(4, this.altitude - this.speed * dt * 0.5);

    if (accel.lengthSq() > 0) accel.normalize();
    accel.multiplyScalar(this.speed);
    this._vel.lerp(accel, Math.min(1, dt * 4));
    this._pos.addScaledVector(this._vel, dt);

    const ground = this.world ? this.world.heightAt(this._pos.x, this._pos.z) : 0;
    const floor = ground + 2.5;
    if (this.altitude < floor) this.altitude = floor;
    this._pos.y += (this.altitude - this._pos.y) * Math.min(1, dt * 3);
    if (this._pos.y < floor) this._pos.y = floor;

    const lookDir = new this.T.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    const target = this._pos.clone().add(lookDir.multiplyScalar(100));

    this.fov.step(52, dt);
    this.camera.position.copy(this._pos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);
    this.camera.fov = this.fov.value;
    this.camera.updateProjectionMatrix();

    const distance = 100;
    return {
      focus: distance * 0.55,
      focusRange: mix(90, 520, clamp01(distance / 700)),
      altitude: this.altitude,
    };
  }

  dispose() {
    for (const off of this._disposers) off();
    this._disposers.length = 0;
    this.active = false;
  }
}
