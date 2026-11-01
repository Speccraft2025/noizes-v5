/* 04-camera  ── CatmullRom path follower, audio-synced ── */
(function () {
  'use strict';
  var JM = window.__JM;
  var C = JM.C;
  var camera    = JM.camera;
  var mainTrail = JM.mainTrail;

  /* ─── Camera state ─── */
  var camPos    = new THREE.Vector3();
  var camLookAt = new THREE.Vector3();
  var targetPos = new THREE.Vector3();
  var targetLook = new THREE.Vector3();

  function getRoadCameraPos(t) {
    var pt  = mainTrail.getPoint(t);
    var tan = mainTrail.getTangent(t);
    var side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    return new THREE.Vector3(
      pt.x + side.x * C.sideOffset + tan.x * C.forwardOffset,
      pt.y + C.cameraHeight,
      pt.z + side.z * C.sideOffset + tan.z * C.forwardOffset
    );
  }

  function updateCamera(progress, dt) {
    var t = JM.clamp(progress, 0, 0.999);
    targetPos.copy(getRoadCameraPos(t));
    targetLook.copy(mainTrail.getPoint(Math.min(1, t + C.lookAhead)));

    var speed = 0.04;
    camPos.lerp(targetPos, speed);
    camLookAt.lerp(targetLook, speed);

    camera.position.copy(camPos);
    camera.lookAt(camLookAt);
  }

  function initCamera() {
    var startPos = getRoadCameraPos(0);
    camPos.copy(startPos);
    camLookAt.copy(mainTrail.getPoint(C.lookAhead));
    targetPos.copy(startPos);
    targetLook.copy(camLookAt);
    camera.position.copy(camPos);
    camera.lookAt(camLookAt);
  }

  /* ─── Expose ─── */
  JM.initCamera   = initCamera;
  JM.updateCamera  = updateCamera;
  JM.getRoadCameraPos = getRoadCameraPos;
})();
