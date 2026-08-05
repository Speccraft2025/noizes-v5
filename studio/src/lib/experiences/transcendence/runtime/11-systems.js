/* PerformanceGovernor, AccessibilityController, InteractionSystem and the
 * ArchiveLayer that produces the residue artefact. */

const QUALITY_ORDER = ['cinematic', 'balanced', 'lite', 'essential'];

/* ------------------------------------------------------- performance governor */

/* Measured frame time with hysteresis. A single slow frame means nothing — a
 * texture upload, a tab regaining focus, another process. Only a sustained
 * budget overrun downgrades, and the governor never upgrades on its own or
 * overrides a quality the listener chose. */
class PerformanceGovernor {
  constructor({ onChange, initial = 'balanced' }) {
    this.index = QUALITY_ORDER.indexOf(initial);
    if (this.index < 0) this.index = 1;
    this.onChange = onChange;
    this.locked = false;          // set when the listener picks a quality
    this.ema = 16.7;
    this.overBudget = 0;
    this.frames = 0;
    this.budgetMs = 23;           // ~43 fps: below this we are losing the shot
    this.cooldown = 0;
  }

  get quality() { return QUALITY_ORDER[this.index]; }

  lock(quality) {
    this.locked = true;
    const next = QUALITY_ORDER.indexOf(quality);
    if (next >= 0 && next !== this.index) {
      this.index = next;
      this.onChange(this.quality, 'listener');
    }
  }

  sample(frameMs) {
    this.frames++;
    this.ema = this.ema * 0.9 + frameMs * 0.1;
    if (this.locked || this.frames < 120) return;
    if (this.cooldown > 0) { this.cooldown--; return; }

    if (this.ema > this.budgetMs) {
      this.overBudget++;
      if (this.overBudget > 90 && this.index < QUALITY_ORDER.length - 2) {
        this.index++;
        this.overBudget = 0;
        this.cooldown = 240;
        this.ema = 16.7;
        this.onChange(this.quality, 'governor');
      }
    } else {
      this.overBudget = Math.max(0, this.overBudget - 2);
    }
  }
}

/* -------------------------------------------------------------- accessibility */

/* Accessibility is not a settings appendix here. The scene description, the
 * lyric and the recovered-memory state are the same information the visual
 * world carries, delivered in a form that does not require it. */
class AccessibilityController {
  constructor(elements, analysis) {
    this.el = elements;
    this.analysis = analysis;
    this.lastCue = -1;
    this.lastLyric = -1;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.highContrast = window.matchMedia('(prefers-contrast: more)').matches;
    this.captions = true;
    this._buildLyricList();
  }

  _buildLyricList() {
    const list = this.el.lyricList;
    if (!list) return;
    list.innerHTML = '';
    for (const cue of SEQUENCE) {
      if (cue.lyric === undefined) continue;
      const line = this.analysis.lyrics[cue.lyric];
      const item = document.createElement('li');
      item.dataset.time = String(cue.time);
      const time = document.createElement('button');
      time.type = 'button';
      time.className = 'lyric-jump';
      time.textContent = timecode(cue.time);
      time.setAttribute('aria-label', `Play from ${timecode(cue.time)}: ${line.text}`);
      const text = document.createElement('span');
      text.textContent = line.text;
      item.append(time, text);
      list.append(item);
    }
  }

  /** Announce a scene at every cue boundary — the state, not the effect. */
  update(state, extras) {
    if (state.index !== this.lastCue) {
      this.lastCue = state.index;
      this.el.sceneDescription.textContent = state.cue.scene;
      this.el.sceneTitle.textContent = state.cue.title;
      this.announce(`${state.cue.title}. ${state.cue.scene}`);
    }

    const active = state.engraveWindow;
    const index = active ? active.lyric : -1;
    if (index !== this.lastLyric) {
      this.lastLyric = index;
      const text = index >= 0 ? this.analysis.lyrics[index].text : 'The plate is resonating. No line is being written.';
      this.el.stableLyric.textContent = text;
      if (this.captions && index >= 0) {
        this.el.caption.textContent = text;
        this.el.caption.dataset.visible = 'true';
      } else {
        this.el.caption.dataset.visible = 'false';
      }
      for (const item of this.el.lyricList.children) {
        item.dataset.active = String(Number(item.dataset.time) === (index >= 0 ? active.start : -1));
      }
    }

    if (extras && this.el.memory) {
      this.el.memory.textContent = extras.memory;
    }
  }

  announce(message) {
    // Re-announce identical text by clearing first, or a screen reader will
    // silently drop it.
    this.el.live.textContent = '';
    window.requestAnimationFrame(() => { this.el.live.textContent = message; });
  }

  status(message) { this.el.status.textContent = message; }
}

/* ------------------------------------------------------------- interaction */

/* Two presences, both optional, neither able to alter the authored musical arc:
 *
 *   attention  — where the listener is looking. Deposition sharpens there, and
 *                the focal plane follows. Holding still rewards with settling.
 *   engraving  — holding the gesture during an inscription commits more matter
 *                to that line. It survives into the artefact at the end.
 *
 * Both have full keyboard equivalents, because a gesture an assistive
 * technology cannot perform must never be the only route to anything.
 */
