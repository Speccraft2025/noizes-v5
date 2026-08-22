import * as THREE from 'three';
import { CameraDirector } from '../camera/cameraDirector.js';
import { applyTerrainClearance } from '../camera/terrainClearance.js';
import { buildGeographicJourney, sampleGeographicJourney } from '../journey/buildGeographicJourney.js';
import { V2_SHOTS } from '../camera/shotTypes.js';
import { createRenderer } from '../render/renderer.js';

export class TranscendenceV2 {
  constructor(container) {
    this.container = container;
    this.config = window.__TXV2_CONFIG || {};
    this.activeShot = V2_SHOTS[0].id;
    this.captureMode = false;
    this.lastFrameTime = 0;
    this.raf = 0;
    this.disposed = false;
    this.started = false;
    this.lastChapter = '';
    this.reviewMode = false;
    this.recordMode = false;
    this.recordingStopped = false;
    this.reviewElapsed = 0;
  }

  mount() {
    const params = new URLSearchParams(window.location.search);
    const requestedShot = params.get('shot');
    if (requestedShot && V2_SHOTS.some((shot) => shot.id === requestedShot)) this.activeShot = requestedShot;
    this.captureMode = params.get('capture') === '1' || Boolean(requestedShot);
    this.reviewMode = params.get('review') === '1' || params.get('record') === '1';
    this.recordMode = params.get('record') === '1';
    this.reviewAt = params.has('reviewAt') ? THREE.MathUtils.clamp(Number(params.get('reviewAt')), 0, 1) : null;
    if (this.reviewAt !== null) this.reviewMode = true;
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.directionTracks = this.config.directionTracks || {};
    this.renderState = createRenderer(this.container, {
      worldData: this.config.worldData,
      geography: this.config.geography,
      qualityProfile: this.config.qualityProfile,
    });
    this.configureShotsFromWorld();
    this.journey = this.config.journey || buildGeographicJourney(
      this.renderState.worldData,
      this.renderState.geography,
      this.renderState.terrain.sampleHeightAt,
    );
    this.director = new CameraDirector(this.renderState.camera, this.prefersReducedMotion);

    if (this.captureMode) {
      this.director.frameShot(this.shot(), true);
    } else if (this.reviewMode) {
      this.director.frameShot(this.clearanceFrame(sampleGeographicJourney(this.journey, 0)), true);
      this.reviewElapsed = 0;
      if (this.reviewAt !== null) this.primeReviewAt(this.reviewAt);
      if (this.recordMode) requestAnimationFrame(() => this.startRecording());
    } else {
      this.director.frameShot(this.clearanceFrame(sampleGeographicJourney(this.journey, 0)), true);
      this.mountExperienceUi();
      this.createAudio();
    }

    this.renderState.resize();
    this.lastFrameTime = performance.now();
    this.onResize = () => this.renderState.resize();
    this.onKeyDown = (event) => {
      if (event.code === 'Space' && !this.captureMode) {
        event.preventDefault();
        this.togglePlayback();
      }
      if (event.key === '1') this.setShot('aerial');
      if (event.key === '2') this.setShot('trough');
      if (event.key === '3') this.setShot('crest');
    };
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    this.onMessage = (event) => {
      if (event.data?.type === 'ned:direction-tracks') this.directionTracks = event.data.tracks || {};
    };
    window.addEventListener('message', this.onMessage);
    this.animate();
  }

  createAudio() {
    this.audio = new Audio(this.config.audioPath);
    this.audio.preload = 'auto';
    this.audio.addEventListener('play', () => this.setPlayingUi(true));
    this.audio.addEventListener('pause', () => this.setPlayingUi(false));
    this.audio.addEventListener('ended', () => {
      this.setPlayingUi(false);
      this.playButton.textContent = 'Replay';
    });
    this.audio.load();
  }

