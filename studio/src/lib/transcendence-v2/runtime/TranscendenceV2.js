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
    this.lastLyricIndex = -1;
    this.reviewMode = false;
    this.recordMode = false;
    this.recordingStopped = false;
    this.reviewElapsed = 0;
    this.exploreMode = false;
    this.exploreKeys = new Set();
    this.explorePointer = null;
    this.archiveData = isArchiveData(window.__TXV2_ARCHIVE) ? window.__TXV2_ARCHIVE : null;
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
      if (event.code === 'Escape' && this.archiveLayer?.classList.contains('is-visible')) {
        this.closeArchive();
        return;
      }
      if (this.exploreMode) {
        if (exploreKey(event.code)) {
          event.preventDefault();
          this.exploreKeys.add(event.code);
        } else if (event.code === 'Space') {
          event.preventDefault();
        }
        return;
      }
      if (event.code === 'Space' && !this.captureMode) {
        event.preventDefault();
        this.togglePlayback();
      }
      if (event.key === '1') this.setShot('aerial');
      if (event.key === '2') this.setShot('trough');
      if (event.key === '3') this.setShot('crest');
    };
    this.onKeyUp = (event) => this.exploreKeys.delete(event.code);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.onMessage = (event) => {
      if (event.data?.type === 'ned:direction-tracks') this.directionTracks = event.data.tracks || {};
      if (event.data?.type === 'ned:visual-update') {
        this.config.artDirection = { ...(this.config.artDirection || {}), ...(event.data.artDirection || {}) };
        this.applyLyricStyle();
      }
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
      this.revealEndActions();
    });
    this.audio.load();
  }

  mountExperienceUi() {
    const title = escapeText(this.config.title || 'Untitled');
    const artist = escapeText(this.config.artist || '');
    this.lyrics = Array.isArray(this.config.timedLyrics) ? this.config.timedLyrics : [];
    this.ui = document.createElement('section');
    this.ui.className = 'txv2-ui';
    this.ui.innerHTML = `
      <button class="txv2-control" type="button" aria-label="Play or pause">Pause</button>
      <div class="txv2-end-actions" aria-label="Experience complete">
        <button class="txv2-explore" type="button">Explore</button>
        <button class="txv2-archive-button" type="button">Archive</button>
      </div>
      <div class="txv2-lyrics is-empty" aria-live="polite" aria-atomic="true"></div>
      <div class="txv2-progress"><i></i></div>
      <aside class="txv2-map" aria-label="Landscape map">
        <header><span>Landscape</span><strong class="txv2-nearest">Free roam</strong></header>
        <svg viewBox="0 0 240 170" role="img" aria-label="Landmarks and current direction"></svg>
        <p>Drag to look &middot; WASD to move &middot; Q/E altitude</p>
      </aside>
      <div class="txv2-roam-pad" aria-label="Explore movement controls">
        <button type="button" data-explore-key="KeyW" aria-label="Move forward">&uarr;</button>
        <button type="button" data-explore-key="KeyA" aria-label="Move left">&larr;</button>
        <button type="button" data-explore-key="KeyS" aria-label="Move backward">&darr;</button>
        <button type="button" data-explore-key="KeyD" aria-label="Move right">&rarr;</button>
        <button type="button" data-explore-key="KeyE" aria-label="Rise">+</button>
        <button type="button" data-explore-key="KeyQ" aria-label="Descend">-</button>
      </div>
      <section class="txv2-archive" aria-label="Package archive" aria-hidden="true">
        <div class="txv2-archive-shell">
          <header><div><span>Noizes archive</span><h2>${title}</h2></div><button class="txv2-archive-close" type="button">Return to landscape</button></header>
          <nav class="txv2-archive-nav" aria-label="Archive sections"></nav>
          <main class="txv2-archive-content"></main>
        </div>
      </section>
      <div class="txv2-entry">
        <div class="txv2-entry-copy">
          <span>A NOIZES GEOGRAPHIC FLIGHT</span>
          <h1>${title}</h1>
          <p>${artist}</p>
          <button type="button">Begin the journey</button>
        </div>
      </div>`;
    this.container.appendChild(this.ui);
    this.applyLyricStyle();
    this.entry = this.ui.querySelector('.txv2-entry');
    this.entryButton = this.entry.querySelector('button');
    this.playButton = this.ui.querySelector('.txv2-control');
    this.lyricLabel = this.ui.querySelector('.txv2-lyrics');
    this.progressFill = this.ui.querySelector('.txv2-progress i');
    this.endActions = this.ui.querySelector('.txv2-end-actions');
    this.exploreButton = this.ui.querySelector('.txv2-explore');
    this.archiveButton = this.ui.querySelector('.txv2-archive-button');
    this.map = this.ui.querySelector('.txv2-map');
    this.mapSvg = this.map.querySelector('svg');
    this.nearestLabel = this.map.querySelector('.txv2-nearest');
    this.archiveLayer = this.ui.querySelector('.txv2-archive');
    this.archiveNav = this.ui.querySelector('.txv2-archive-nav');
    this.archiveContent = this.ui.querySelector('.txv2-archive-content');
    this.entryButton.addEventListener('click', () => this.begin());
    this.playButton.addEventListener('click', () => this.togglePlayback());
    this.exploreButton.addEventListener('click', () => this.enterExplore());
    this.archiveButton.addEventListener('click', () => this.openArchive());
    this.archiveLayer.querySelector('.txv2-archive-close').addEventListener('click', () => this.closeArchive());
    this.mountExplorePointerControls();
    this.mountExplorePad();
    this.renderMinimap();
    this.mountArchive();
  }

  async begin() {
    if (!this.audio) return;
    if (this.audio.ended || this.audio.currentTime >= this.duration() - 0.1) {
      this.audio.currentTime = 0;
      this.exitExplore();
      this.endActions.classList.remove('is-visible');
      this.ui.classList.remove('is-ended');
    }
    try {
      await this.audio.play();
      this.started = true;
      this.entry.classList.add('is-hidden');
    } catch (error) {
      this.entryButton.textContent = 'Tap to allow audio';
    }
  }

  revealEndActions() {
    if (!this.endActions) return;
    this.ui.classList.add('is-ended');
    this.endActions.classList.add('is-visible');
    this.archiveButton.hidden = !this.archiveData;
  }

  enterExplore() {
    this.exploreMode = true;
    this.archiveLayer.classList.remove('is-visible');
    this.archiveLayer.setAttribute('aria-hidden', 'true');
    this.ui.classList.add('is-exploring');
    this.exploreButton.textContent = 'Exploring';
    const euler = new THREE.Euler().setFromQuaternion(this.renderState.camera.quaternion, 'YXZ');
    this.exploreYaw = euler.y;
    this.explorePitch = THREE.MathUtils.clamp(euler.x, -0.72, 0.35);
    this.exploreVelocity = this.exploreVelocity || new THREE.Vector3();
    this.renderState.camera.fov = THREE.MathUtils.clamp(this.renderState.camera.fov, 44, 58);
    this.renderState.camera.updateProjectionMatrix();
  }

  exitExplore() {
    this.exploreMode = false;
    this.exploreKeys.clear();
    this.ui?.classList.remove('is-exploring');
    if (this.exploreButton) this.exploreButton.textContent = 'Explore';
  }

  mountExplorePointerControls() {
    const canvas = this.renderState.renderer.domElement;
    this.onPointerDown = (event) => {
      if (!this.exploreMode || this.archiveLayer.classList.contains('is-visible')) return;
      this.explorePointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture?.(event.pointerId);
    };
    this.onPointerMove = (event) => {
      if (!this.explorePointer || this.explorePointer.id !== event.pointerId) return;
      const dx = event.clientX - this.explorePointer.x;
      const dy = event.clientY - this.explorePointer.y;
      this.explorePointer.x = event.clientX;
      this.explorePointer.y = event.clientY;
      this.exploreYaw -= dx * 0.003;
      this.explorePitch = THREE.MathUtils.clamp(this.explorePitch - dy * 0.0024, -0.85, 0.42);
    };
    this.onPointerUp = (event) => {
      if (this.explorePointer?.id === event.pointerId) this.explorePointer = null;
    };
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
  }

  mountExplorePad() {
    for (const button of this.ui.querySelectorAll('[data-explore-key]')) {
      const key = button.dataset.exploreKey;
      const press = (event) => {
        if (!this.exploreMode) return;
        event.preventDefault();
        this.exploreKeys.add(key);
        button.setPointerCapture?.(event.pointerId);
      };
      const release = () => this.exploreKeys.delete(key);
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', release);
    }
  }

  updateExplore(delta) {
    const camera = this.renderState.camera;
    const sprinting = this.exploreKeys.has('ShiftLeft') || this.exploreKeys.has('ShiftRight');
    const speed = sprinting ? 900 : 420;
    const forwardInput = axis(this.exploreKeys, ['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
    const sideInput = axis(this.exploreKeys, ['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
    const verticalInput = axis(this.exploreKeys, ['KeyQ'], ['KeyE']);
    const forward = new THREE.Vector3(-Math.sin(this.exploreYaw), 0, -Math.cos(this.exploreYaw));
    const right = new THREE.Vector3(Math.cos(this.exploreYaw), 0, -Math.sin(this.exploreYaw));
    const desired = forward.multiplyScalar(forwardInput).addScaledVector(right, sideInput);
    if (desired.lengthSq() > 1) desired.normalize();
    desired.multiplyScalar(speed);
    desired.y = verticalInput * speed * 0.7;
    const hasInput = forwardInput !== 0 || sideInput !== 0 || verticalInput !== 0;
    const responsiveness = hasInput ? 5.5 : 2.8;
    this.exploreVelocity.lerp(desired, 1 - Math.exp(-delta * responsiveness));
    if (!hasInput && this.exploreVelocity.lengthSq() < 4) this.exploreVelocity.set(0, 0, 0);
    camera.position.addScaledVector(this.exploreVelocity, delta);

    const world = this.renderState.worldData;
    const halfW = world.width / 2;
    const halfD = world.depth / 2;
    if (camera.position.x > halfW) camera.position.x -= world.width;
    if (camera.position.x < -halfW) camera.position.x += world.width;
    if (camera.position.z > halfD) camera.position.z -= world.depth;
    if (camera.position.z < -halfD) camera.position.z += world.depth;

    const sampleH = this.renderState.terrain.sampleHeightAt;
    const EX_CLEAR = 55;
    let maxTerrainH = sampleH(camera.position.x, camera.position.z);
    const eDists = [50, 120, 220, 380];
    const eSides = [0, -60, 60];
    for (const ed of eDists) {
      for (const es of eSides) {
        const px = camera.position.x + forward.x * ed + right.x * es;
        const pz = camera.position.z + forward.z * ed + right.z * es;
        maxTerrainH = Math.max(maxTerrainH, sampleH(px, pz));
      }
    }
    maxTerrainH = Math.max(maxTerrainH, sampleH(
      camera.position.x + forward.x * 60, camera.position.z + forward.z * 60,
    ));

    const requiredY = maxTerrainH + EX_CLEAR;
    if (camera.position.y < requiredY) {
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, requiredY, Math.min(1, delta * 8));
      const hardFloor = sampleH(camera.position.x, camera.position.z) + 40;
      if (camera.position.y < hardFloor) camera.position.y = hardFloor;
    }
    camera.position.y = Math.min(camera.position.y, maxTerrainH + 1700);
    camera.rotation.set(this.explorePitch, this.exploreYaw, 0, 'YXZ');
    this.updateMinimap();
  }

  renderMinimap() {
    if (!this.mapSvg) return;
    const landmarks = mapLandmarks(this.renderState.geography);
    const world = this.renderState.worldData;
    const route = (this.journey.keyframes || []).map((frame) => mapPoint(frame.position, world)).join(' ');
    this.mapSvg.innerHTML = `
      <rect class="map-field" x="1" y="1" width="238" height="168" rx="12"></rect>
      <polyline class="map-route" points="${route}"></polyline>
      ${landmarks.map((landmark) => {
        const point = mapPoint(landmark.position, world);
        return `<g class="map-landmark map-${landmark.type}" transform="translate(${point.replace(' ', ',')})"><circle r="3.2"></circle><title>${escapeText(landmark.type)} / ${escapeText(landmark.id)}</title></g>`;
      }).join('')}
      <g class="map-player"><path d="M0 -8 L5 6 L0 3 L-5 6 Z"></path></g>`;
    this.mapPlayer = this.mapSvg.querySelector('.map-player');
    this.mapLandmarks = landmarks;
  }

  updateMinimap() {
    if (!this.mapPlayer) return;
    const camera = this.renderState.camera;
    const point = mapPoint(camera.position, this.renderState.worldData).split(' ').map(Number);
    this.mapPlayer.setAttribute('transform', `translate(${point[0]} ${point[1]}) rotate(${THREE.MathUtils.radToDeg(-this.exploreYaw)})`);
    const nearest = [...this.mapLandmarks].sort((a, b) => distance2d(a.position, camera.position) - distance2d(b.position, camera.position))[0];
    if (!nearest) return;
    const distance = Math.round(distance2d(nearest.position, camera.position));
    this.nearestLabel.textContent = `${nearest.type} / ${distance}m`;
  }

  mountArchive() {
    if (!this.archiveData) return;
    const sections = (this.archiveData.sections || ['overview', 'tracklist', 'package_contents'])
      .filter((section) => archiveSectionAvailable(this.archiveData, section));
    for (const section of sections) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = humanize(section);
      button.dataset.section = section;
      button.addEventListener('click', () => this.renderArchiveSection(section));
      this.archiveNav.appendChild(button);
    }
    this.renderArchiveSection(sections[0] || 'overview');
  }

  openArchive() {
    if (!this.archiveData) return;
    this.exploreKeys.clear();
    this.exploreVelocity?.set(0, 0, 0);
    this.archiveLayer.classList.add('is-visible');
    this.archiveLayer.setAttribute('aria-hidden', 'false');
  }

  closeArchive() {
    this.archiveLayer.classList.remove('is-visible');
    this.archiveLayer.setAttribute('aria-hidden', 'true');
  }

  renderArchiveSection(section) {
    for (const button of this.archiveNav.children) button.classList.toggle('is-active', button.dataset.section === section);
    this.archiveContent.replaceChildren(archiveSection(this.archiveData, section, (track) => this.renderArchiveTrack(track)));
  }

  renderArchiveTrack(track) {
    this.archiveContent.replaceChildren(archiveTrack(track, () => this.renderArchiveSection('tracklist')));
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

  updateUi(progress, seconds) {
    if (!this.ui) return;
    const lyricIndex = activeLyricIndex(this.lyrics, seconds);
    if (lyricIndex !== this.lastLyricIndex) this.showLyric(lyricIndex);
    this.progressFill.style.transform = `scaleX(${progress})`;
  }

  showLyric(index) {
    this.lastLyricIndex = index;
    this.lyricLabel.textContent = index >= 0 ? this.lyrics[index].text : '';
    this.lyricLabel.classList.toggle('is-empty', index < 0);
    this.lyricLabel.classList.remove('is-changing');
    void this.lyricLabel.offsetWidth;
    if (index >= 0) this.lyricLabel.classList.add('is-changing');
  }

  applyLyricStyle() {
    if (!this.ui) return;
    const art = this.config.artDirection || {};
    this.ui.style.setProperty('--tx-lyric-font', lyricFontStack(art.lyricFont));
    this.ui.style.setProperty('--tx-lyric-size', `${clampNumber(art.lyricSize, 14, 64, 28)}px`);
    this.ui.style.setProperty('--tx-lyric-color', validColor(art.lyricColor) ? art.lyricColor : '#f8f1d8');
    this.ui.style.setProperty('--tx-lyric-weight', String(clampNumber(art.lyricWeight, 300, 700, 400)));
    this.ui.style.setProperty('--tx-lyric-align', ['left', 'center', 'right'].includes(art.lyricAlign) ? art.lyricAlign : 'left');
    this.ui.style.setProperty('--tx-lyric-width', `${clampNumber(art.lyricWidth, 24, 76, 48)}vw`);
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

    if (this.exploreMode) {
      this.updateExplore(delta);
      this.renderState.setDirection({ exposure: 1, atmosphere: 0.92 });
    } else if (this.captureMode) {
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
      this.updateUi(progress, seconds);
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
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('message', this.onMessage);
    const canvas = this.renderState?.renderer?.domElement;
    canvas?.removeEventListener('pointerdown', this.onPointerDown);
    canvas?.removeEventListener('pointermove', this.onPointerMove);
    canvas?.removeEventListener('pointerup', this.onPointerUp);
    canvas?.removeEventListener('pointercancel', this.onPointerUp);
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

function activeLyricIndex(lyrics, seconds) {
  let active = -1;
  for (let index = 0; index < lyrics.length; index += 1) {
    if (Number(lyrics[index].at) > seconds) break;
    active = index;
  }
  return active;
}

function lyricFontStack(preset) {
  return ({
    editorial: 'Baskerville, "Palatino Linotype", serif',
    humanist: 'Avenir, "Gill Sans", "Trebuchet MS", sans-serif',
    mono: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
    display: 'Georgia, "Times New Roman", serif',
  })[preset] || 'Baskerville, "Palatino Linotype", serif';
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function validColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ''));
}

function recordingName(value) {
  return String(value || 'Noizes-Experience').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
}

function exploreKey(code) {
  return ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(code);
}

function axis(keys, negative, positive) {
  return Number(positive.some((key) => keys.has(key))) - Number(negative.some((key) => keys.has(key)));
}

function mapLandmarks(geography) {
  const groups = geography?.journeyLandmarks || {};
  return ['ranges', 'troughs', 'peaks', 'basins', 'passes']
    .flatMap((type) => (groups[type] || []).map((landmark) => ({ ...landmark, type: landmark.type || type.replace(/s$/, '') })));
}

function mapPoint(position, world) {
  const x = 12 + THREE.MathUtils.clamp(position.x / world.width + 0.5, 0, 1) * 216;
  const y = 12 + (1 - THREE.MathUtils.clamp(position.z / world.depth + 0.5, 0, 1)) * 146;
  return `${roundMap(x)} ${roundMap(y)}`;
}

function roundMap(value) {
  return Math.round(value * 10) / 10;
}

function distance2d(first, second) {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function isArchiveData(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.overview);
}

function archiveSectionAvailable(archive, section) {
  if (['artwork', 'booklet', 'images', 'video'].includes(section)) {
    const items = section === 'booklet'
      ? (archive.release_assets?.artwork || []).filter((asset) => asset.role === 'booklet_artwork')
      : archive.release_assets?.[section] || [];
    return items.length > 0;
  }
  if (section === 'notes' || section === 'games') return (archive[section] || []).length > 0;
  if (section === 'online_resources') return (archive.online_resources?.groups || []).length > 0;
  return true;
}

function archiveSection(archive, section, openTrack) {
  const root = document.createElement('div');
  if (section === 'overview') {
    const overview = archive.overview || {};
    root.append(archiveHeading(overview.title || 'Release archive', overview.description || 'The complete record carried by this package.'));
    const grid = element('div', 'txv2-archive-grid');
    for (const [label, value] of [
      ['Primary artist', overview.primary_artist],
      ['Format', humanize(overview.release_type || 'release')],
      ['Structure', `${overview.track_count || 0} tracks / ${overview.disc_count || 1} disc${overview.disc_count === 1 ? '' : 's'}`],
      ['Date', overview.release_date || overview.year],
      ['Label', overview.label || 'Independent'],
      ['Catalogue', overview.catalogue_number || 'Not supplied'],
    ]) grid.append(archiveCard(label, value || 'Not supplied'));
    root.append(grid);
    return root;
  }
  if (section === 'tracklist') {
    root.append(archiveHeading('Tracklist', 'Select a track to inspect its media, lyrics, credits, rights, and technical record.'));
    for (const track of archive.tracks || []) {
      const button = element('button', 'txv2-archive-track');
      button.type = 'button';
      button.append(
        element('span', 'txv2-archive-index', `${track.disc_number}.${String(track.track_number).padStart(2, '0')}`),
        element('span', 'txv2-archive-track-name', track.title || 'Untitled'),
        element('span', 'txv2-archive-track-artist', track.primary_artist || ''),
      );
      button.addEventListener('click', () => openTrack(track));
      root.append(button);
    }
    return root;
  }
  const assets = archiveAssets(archive, section);
  if (assets) {
    root.append(archiveHeading(humanize(section), 'Release material included inside this offline package.'));
    const grid = element('div', 'txv2-archive-grid');
    for (const asset of assets) grid.append(archiveCard(asset.title || asset.path || humanize(asset.role), [humanize(asset.role), asset.mime, formatBytes(asset.size)].filter(Boolean).join(' / '), asset.path));
    root.append(grid);
    return root;
  }
  if (section === 'notes') {
    root.append(archiveHeading('Notes', 'Documents and release notes affixed to this package.'));
    for (const note of archive.notes || []) root.append(archiveCard(note.title || 'Note', note.path || note.mime, note.path || note.src));
    return root;
  }
  if (section === 'online_resources') {
    root.append(archiveHeading('Online resources', 'These optional links require a network connection; the package does not.'));
    for (const group of archive.online_resources?.groups || []) {
      const block = element('section', 'txv2-archive-records');
      block.append(element('h3', '', group.label || 'Links'));
      for (const item of group.links || []) {
        const link = element('a', 'txv2-archive-link', item.label || item.url);
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        block.append(link);
      }
      root.append(block);
    }
    return root;
  }
  const value = section === 'package_contents' ? archive.package_contents : archive[section];
  root.append(archiveHeading(humanize(section), section === 'package_contents' ? 'Authoritative component inventory with checksums and byte sizes.' : 'Structured release documentation carried by this package.'));
  if (section === 'package_contents') {
    const grid = element('div', 'txv2-archive-grid');
    for (const component of value || []) grid.append(archiveCard(component.title || component.path, [humanize(component.role), component.mime, formatBytes(component.size)].filter(Boolean).join(' / '), component.path));
    root.append(grid);
  } else {
    const pre = element('pre', 'txv2-archive-json', JSON.stringify(value || {}, null, 2));
    root.append(pre);
  }
  return root;
}

function archiveTrack(track, back) {
  const root = document.createElement('div');
  const backButton = element('button', 'txv2-archive-back', 'Back to tracklist');
  backButton.type = 'button';
  backButton.addEventListener('click', back);
  root.append(backButton, archiveHeading(track.title || 'Untitled', [track.primary_artist, track.subtitle].filter(Boolean).join(' / ')));
  const grid = element('div', 'txv2-archive-grid');
  grid.append(
    archiveCard('Sequence', `Disc ${track.disc_number} / Track ${track.track_number}`),
    archiveCard('ISRC', track.isrc || 'Not supplied'),
    archiveCard('Lyrics', track.lyrics?.instrumental ? 'Instrumental' : track.lyrics?.plain_text || `${track.lyrics?.timed_lines?.length || 0} synchronized lines`),
    archiveCard('Audio records', `${1 + (track.audio_versions?.length || 0)} included`),
  );
  root.append(grid);
  const media = [
    track.primary_audio,
    ...(track.audio_versions || []).map((version) => version.component),
    ...(track.artwork || []),
    ...(track.images || []),
    ...(track.video || []),
    ...(track.documents || []),
  ].filter(Boolean).filter((asset, index, items) => items.findIndex((entry) => entry.path === asset.path) === index);
  if (media.length) {
    const mediaSection = element('section', 'txv2-archive-records');
    mediaSection.append(element('h3', '', 'Included media'));
    const mediaGrid = element('div', 'txv2-archive-grid');
    for (const asset of media) mediaGrid.append(archiveCard(asset.title || asset.path, [humanize(asset.role), asset.mime, formatBytes(asset.size)].filter(Boolean).join(' / '), asset.path));
    mediaSection.append(mediaGrid);
    root.append(mediaSection);
  }
  for (const [label, value] of [['Credits', track.credits], ['Rights', track.rights], ['Technical', track.technical]]) {
    const section = element('section', 'txv2-archive-records');
    section.append(element('h3', '', label), element('pre', 'txv2-archive-json', JSON.stringify(value || {}, null, 2)));
    root.append(section);
  }
  return root;
}

function archiveAssets(archive, section) {
  if (section === 'booklet') return (archive.release_assets?.artwork || []).filter((asset) => asset.role === 'booklet_artwork');
  if (['artwork', 'images', 'video'].includes(section)) return archive.release_assets?.[section] || [];
  return null;
}

function archiveHeading(title, copy) {
  const heading = element('header', 'txv2-archive-heading');
  heading.append(element('h3', '', title));
  if (copy) heading.append(element('p', '', copy));
  return heading;
}

function archiveCard(label, value, path = '') {
  const card = element('article', 'txv2-archive-card');
  card.append(element('span', '', label), element('strong', '', String(value ?? 'Not supplied')));
  if (path) {
    const link = element('a', 'txv2-archive-open', 'Open');
    link.href = path;
    link.target = '_blank';
    link.rel = 'noopener';
    card.append(link);
  }
  return card;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function humanize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
