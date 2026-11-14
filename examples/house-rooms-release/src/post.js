/* The House That Remembered Us — the finish.
   The scene is drawn into a floating-point buffer, lamps bleed into a soft glow
   (a small down/up-sampled bloom chain), and one last pass does the film work:
   tone mapping, a restrained colour grade, vignette and fine grain.
   Returns null when the device cannot draw to float buffers; the app then renders directly. */
function createPost(renderer, opts = {}) {
  const ext = renderer.extensions;
  if (!(ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'))) return null;
  const LEVELS = 5, cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), scn = new THREE.Scene();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const tri = new THREE.Mesh(geo, null); tri.frustumCulled = false; scn.add(tri);
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const mat = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
  const rt = (samples, depth) => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: depth, samples, generateMipmaps: false });

  const sceneRT = rt(opts.samples == null ? 4 : opts.samples, true), down = [], up = [];
  for (let i = 0; i < LEVELS; i++) { down.push(rt(0, false)); if (i < LEVELS - 1) up.push(rt(0, false)); }

  const pre = mat(`varying vec2 vUv; uniform sampler2D tMap; uniform vec2 uPx; uniform float uThr;
    void main(){
      vec3 c = (texture2D(tMap, vUv + uPx * vec2(-1., -1.)).rgb + texture2D(tMap, vUv + uPx * vec2(1., -1.)).rgb + texture2D(tMap, vUv + uPx * vec2(-1., 1.)).rgb + texture2D(tMap, vUv + uPx * vec2(1., 1.)).rgb) * 0.25;
      c = min(max(c, vec3(0.)), vec3(18.));
      float br = max(c.r, max(c.g, c.b)), knee = uThr * 0.6, soft = clamp(br - uThr + knee, 0., 2. * knee); soft = soft * soft / (4. * knee + 1e-4);
      gl_FragColor = vec4(c * max(soft, br - uThr) / max(br, 1e-4), 1.);
    }`, { tMap: { value: null }, uPx: { value: new THREE.Vector2() }, uThr: { value: 0.9 } });
  const dn = mat(`varying vec2 vUv; uniform sampler2D tMap; uniform vec2 uPx;
    void main(){
      vec3 c = texture2D(tMap, vUv).rgb * 0.5;
      c += (texture2D(tMap, vUv + uPx * vec2(-1., -1.)).rgb + texture2D(tMap, vUv + uPx * vec2(1., -1.)).rgb + texture2D(tMap, vUv + uPx * vec2(-1., 1.)).rgb + texture2D(tMap, vUv + uPx * vec2(1., 1.)).rgb) * 0.125;
      gl_FragColor = vec4(c, 1.);
    }`, { tMap: { value: null }, uPx: { value: new THREE.Vector2() } });
  const upm = mat(`varying vec2 vUv; uniform sampler2D tMap; uniform sampler2D tAdd; uniform vec2 uPx;
    void main(){
      vec3 c = texture2D(tMap, vUv).rgb * 4.;
      c += (texture2D(tMap, vUv + uPx * vec2(-1., 0.)).rgb + texture2D(tMap, vUv + uPx * vec2(1., 0.)).rgb + texture2D(tMap, vUv + uPx * vec2(0., -1.)).rgb + texture2D(tMap, vUv + uPx * vec2(0., 1.)).rgb) * 2.;
      c += texture2D(tMap, vUv + uPx * vec2(-1., -1.)).rgb + texture2D(tMap, vUv + uPx * vec2(1., -1.)).rgb + texture2D(tMap, vUv + uPx * vec2(-1., 1.)).rgb + texture2D(tMap, vUv + uPx * vec2(1., 1.)).rgb;
      gl_FragColor = vec4(c / 16. + texture2D(tAdd, vUv).rgb, 1.);
    }`, { tMap: { value: null }, tAdd: { value: null }, uPx: { value: new THREE.Vector2() } });
  const out = mat(`varying vec2 vUv; uniform sampler2D tScene; uniform sampler2D tBloom; uniform vec2 uRes; uniform float uTime, uBloom, uExposure, uGrain, uVignette;
    vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 aces(vec3 c){
      const mat3 IN = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
      const mat3 OUT = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
      return clamp(OUT * fit(IN * (c / 0.6)), 0., 1.);
    }
    float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    void main(){
      vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;
      c = aces(c * uExposure);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 0.9);                                              // a touch less saturation
      c += (1. - l) * (1. - l) * vec3(-0.003, 0.001, 0.007);                  // cool the shadows
      c *= mix(vec3(1.), vec3(1.05, 1.0, 0.93), smoothstep(0.15, 0.9, l));    // warm the highlights
      c = pow(max(c, 0.), vec3(1. / 2.2));                                    // display curve
      c = mix(c, c * c * (3. - 2. * c), 0.22);                                // gentle contrast
      vec2 d = (vUv - 0.5) * vec2(1.0, 1.0); float v = smoothstep(0.38, 0.98, length(d) * 1.35);
      c *= 1. - uVignette * v;
      float n = hash(floor(vUv * uRes) + floor(uTime * 24.) * 17.) - 0.5;
      c += n * uGrain * (1. - 0.6 * l);
      gl_FragColor = vec4(c, 1.);
    }`, { tScene: { value: null }, tBloom: { value: null }, uRes: { value: new THREE.Vector2() }, uTime: { value: 0 }, uBloom: { value: opts.bloom == null ? 0.1 : opts.bloom }, uExposure: { value: opts.exposure || 1.5 }, uGrain: { value: 0.032 }, uVignette: { value: 0.42 } });

  let W = 4, H = 4;
  function pass(material, target) { tri.material = material; renderer.setRenderTarget(target); renderer.render(scn, cam); }
  return {
    uniforms: out.uniforms,
    setSize(w, h) {
      W = Math.max(4, Math.round(w)); H = Math.max(4, Math.round(h)); sceneRT.setSize(W, H);
      for (let i = 0; i < LEVELS; i++) { const s = 2 << i, tw = Math.max(2, Math.round(W / s)), th = Math.max(2, Math.round(H / s)); down[i].setSize(tw, th); if (up[i]) up[i].setSize(tw, th); }
      out.uniforms.uRes.value.set(W, H);
    },
    render(scene, camera, time, still) {
      renderer.setRenderTarget(sceneRT); renderer.render(scene, camera);
      pre.uniforms.tMap.value = sceneRT.texture; pre.uniforms.uPx.value.set(0.5 / W, 0.5 / H); pass(pre, down[0]);
      for (let i = 1; i < LEVELS; i++) { dn.uniforms.tMap.value = down[i - 1].texture; dn.uniforms.uPx.value.set(1 / down[i - 1].width, 1 / down[i - 1].height); pass(dn, down[i]); }
      let low = down[LEVELS - 1];
      for (let i = LEVELS - 2; i >= 0; i--) { upm.uniforms.tMap.value = low.texture; upm.uniforms.tAdd.value = down[i].texture; upm.uniforms.uPx.value.set(1 / low.width, 1 / low.height); pass(upm, up[i]); low = up[i]; }
      out.uniforms.tScene.value = sceneRT.texture; out.uniforms.tBloom.value = low.texture; out.uniforms.uTime.value = still ? 0 : time;
      pass(out, null);
    },
    dispose() { sceneRT.dispose(); down.forEach((t) => t.dispose()); up.forEach((t) => t.dispose()); },
  };
}