  mountExperienceUi() {
    const title = escapeText(this.config.title || 'Untitled');
    const artist = escapeText(this.config.artist || '');
    const label = escapeText(this.config.label || 'TRANSCENDENCE V2');
    this.ui = document.createElement('section');
    this.ui.className = 'txv2-ui';
    this.ui.innerHTML = `
      <header class="txv2-header">
        <div><span class="txv2-kicker">${label}</span><strong>${title}</strong></div>
        <button class="txv2-control" type="button" aria-label="Play or pause">Pause</button>
      </header>
      <div class="txv2-chapter" aria-live="polite">AERIAL OVERVIEW</div>
      <div class="txv2-progress"><i></i></div>
      <div class="txv2-entry">
        <div class="txv2-entry-copy">
          <span>A NOIZES GEOGRAPHIC FLIGHT</span>
          <h1>${title}</h1>
          <p>${artist}</p>
          <button type="button">Begin the journey</button>
        </div>
      </div>`;
    this.container.appendChild(this.ui);
    this.entry = this.ui.querySelector('.txv2-entry');
    this.entryButton = this.entry.querySelector('button');
    this.playButton = this.ui.querySelector('.txv2-control');
    this.chapterLabel = this.ui.querySelector('.txv2-chapter');
    this.progressFill = this.ui.querySelector('.txv2-progress i');
    this.entryButton.addEventListener('click', () => this.begin());
    this.playButton.addEventListener('click', () => this.togglePlayback());
  }

  async begin() {
    if (!this.audio) return;
    if (this.audio.ended || this.audio.currentTime >= this.duration() - 0.1) this.audio.currentTime = 0;
    try {
      await this.audio.play();
      this.started = true;
      this.entry.classList.add('is-hidden');
    } catch (error) {
      this.entryButton.textContent = 'Tap to allow audio';
    }
  }

  async togglePlayback() {
    if (!this.started || this.audio?.ended) {
      await this.begin();
      return;
    }
    if (this.audio.paused) await this.audio.play();
    else this.audio.pause();
  }

  duration() {
    return Number.isFinite(this.audio?.duration) ? this.audio.duration : (this.config.durationSeconds || 63.425);
  }

  progress() {
    if (this.reviewMode) {
      return Math.min(this.reviewElapsed / this.duration(), 1);
    }
    if (!this.audio) return 0;
    return Math.min(this.audio.currentTime / Math.max(this.duration(), 0.001), 1);
  }

  shot() {
    return V2_SHOTS.find((entry) => entry.id === this.activeShot) ?? V2_SHOTS[0];
  }

  configureShotsFromWorld() {
    const { worldData, terrain } = this.renderState;
    for (const shot of V2_SHOTS) {
      const template = worldData.shots[shot.id];
      if (!template) continue;
      shot.position.copy(template.position);
      shot.target.copy(template.target);
      shot.position.y = terrain.sampleHeightAt(shot.position.x, shot.position.z) + shotHeightOffset(shot.id);
      shot.target.y = terrain.sampleHeightAt(shot.target.x, shot.target.z) + shotTargetOffset(shot.id);
      shot.fov = template.fov;
    }
  }

  setShot(id) {
    this.captureMode = true;
    this.activeShot = id;
    this.director.frameShot(this.shot());
  }

  clearanceFrame(frame) {
    return applyTerrainClearance(frame, this.renderState.terrain.sampleHeightAt);
  }

  setPlayingUi(playing) {
    if (!this.playButton) return;
    this.playButton.textContent = playing ? 'Pause' : 'Play';
    this.playButton.setAttribute('aria-label', playing ? 'Pause experience' : 'Play experience');
  }

  updateUi(frame, progress) {
    if (!this.ui) return;
    const chapter = frame.chapter.replaceAll('_', ' ');
    if (chapter !== this.lastChapter) {
      this.chapterLabel.textContent = chapter;
      this.chapterLabel.classList.remove('is-changing');
      void this.chapterLabel.offsetWidth;
      this.chapterLabel.classList.add('is-changing');
      this.lastChapter = chapter;
    }
    this.progressFill.style.transform = `scaleX(${progress})`;
  }

  directionAt(name, seconds, fallback = 1) {
    const frames = this.directionTracks?.[name];
    if (!Array.isArray(frames) || !frames.length) return fallback;
    if (seconds <= frames[0].time) return Number(frames[0].value);
    const nextIndex = frames.findIndex((frame) => frame.time >= seconds);
    if (nextIndex < 0) return Number(frames.at(-1).value);
    const from = frames[nextIndex - 1];
    const to = frames[nextIndex];
    const local = (seconds - from.time) / Math.max(to.time - from.time, 0.001);
    return THREE.MathUtils.lerp(Number(from.value), Number(to.value), local);
  }

