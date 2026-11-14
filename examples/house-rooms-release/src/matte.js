/* The House That Remembered Us — rendition projection (proof on the entrance).
   A finished image is projected from the spot where you stand onto simple
   stand-in geometry (forecourt, steps, porch, facade). Standing still you see
   the image exactly; walking in, the surfaces slide against each other so it has
   depth, and it dissolves into the live house before the door.
   o = { pos, look, vfov, aspect, planes } with planes in world metres. */
function createMatte(scene, src, o) {
  const cam = new THREE.PerspectiveCamera(o.vfov, o.aspect, 0.1, 500);
  cam.position.set(o.pos[0], o.pos[1], o.pos[2]); cam.lookAt(o.look[0], o.look[1], o.look[2]); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const uniforms = { tMap: { value: null }, uVP: { value: vp }, uOpacity: { value: 0 }, uGain: { value: o.gain || 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthTest: false, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform sampler2D tMap; uniform mat4 uVP; uniform float uOpacity, uGain;
      void main(){
        vec4 c = uVP * vec4(vW, 1.0); if (c.w <= 0.0) discard;
        vec2 uv = c.xy / c.w * 0.5 + 0.5;
        float below = max(0.0, -uv.y); uv.y = abs(uv.y);                       // past the bottom edge the wet ground mirrors itself
        float a = smoothstep(0.0, 0.03, uv.x) * smoothstep(1.0, 0.97, uv.x) * smoothstep(1.0, 0.93, uv.y) * smoothstep(0.75, 0.15, below);
        vec3 col = texture2D(tMap, clamp(uv, 0.0, 1.0)).rgb * uGain * (1.0 - 0.5 * smoothstep(0.0, 0.4, below));
        gl_FragColor = vec4(col, a * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  // quads listed far to near; each is four corners [x,y,z] and they are drawn in that order
  o.planes.forEach((q, i) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([].concat(q[0], q[1], q[2], q[0], q[2], q[3])), 3));
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 5 + i; group.add(m);
  });
  const M = { ready: false, opacity: 0, set(v) { v = M.ready ? v : 0; M.opacity = v; uniforms.uOpacity.value = v; group.visible = v > 0.002; } };
  const img = new Image();
  img.onload = () => { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.needsUpdate = true; uniforms.tMap.value = t; M.ready = true; };
  img.src = src;
  return M;
}
