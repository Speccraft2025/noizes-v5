/* AudioClock — audio.currentTime is the only authored clock in this edition.
 *
 * Nothing else advances state: there is no setInterval, no free-running
 * animation time, and no second timeline. The render loop asks this object what
 * time the recording is at, and everything else is a pure function of that
 * answer.
 *
 * `exact` is the element's own value and is what drives all authored state.
 * `time` adds sub-frame interpolation *between* the element's updates purely so
 * that motion does not judder when a browser quantises currentTime to its audio
 * callback. It re-locks to `exact` whenever the element reports a new value and
 * can never drift more than one frame away from it.
 */

class AudioClock {
  constructor(element, { end = Infinity } = {}) {
    this.el = element;
    this.end = end;
    this.exact = 0;
    this.time = 0;
    this.playing = false;
    this.ended = false;
    this.rate = 1;
    this._lastExact = -1;
    this._lastWall = 0;
    this._listeners = new Set();
    this._disposers = [
      dom.on(element, 'play', () => { this.playing = true; this._emit('play'); }),
      dom.on(element, 'pause', () => { this.playing = false; this._emit('pause'); }),
      dom.on(element, 'seeking', () => this.relock()),
      dom.on(element, 'seeked', () => { this.relock(); this._emit('seek'); }),
      dom.on(element, 'ratechange', () => { this.rate = element.playbackRate || 1; }),
    ];
  }

  onChange(handler) { this._listeners.add(handler); return () => this._listeners.delete(handler); }
  _emit(type) { for (const handler of this._listeners) handler(type, this); }

  relock() {
    this.exact = this.el.currentTime || 0;
    this.time = this.exact;
    this._lastExact = this.exact;
    this._lastWall = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  }

  /** Advance the read head. Called once per rendered frame. */
  sample(wallSeconds) {
    const raw = this.el.currentTime || 0;
    this.exact = raw;

    if (raw !== this._lastExact) {
      this._lastExact = raw;
      this._lastWall = wallSeconds;
      this.time = raw;
    } else if (this.playing) {
      // The element has not reported a new value yet. Interpolate, but never
      // beyond a single frame of the element's own update cadence.
      const predicted = raw + (wallSeconds - this._lastWall) * this.rate;
      this.time = Math.min(predicted, raw + 0.05);
    } else {
      this.time = raw;
    }

    if (this.time >= this.end) {
      this.time = this.end;
      this.exact = Math.min(this.exact, this.end);
      if (!this.ended) {
        this.ended = true;
        // The slice boundary sits inside the record's own near-silence, so the
        // transport simply stops. Nothing is faded, ducked or cut short.
        if (!this.el.paused) this.el.pause();
        this._emit('slice-end');
      }
    } else if (this.ended && this.time < this.end - 0.05) {
      this.ended = false;
    }
    return this.time;
  }

  seek(seconds) {
    const target = clamp(seconds, 0, this.end);
    this.el.currentTime = target;
    this.relock();
  }

  async play() {
    if (this.ended) this.seek(0);
    try {
      await this.el.play();
      return true;
    } catch (error) {
      this._emit('blocked');
      return false;
    }
  }

  pause() { this.el.pause(); }
  toggle() { return this.el.paused ? this.play() : (this.el.pause(), Promise.resolve(true)); }

  dispose() {
    for (const off of this._disposers) off();
    this._listeners.clear();
  }
}