  startRecording() {
    const canvas = this.renderState.renderer.domElement;
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
      document.body.dataset.recordingError = 'MediaRecorder unavailable';
      return;
    }
    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    this.recordingChunks = [];
    this.recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
    this.recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size) this.recordingChunks.push(event.data);
    });
    this.recorder.addEventListener('stop', () => {
      const blob = new Blob(this.recordingChunks, { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.id = 'recording-download';
      link.href = blobUrl;
      link.download = `${recordingName(this.config.title)}-Transcendence-V2.webm`;
      link.textContent = 'Download recording';
      link.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:20;padding:10px 14px;color:white;background:#08120b;border:1px solid #d8c48a;border-radius:999px;font:12px monospace';
      document.body.appendChild(link);
      const video = document.createElement('video');
      video.id = 'recording-asset';
      video.src = blobUrl;
      video.style.display = 'none';
      document.body.appendChild(video);
      document.body.dataset.recordingComplete = 'true';
    });
    this.recorder.start(1000);
  }

  finishRecording(now) {
    if (!this.recordMode || this.recordingStopped || this.progress() < 1) return;
    this.recordFinishedAt ||= now;
    if (now - this.recordFinishedAt < 1600) return;
    this.recordingStopped = true;
    document.body.dataset.cameraMetrics = JSON.stringify(this.director.metrics);
    if (this.recorder?.state === 'recording') this.recorder.stop();
  }

  primeReviewAt(progress) {
    const frameCount = Math.ceil(progress * this.duration() * 60);
    for (let index = 0; index <= frameCount; index += 1) {
      const p = Math.min(index / 60 / this.duration(), progress);
      const frame = this.clearanceFrame(sampleGeographicJourney(this.journey, p));
      this.director.update(frame, 1 / 60);
    }
    this.reviewElapsed = progress * this.duration();
    this.reviewFrozen = true;
  }

  animate = (now = performance.now()) => {
    if (this.disposed) return;
    const delta = THREE.MathUtils.clamp((now - this.lastFrameTime) / 1000, 0, 0.08);
    this.lastFrameTime = now;
    if (this.reviewMode && !this.reviewFrozen) this.reviewElapsed += delta;

    if (this.captureMode) {
      this.director.update(this.shot(), delta);
    } else {
      const progress = this.progress();
      const seconds = progress * this.duration();
      const frame = this.clearanceFrame(sampleGeographicJourney(this.journey, progress));
      const ahead = this.directionAt('ahead', seconds, 1);
      const air = this.directionAt('air', seconds, 1);
      frame.target.lerp(frame.position, THREE.MathUtils.clamp((1 - ahead) * 0.12, -0.12, 0.12));
      frame.position.y += (air - 1) * 70;
      frame.target.y += (air - 1) * 35;
      frame.fov += (this.directionAt('relief', seconds, 1) - 1) * -2;
      this.renderState.setDirection({
        exposure: this.directionAt('exposure', seconds, 1),
        atmosphere: this.directionAt('atmosphere', seconds, 1),
      });
      this.director.update(frame, delta);
      this.updateUi(frame, progress);
    }

    this.renderState.stars.rotation.y += delta * 0.003;
    this.renderState.glow.lookAt(this.renderState.camera.position);
    this.renderState.render();
    this.finishRecording(now);
    this.raf = requestAnimationFrame(this.animate);
  };

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.audio?.pause();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('message', this.onMessage);
    this.ui?.remove();
    this.renderState?.dispose();
  }
}

function shotHeightOffset(id) {
  if (id === 'aerial') return 5000;
  if (id === 'trough') return 145;
  return 540;
}

function shotTargetOffset(id) {
  if (id === 'aerial') return 120;
  if (id === 'trough') return 115;
  return 60;
}

function escapeText(value) {
  const node = document.createElement('span');
  node.textContent = String(value);
  return node.innerHTML;
}

function recordingName(value) {
  return String(value || 'Noizes-Experience').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
}