class InteractionSystem {
  constructor(root, { onEngage, onThresholdHold, onThresholdRelease }) {
    this.root = root;
    this.onEngage = onEngage;
    this.onThresholdHold = onThresholdHold;
    this.onThresholdRelease = onThresholdRelease;

    this.attention = { x: 0, y: 0 };
    this.attentionTarget = { x: 0, y: 0 };
    this.stillFor = 0;
    this.holding = false;
    this.holdFor = 0;
    this.pointerActive = false;
    this.lastPointer = 0;
    this.keys = new Set();
    this._disposers = [];
    this._bind();
  }

  _bind() {
    const add = (target, type, handler, options) => this._disposers.push(dom.on(target, type, handler, options));

    add(this.root, 'pointermove', event => {
      const rect = this.root.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      const moved = Math.abs(nx - this.attentionTarget.x) + Math.abs(ny - this.attentionTarget.y);
      this.attentionTarget.x = clamp(nx, -1, 1);
      this.attentionTarget.y = clamp(ny, -1, 1);
      if (moved > 0.012) this.stillFor = 0;
      this.pointerActive = true;
      this.lastPointer = performance.now();
    }, { passive: true });

    add(this.root, 'pointerdown', event => {
      if (event.target.closest('button, a, input, [role="button"]')) return;
      this.holding = true;
      this.onThresholdHold?.();
    });
    add(window, 'pointerup', () => {
      if (!this.holding) return;
      this.holding = false;
      this.holdFor = 0;
      this.onThresholdRelease?.();
    });
    add(window, 'blur', () => { this.holding = false; this.keys.clear(); });

    add(window, 'keydown', event => {
      if (event.repeat) return;
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if (typing) return;
      this.keys.add(event.key);
      if (event.key === 'Enter' || event.key === 'k' || event.key === 'K') {
        this.holding = true;
        this.onThresholdHold?.();
      }
    });
    add(window, 'keyup', event => {
      this.keys.delete(event.key);
      if (event.key === 'Enter' || event.key === 'k' || event.key === 'K') {
        this.holding = false;
        this.holdFor = 0;
        this.onThresholdRelease?.();
      }
    });
  }

  update(dt) {
    // Keyboard aiming, so attention is never pointer-only.
    const step = dt * 1.35;
    if (this.keys.has('ArrowLeft')) { this.attentionTarget.x = clamp(this.attentionTarget.x - step, -1, 1); this.stillFor = 0; }
    if (this.keys.has('ArrowRight')) { this.attentionTarget.x = clamp(this.attentionTarget.x + step, -1, 1); this.stillFor = 0; }
    if (this.keys.has('ArrowUp')) { this.attentionTarget.y = clamp(this.attentionTarget.y - step, -1, 1); this.stillFor = 0; }
    if (this.keys.has('ArrowDown')) { this.attentionTarget.y = clamp(this.attentionTarget.y + step, -1, 1); this.stillFor = 0; }

    this.attention.x += (this.attentionTarget.x - this.attention.x) * Math.min(1, dt * 3.2);
    this.attention.y += (this.attentionTarget.y - this.attention.y) * Math.min(1, dt * 3.2);
    this.stillFor += dt;
    if (this.holding) this.holdFor += dt;

    // Stillness is the reward: hold your attention and the deposit thickens.
    // This is the correct ethic for a recording made by people who are gone.
    this.settle = clamp01(smoothstep(1.5, 6.5, this.stillFor));
    return this.settle;
  }

  dispose() { for (const off of this._disposers) off(); this._disposers.length = 0; }
}

/* ------------------------------------------------------------ archive layer */

/* The residue. Two listeners who attended differently take away visibly
 * different objects, and the identity is derived — never invented — from the
 * analysis hash and what actually happened during the session. */
class ArchiveLayer {
  constructor(analysis, edition) {
    this.analysis = analysis;
    this.edition = edition;
    this.engraved = [false, false, false, false];
    this.settledSeconds = 0;
    this.attendedSeconds = 0;
  }

  recordEngrave(lyricIndex) {
    if (lyricIndex >= 0 && lyricIndex < this.engraved.length) this.engraved[lyricIndex] = true;
  }

  accumulate(dt, settle) {
    this.settledSeconds += dt * settle;
    this.attendedSeconds += dt;
  }

  /** A short, stable identity for this listening. Deterministic, offline, local. */
  presenceHash() {
    const parts = [
      this.analysis.sourceHash.slice(0, 16),
      this.edition.edition_id,
      this.engraved.map(v => (v ? '1' : '0')).join(''),
      Math.round(this.settledSeconds * 4),
    ].join('|');
    // FNV-1a, twice, over the composed string.
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < parts.length; i++) {
      h1 ^= parts.charCodeAt(i); h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ parts.charCodeAt(parts.length - 1 - i), 0x85ebca6b) >>> 0;
    }
    return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).toUpperCase();
  }

  summary() {
    const engravedCount = this.engraved.filter(Boolean).length;
    return {
      hash: this.presenceHash(),
      engraved: engravedCount,
      lines: this.engraved.map((v, i) => ({ index: i, engraved: v, text: this.analysis.lyrics[i]?.text ?? '' })),
      settled: Math.round(this.settledSeconds),
      statement: engravedCount === 0
        ? 'You listened without pressing. The four lines are cut at the depth the recording alone could manage.'
        : engravedCount === 4
          ? 'You pressed on every line. All four are cut to full depth in this copy.'
          : `You pressed on ${engravedCount} of the four lines. Those are cut deeper here than in any other copy.`,
    };
  }
}
