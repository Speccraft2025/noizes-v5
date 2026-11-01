/* 03-audio  ── Web Audio playback, clock, energy→road mapping ── */
(function () {
  'use strict';
  var JM = window.__JM;

  var audioEl   = document.getElementById('audio');
  var analysis  = JM.analysis || {};
  var duration  = analysis.duration || 0;

  /* ─── Audio clock ─── */
  var audioClock = {
    playing: false,
    currentTime: 0,
    duration: duration,
    progress: 0,
  };

  function updateClock() {
    if (!audioEl) return;
    audioClock.currentTime = audioEl.currentTime || 0;
    audioClock.duration    = audioEl.duration || duration || 1;
    audioClock.progress    = JM.clamp(audioClock.currentTime / audioClock.duration, 0, 1);
  }

  function play() {
    if (!audioEl) return;
    var p = audioEl.play();
    if (p && p.catch) p.catch(function () {});
    audioClock.playing = true;
  }

  function pause() {
    if (!audioEl) return;
    audioEl.pause();
    audioClock.playing = false;
  }

  function seek(t) {
    if (!audioEl) return;
    audioEl.currentTime = JM.clamp(t, 0, audioEl.duration || duration);
    updateClock();
  }

  function setVolume(v) {
    if (!audioEl) return;
    audioEl.volume = JM.clamp(v, 0, 1);
  }

  /* ─── Energy mapping (analysis energy bands → road characteristics) ─── */
  var energyBands = (analysis.energy && analysis.energy.bands) || [];

  function getEnergy(progress) {
    if (!energyBands.length) return 0.5;
    var idx = Math.floor(progress * energyBands.length);
    idx = JM.clamp(idx, 0, energyBands.length - 1);
    return energyBands[idx] || 0.5;
  }

  /* ─── Expose ─── */
  JM.audioClock = audioClock;
  JM.audioPlay  = play;
  JM.audioPause = pause;
  JM.audioSeek  = seek;
  JM.audioSetVolume = setVolume;
  JM.audioUpdate    = updateClock;
  JM.getEnergy      = getEnergy;
})();
