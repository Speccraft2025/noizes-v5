/* 02-world  ── road path, particles, sky dome, atmosphere, markers ── */
(function () {
  'use strict';
  var JM = window.__JM;
  var C = JM.C;
  var scene = JM.scene;
  var renderer = JM.renderer;

  /* ─── Road path (CatmullRom figure-8 with 3 circles) ─── */
  var centers = [
    new THREE.Vector3(-C.circleSpacing, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(C.circleSpacing, 0, 0),
  ];
  var rawPoints = [];
  centers.forEach(function (center) {
    for (var i = 0; i < C.pointsPerCircle; i++) {
      var a = (i / C.pointsPerCircle) * Math.PI * 2;
      var x = center.x + Math.cos(a) * C.pathRadius;
      var z = center.z + Math.sin(a) * C.pathRadius;
      var y = Math.sin(a * 2 + center.x * 0.01) * C.yRange;
      rawPoints.push(new THREE.Vector3(x, y, z));
    }
  });
  var mainTrail = new THREE.CatmullRomCurve3(rawPoints, true, 'catmullrom', 0.5);
  mainTrail.arcLengthDivisions = C.interpolatedPoints;

  /* ─── Sky dome ─── */
  var skyGeo = new THREE.SphereGeometry(C.skyRadius, 32, 32);
  var skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor:    { value: new THREE.Vector3(C.topColor[0], C.topColor[1], C.topColor[2]) },
      midColor:    { value: new THREE.Vector3(C.midColor[0], C.midColor[1], C.midColor[2]) },
      bottomColor: { value: new THREE.Vector3(C.bottomColor[0], C.bottomColor[1], C.bottomColor[2]) },
      groundColor: { value: new THREE.Vector3(C.groundColor[0], C.groundColor[1], C.groundColor[2]) },
    },
    vertexShader: [
      'varying vec3 vWorldPosition;',
      'void main(){',
      '  vec4 wp = modelMatrix * vec4(position, 1.0);',
      '  vWorldPosition = wp.xyz;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 topColor;',
      'uniform vec3 midColor;',
      'uniform vec3 bottomColor;',
      'uniform vec3 groundColor;',
      'varying vec3 vWorldPosition;',
      'void main(){',
      '  float h = normalize(vWorldPosition).y;',
      '  vec3 col;',
      '  if(h > 0.3) col = mix(midColor, topColor, (h - 0.3) / 0.7);',
      '  else if(h > 0.0) col = mix(bottomColor, midColor, h / 0.3);',
      '  else col = mix(groundColor, bottomColor, (h + 1.0));',
      '  gl_FragColor = vec4(col, 1.0);',
      '}',
    ].join('\n'),
    depthWrite: false,
  });
  var skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);

  /* ─── Fog ─── */
  scene.fog = new THREE.FogExp2(0xb8bcde, C.fogDensity);

  /* ─── Road particles ─── */
  var roadGeo = new THREE.BufferGeometry();
  var rPos  = new Float32Array(C.roadParticleCount * 3);
  var rSize = new Float32Array(C.roadParticleCount);
  var rScH  = new Float32Array(C.roadParticleCount);

  for (var i = 0; i < C.roadParticleCount; i++) {
    var t = Math.random();
    var pt = mainTrail.getPoint(t);
    var tan = mainTrail.getTangent(t);
    var side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    var lane = (Math.random() - 0.5) * 60;
    rPos[i * 3]     = pt.x + side.x * lane + tan.x * (Math.random() - 0.5) * 4;
    rPos[i * 3 + 1] = pt.y - 0.5 + Math.random() * 0.15;
    rPos[i * 3 + 2] = pt.z + side.z * lane + tan.z * (Math.random() - 0.5) * 4;
    rSize[i] = Math.random() * 2.0 + 0.8;
    rScH[i]  = 0.4 + Math.random() * 0.6;
  }
  roadGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
  roadGeo.setAttribute('aSize',    new THREE.BufferAttribute(rSize, 1));
  roadGeo.setAttribute('aScaleH',  new THREE.BufferAttribute(rScH, 1));

  var roadMat = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: renderer.getPixelRatio() },
      uTime: { value: 0 },
    },
    vertexShader: [
      'attribute float aSize;',
      'attribute float aScaleH;',
      'varying float vScaleH;',
      'varying float vDist;',
      'uniform float uPixelRatio;',
      'uniform float uTime;',
      'void main(){',
      '  vScaleH = aScaleH;',
      '  vec3 pos = position;',
      '  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);',
      '  float dist = -mvPos.z;',
      '  vDist = dist;',
      '  gl_PointSize = min(aSize * uPixelRatio * (150.0 / dist), 28.0);',
      '  gl_Position = projectionMatrix * mvPos;',
      '}',
    ].join('\n'),
    fragmentShader: [
      'varying float vScaleH;',
      'varying float vDist;',
      'void main(){',
      '  vec2 uv = gl_PointCoord - 0.5;',
      '  uv.y /= vScaleH;',
      '  float d = length(uv);',
      '  if(d > 0.5) discard;',
      '  float a = 1.0 - smoothstep(0.0, 0.45, d);',
      '  float fogFade = smoothstep(400.0, 50.0, vDist);',
      '  gl_FragColor = vec4(vec3(' + C.roadColor[0].toFixed(2) + ',' + C.roadColor[1].toFixed(2) + ',' + C.roadColor[2].toFixed(2) + '), a * 0.85 * fogFade);',
      '}',
    ].join('\n'),
    transparent: true,
    depthWrite: false,
  });
  var roadMesh = new THREE.Points(roadGeo, roadMat);
  scene.add(roadMesh);

  /* ─── 3D markers (particle shapes placed along path from analysis sections) ─── */
  var sections = (JM.analysis && JM.analysis.sections) || [];
  if (!sections.length) sections = [{ start: 0.2 }, { start: 0.5 }, { start: 0.8 }];
  var shapes = ['rect', 'cylinder', 'sphere'];
  var markerGroups = [];
  var MC = C.markerColor;

  function fillRect(pos, sizes, center, count, w, h, d) {
    for (var i = 0; i < count; i++) {
      pos[i * 3]     = center.x + (Math.random() - 0.5) * w;
      pos[i * 3 + 1] = center.y + Math.random() * h;
      pos[i * 3 + 2] = center.z + (Math.random() - 0.5) * d;
      var onSurface = Math.random() < 0.7;
      if (onSurface) {
        var face = Math.floor(Math.random() * 6);
        if (face < 2) pos[i * 3] = center.x + (face === 0 ? -w / 2 : w / 2);
        else if (face < 4) pos[i * 3 + 1] = center.y + (face === 2 ? 0 : h);
        else pos[i * 3 + 2] = center.z + (face === 4 ? -d / 2 : d / 2);
      }
      sizes[i] = Math.random() * 1.5 + 0.5;
    }
  }
  function fillCylinder(pos, sizes, center, count, radius, height) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var r = radius * (0.85 + Math.random() * 0.3);
      pos[i * 3]     = center.x + Math.cos(a) * r;
      pos[i * 3 + 1] = center.y + Math.random() * height;
      pos[i * 3 + 2] = center.z + Math.sin(a) * r;
      sizes[i] = Math.random() * 1.5 + 0.5;
    }
  }
  function fillSphere(pos, sizes, center, count, radius) {
    for (var i = 0; i < count; i++) {
      var th = Math.random() * Math.PI * 2;
      var ph = Math.acos(2 * Math.random() - 1);
      var r = radius * (0.8 + Math.random() * 0.4);
      pos[i * 3]     = center.x + r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = center.y + r * Math.sin(ph) * Math.sin(th) + radius;
      pos[i * 3 + 2] = center.z + r * Math.cos(ph);
      sizes[i] = Math.random() * 1.5 + 0.5;
    }
  }

  sections.forEach(function (sec, idx) {
    var t = sec.start != null ? sec.start : idx / Math.max(sections.length, 1);
    var center = mainTrail.getPoint(t);
    var tangent = mainTrail.getTangent(t);
    var sideDir = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    var shapeCenter = new THREE.Vector3(
      center.x + sideDir.x * 15,
      center.y,
      center.z + sideDir.z * 15
    );
    var shape = shapes[idx % shapes.length];
    var count = C.markerParticleCount;
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    var sizes = new Float32Array(count);

    if (shape === 'rect') fillRect(pos, sizes, shapeCenter, count, 18, 12, 2);
    else if (shape === 'cylinder') fillCylinder(pos, sizes, shapeCenter, count, 4, 20);
    else fillSphere(pos, sizes, shapeCenter, count, 6);

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: renderer.getPixelRatio() },
        uTime:  { value: 0 },
        uColor: { value: new THREE.Vector3(MC[0], MC[1], MC[2]) },
      },
      vertexShader: [
        'attribute float aSize;',
        'varying float vAlpha;',
        'varying float vDist;',
        'uniform float uPixelRatio;',
        'uniform float uTime;',
        'void main(){',
        '  vec3 pos = position;',
        '  pos += sin(uTime * 0.8 + position.y * 0.3) * 0.15;',
        '  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);',
        '  float dist = -mvPos.z;',
        '  vDist = dist;',
        '  gl_PointSize = aSize * uPixelRatio * (100.0 / dist);',
        '  gl_Position = projectionMatrix * mvPos;',
        '  vAlpha = smoothstep(500.0, 30.0, dist);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'varying float vAlpha;',
        'varying float vDist;',
        'void main(){',
        '  float d = length(gl_PointCoord - 0.5);',
        '  if(d > 0.5) discard;',
        '  float a = 1.0 - smoothstep(0.0, 0.5, d);',
        '  gl_FragColor = vec4(uColor, a * vAlpha * 0.7);',
        '}',
      ].join('\n'),
      transparent: true,
      depthWrite: false,
    });
    var mesh = new THREE.Points(geo, mat);
    scene.add(mesh);
    markerGroups.push({ mesh: mesh, center: center, t: t, mat: mat });
  });

  /* ─── Atmospheric particles ─── */
  var atmoGeo = new THREE.BufferGeometry();
  var aPos   = new Float32Array(C.atmoParticleCount * 3);
  var aSize  = new Float32Array(C.atmoParticleCount);
  var aSpeed = new Float32Array(C.atmoParticleCount);
  for (var j = 0; j < C.atmoParticleCount; j++) {
    aPos[j * 3]     = (Math.random() - 0.5) * 600;
    aPos[j * 3 + 1] = Math.random() * 40 - 5;
    aPos[j * 3 + 2] = (Math.random() - 0.5) * 400;
    aSize[j]  = Math.random() * 1.8 + 0.3;
    aSpeed[j] = Math.random() * 2 + 0.5;
  }
  atmoGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3));
  atmoGeo.setAttribute('aSize',    new THREE.BufferAttribute(aSize, 1));
  atmoGeo.setAttribute('aSpeed',   new THREE.BufferAttribute(aSpeed, 1));

  var atmoMat = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: renderer.getPixelRatio() },
      uTime: { value: 0 },
    },
    vertexShader: [
      'attribute float aSize;',
      'attribute float aSpeed;',
      'varying float vAlpha;',
      'uniform float uPixelRatio;',
      'uniform float uTime;',
      'void main(){',
      '  vec3 pos = position;',
      '  pos.x += sin(uTime * aSpeed * 0.3 + position.z * 0.01) * 2.0;',
      '  pos.y += cos(uTime * aSpeed * 0.2 + position.x * 0.02) * 1.5;',
      '  pos.z += sin(uTime * aSpeed * 0.15) * 1.0;',
      '  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);',
      '  gl_PointSize = aSize * uPixelRatio * (80.0 / (-mvPos.z));',
      '  gl_Position = projectionMatrix * mvPos;',
      '  vAlpha = smoothstep(400.0, 20.0, -mvPos.z) * 0.3;',
      '}',
    ].join('\n'),
    fragmentShader: [
      'varying float vAlpha;',
      'void main(){',
      '  float d = length(gl_PointCoord - 0.5);',
      '  if(d > 0.5) discard;',
      '  float a = 1.0 - smoothstep(0.0, 0.5, d);',
      '  gl_FragColor = vec4(vec3(0.5), a * vAlpha);',
      '}',
    ].join('\n'),
    transparent: true,
    depthWrite: false,
  });
  var atmoMesh = new THREE.Points(atmoGeo, atmoMat);
  scene.add(atmoMesh);

  /* ─── Expose ─── */
  JM.mainTrail    = mainTrail;
  JM.skyMesh      = skyMesh;
  JM.roadMat      = roadMat;
  JM.atmoMat      = atmoMat;
  JM.markerGroups = markerGroups;
})();
