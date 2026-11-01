/* 05-app  ── ExperienceDirector, threshold lifecycle, UI, frame loop ── */
(function () {
  'use strict';
  var JM = window.__JM;
  var scene    = JM.scene;
  var camera   = JM.camera;
  var renderer = JM.renderer;
  var edition  = JM.edition || {};
  var sequence = JM.sequence || {};

  var stage = document.getElementById('stage');

  /* ─── Lifecycle ─── */
  var mode = 'sealed'; // sealed → playing → ended

  function setMode(m) {
    mode = m;
    stage.setAttribute('data-mode', m);
  }

  /* ─── Threshold (enter) ─── */
  var thresholdBtn = document.getElementById('threshold-action');
  thresholdBtn.addEventListener('click', function () {
    if (mode !== 'sealed') return;
    JM.initCamera();
    JM.audioPlay();
    setMode('playing');
  });

  /* ─── Utility sheet ─── */
  var utilityBtn  = document.getElementById('utility');
  var sheet       = document.getElementById('sheet');
  var sheetClose  = document.getElementById('sheet-close');

  utilityBtn.addEventListener('click', function () {
    var open = sheet.hidden;
    sheet.hidden = !open;
    utilityBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  sheetClose.addEventListener('click', function () {
    sheet.hidden = true;
    utilityBtn.setAttribute('aria-expanded', 'false');
  });

  /* ─── Transport controls ─── */
  var transportBtn = document.getElementById('transport');
  transportBtn.addEventListener('click', function () {
    if (JM.audioClock.playing) {
      JM.audioPause();
      transportBtn.querySelector('b').textContent = 'Play';
      transportBtn.setAttribute('aria-label', 'Play the recording');
    } else {
      JM.audioPlay();
      transportBtn.querySelector('b').textContent = 'Pause';
      transportBtn.setAttribute('aria-label', 'Pause the recording');
    }
  });

  var seekInput   = document.getElementById('sheet-seek');
  var volumeInput = document.getElementById('volume');
  if (seekInput) {
    seekInput.addEventListener('input', function () {
      JM.audioSeek(parseFloat(seekInput.value));
    });
  }
  if (volumeInput) {
    volumeInput.addEventListener('input', function () {
      JM.audioSetVolume(parseFloat(volumeInput.value));
    });
  }

  /* ─── Quality controls ─── */
  var qualityBtns = stage.querySelectorAll('[data-quality-option]');
  qualityBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      qualityBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      stage.setAttribute('data-quality', btn.dataset.qualityOption);
    });
  });

  /* ─── Motion / HUD toggles ─── */
  var motionToggle = document.getElementById('motion-toggle');
  if (motionToggle) {
    motionToggle.addEventListener('click', function () {
      var on = motionToggle.getAttribute('aria-pressed') === 'false';
      motionToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      motionToggle.querySelector('b').textContent = on ? 'Reduced' : 'Full';
    });
  }
  var hudToggle = document.getElementById('hud-toggle');
  if (hudToggle) {
    hudToggle.addEventListener('click', function () {
      var hud = document.getElementById('hud');
      var on = hudToggle.getAttribute('aria-pressed') === 'true';
      hudToggle.setAttribute('aria-pressed', on ? 'false' : 'true');
      hudToggle.querySelector('b').textContent = on ? 'Off' : 'On';
      hud.setAttribute('data-visible', on ? 'false' : 'true');
    });
  }

  /* ─── Keyboard ─── */
  document.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (mode === 'playing') transportBtn.click();
    }
    if (e.key === 'Escape') {
      sheet.hidden = true;
      utilityBtn.setAttribute('aria-expanded', 'false');
    }
  });

  /* ─── Timecode display ─── */
  function formatTime(s) {
    var total = Math.max(0, Math.floor(s || 0));
    return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
  }

  var hudElapsed = document.getElementById('hud-elapsed');
  var sheetElapsed = document.getElementById('elapsed');
  var timelineHead = document.getElementById('timeline-head');

  /* ─── Audio end detection ─── */
  var audioEl = document.getElementById('audio');
  if (audioEl) {
    audioEl.addEventListener('ended', function () {
      setMode('ended');
      var residue = document.getElementById('residue');
      if (residue) {
        residue.hidden = false;
        var hashEl = document.getElementById('residue-hash');
        if (hashEl && edition.hash) hashEl.textContent = edition.hash.slice(0, 16);
      }
    });
  }

  /* ─── Replay ─── */
  var replayBtn = document.getElementById('replay');
  if (replayBtn) {
    replayBtn.addEventListener('click', function () {
      var residue = document.getElementById('residue');
      if (residue) residue.hidden = true;
      JM.audioSeek(0);
      JM.audioPlay();
      JM.initCamera();
      setMode('playing');
    });
  }

  /* ─── Colophon ─── */
  var colophonEl = document.getElementById('colophon-text');
  if (colophonEl && edition) {
    var parts = [];
    if (edition.editionLabel) parts.push(edition.editionLabel);
    if (edition.template) parts.push('Template: ' + edition.template);
    colophonEl.textContent = parts.join(' · ') || 'Journey experience';
  }

  /* ─── Frame loop ─── */
  var clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    var time = clock.getElapsedTime();

    if (mode === 'playing') {
      JM.audioUpdate();
      var progress = JM.audioClock.progress;

      JM.updateCamera(progress);

      // HUD updates
      if (hudElapsed) hudElapsed.textContent = formatTime(JM.audioClock.currentTime);
      if (sheetElapsed) sheetElapsed.textContent = formatTime(JM.audioClock.currentTime) + ' / ' + formatTime(JM.audioClock.duration);
      if (timelineHead) timelineHead.style.left = (progress * 100) + '%';
      if (seekInput) seekInput.value = JM.audioClock.currentTime;
    }

    // Sky follows camera
    JM.skyMesh.position.copy(camera.position);

    // Shader time uniforms
    JM.roadMat.uniforms.uTime.value = time;
    JM.atmoMat.uniforms.uTime.value = time;
    JM.markerGroups.forEach(function (mg) { mg.mat.uniforms.uTime.value = time; });

    renderer.render(scene, camera);
  }
  animate();
})();
