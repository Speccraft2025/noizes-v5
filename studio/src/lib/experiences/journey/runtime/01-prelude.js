/* 01-prelude  ── config reader, math, Three.js scene init ── */
(function () {
  'use strict';

  /* ─── Payloads ─── */
  function json(id) {
    var el = document.getElementById(id);
    return el ? JSON.parse(el.textContent) : null;
  }
  var analysis = json('analysis-payload');
  var edition  = json('edition-payload');
  var config   = json('config-payload');
  var sequence = json('sequence-payload');

  /* ─── Config defaults ─── */
  var C = Object.assign({
    roadParticleCount: 20000,
    atmoParticleCount: 3000,
    markerParticleCount: 800,
    pathRadius: 100,
    circleSpacing: 200,
    pointsPerCircle: 100,
    yRange: 26,
    interpolatedPoints: 2000,
    fogDensity: 0.0025,
    cameraFov: 60,
    cameraNear: 0.1,
    cameraFar: 2000,
    sideOffset: 4,
    forwardOffset: 5,
    cameraHeight: 2.5,
    lookAhead: 0.05,
    skyRadius: 900,
    topColor: [0.64, 0.68, 0.88],
    midColor: [0.72, 0.76, 0.92],
    bottomColor: [0.88, 0.90, 0.96],
    groundColor: [0.92, 0.93, 0.96],
    roadColor: [0.18, 0.18, 0.22],
    markerColor: [0.58, 0.65, 0.95],
  }, config && config.artDirection || {});

  /* ─── Math ─── */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ─── Renderer ─── */
  var canvas = document.getElementById('world');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x0c0c12, 1);

  /* ─── Scene + Camera ─── */
  var scene  = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(C.cameraFov, window.innerWidth / window.innerHeight, C.cameraNear, C.cameraFar);

  /* ─── Resize ─── */
  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ─── Expose to later modules ─── */
  window.__JM = {
    analysis: analysis, edition: edition, config: config, sequence: sequence,
    C: C, lerp: lerp, clamp: clamp,
    renderer: renderer, scene: scene, camera: camera,
  };
})();
