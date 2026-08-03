import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replaceAll('%20', ' ');
const pkg = join(root, 'build', 'The-House-That-Remembered-Us-Transcendence');
const nz = join(root, 'dist', 'The-House-That-Remembered-Us-Transcendence.nz');

const readJson = async path => JSON.parse(await readFile(join(pkg, path), 'utf8'));
const html = await readFile(join(pkg, 'experience.html'), 'utf8');
const runtimeStart = html.indexOf('/* ==== 01-prelude.js ==== */');
const runtime = html.slice(runtimeStart, html.indexOf('</script>', runtimeStart));
const manifest = await readJson('manifest.json');
const analysis = await readJson('analysis/track-01.analysis.json');

/* ----------------------------------------------------------------- packaging */

test('the edition validates against its own contract', () => {
  assert.match(
    execFileSync('node', [join(root, 'scripts', 'validate-transcendence.mjs')], { encoding: 'utf8' }),
    /^VALID TRANSCENDENCE/,
  );
});

test('the archive is intact', () => {
  assert.doesNotThrow(() => execFileSync('unzip', ['-tq', nz], { stdio: 'pipe' }));
});

test('building the edition does not mutate the other editions', async () => {
  // Any prior edition present in the tree must still validate with its own
  // validator after a Transcendence build. This is the regression that protects
  // existing work. Editions that are not in this checkout are skipped rather
  // than failed, so the suite stays green in a tree that carries only some of
  // them.
  const editions = [
    ['scripts/validate.mjs', /VALID/],
    ['scripts/validate-masterpiece.mjs', /VALID MASTERPIECE SLICE/],
  ];
  let checked = 0;
  for (const [script, expected] of editions) {
    const path = join(root, script);
    try {
      await stat(path);
    } catch {
      continue;                       // that edition is not in this checkout
    }
    assert.match(execFileSync('node', [path], { encoding: 'utf8' }), expected, script);
    checked++;
  }
  assert.ok(checked > 0, 'no sibling edition validator was found to regression-check against');
});

test('every manifest component exists and matches its size and hash', async () => {
  for (const component of manifest.components) {
    const bytes = await readFile(join(pkg, component.path));
    assert.equal(bytes.length, component.size, component.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), component.sha256, component.path);
  }
});

test('every audio and generated asset is covered by the rights ledger', async () => {
  const ledger = await readJson('metadata/asset-rights-ledger.json');
  const covered = new Set(ledger.map(e => e.local_path));
  for (const component of manifest.components) {
    if (/^(audio|assets\/images|analysis)\//.test(component.path)) {
      assert.ok(covered.has(component.path), `unledgered ${component.path}`);
    }
  }
  for (const entry of ledger) {
    assert.ok(entry.sha256 && entry.verification_evidence, `incomplete record ${entry.asset_id}`);
  }
});

test('the build is honest about being unsigned', async () => {
  const authenticity = await readJson('authenticity.json');
  assert.equal(authenticity.signed, false);
  assert.equal(authenticity.development_signature.status, 'placeholder');
  assert.equal(authenticity.source_recording.sha256, analysis.source.sha256);
});

/* -------------------------------------------------------------------- offline */

test('the experience is offline and contains no external URL', () => {
  assert.ok(!/<(script|link|img|audio|source|video)\b[^>]*\b(src|href)\s*=\s*["']\s*(https?:)?\/\//i.test(html));
  assert.match(html, /connect-src 'none'/);
});

test('the edition runtime makes no network call and opens no microphone', () => {
  for (const api of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'new WebSocket', 'EventSource', 'getUserMedia', 'createAnalyser']) {
    assert.ok(!runtime.includes(api), api);
  }
});

test('the local Three.js bundle exposes its core namespace with no ESM markers left', () => {
  assert.ok(html.includes('window.THREE=Object.assign(window.__THREE_CORE__'));
  for (const symbol of ['"Scene":', '"WebGLRenderer":', '"PerspectiveCamera":', '"ShaderMaterial":']) {
    assert.ok(html.includes(symbol), symbol);
  }
  assert.ok(!/\bimport\s*\{[^}]*\}\s*from\s*["']\.\/three\.core/i.test(html));
  for (const marker of ['/* THREE_RUNTIME */', '/* GSAP_RUNTIME */', '/* TRANSCENDENCE_RUNTIME */', '/* ANALYSIS_PAYLOAD */']) {
    assert.ok(!html.includes(marker), marker);
  }
});

test('no credential-like string appears in the package', async () => {
  const patterns = [
    /\b(sk|pk)_(live|test)_[A-Za-z0-9]{16,}/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{30,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
  ];
  for (const component of manifest.components) {
    if (/\.(png|mp3|ogg)$/i.test(component.path)) continue;
    const text = await readFile(join(pkg, component.path), 'utf8');
    for (const pattern of patterns) assert.ok(!pattern.test(text), `${component.path} :: ${pattern}`);
  }
  assert.ok(!/\/Users\/[^/\s"']+\//.test(html), 'absolute machine path in experience.html');
});

/* ---------------------------------------------------------------- the clock */

test('audio time is the only authored clock', () => {
  assert.ok(runtime.includes('audio.currentTime') || runtime.includes('this.el.currentTime'));
  assert.ok(runtime.includes('this.timeline.time('), 'GSAP must be evaluated from the playhead');
  assert.ok(runtime.includes('gsap.timeline({ paused: true'), 'GSAP must never run on its own clock');
  assert.ok(!/setInterval\s*\(/.test(runtime), 'no interval may drive state');
});

test('cue reduction is a pure function of time', () => {
  // The reducer must read the sequence from the start rather than remembering
  // where it was, which is what makes a backwards seek reconstruct exactly.
  const reduce = runtime.slice(runtime.indexOf('reduce(seconds)'), runtime.indexOf('engraveWindowAt(seconds)'));
  assert.ok(reduce.includes('this.indexAt(seconds)'));
  assert.ok(!/this\.(last|previous|current)(State|Index)\s*=/.test(reduce), 'reduce() must not carry state');
});

test('the terrain is a pure function of world position', () => {
  // No frame history, no integration: terrainHeight reads the image and nothing
  // else, so any seek rebuilds the identical landscape.
  const field = runtime.slice(runtime.indexOf('float terrainHeight(vec2 worldXZ, float lod)'), runtime.indexOf('vec3 terrainNormal'));
  assert.ok(field.includes('terrainSampleLod(worldXZ, lod)'));
  assert.ok(!field.includes('uniform float uFrame'), 'terrain must not depend on a frame counter');
  // Level of detail may change how finely the height is filtered but never
  // what it is: the same position must give the same land at any distance.
  assert.ok(field.includes('terrainSampleLod'), 'height must come from the filtered sampler');
});

test('the shipped runtime parses', () => {
  // It is one inline script: a syntax error renders a blank page and logs
  // nothing useful. A backtick inside a GLSL template literal caused exactly
  // this once, which is why the check exists.
  assert.doesNotThrow(() => new Function(runtime));
});

test('no GLSL block contains a backtick', async () => {
  const source = await readFile(join(root, 'transcendence', 'runtime', '05-shaders.js'), 'utf8');
  for (const match of source.matchAll(/GLSL\.\w+\s*=\s*\/\* glsl \*\/`([\s\S]*?)`;/g)) {
    assert.ok(!match[1].includes('`'), 'a backtick inside a GLSL template literal will break the build');
  }
});

/* -------------------------------------------------------------- the terrain */

test('the landscape is the recording, shipped as a package component', () => {
  const terrain = manifest.components.find(c => c.path === 'analysis/track-01.terrain.png');
  assert.ok(terrain, 'the terrain image must be a declared component');
  assert.equal(terrain.type, 'image');
  assert.equal(analysis.parameters.terrain.bands, 128);
  assert.equal(analysis.parameters.terrain.band_scale, 'log');
  assert.ok(analysis.parameters.terrain.band_centres_hz.length === 128);
  // The runtime must read it in a vertex shader rather than shipping geometry.
  assert.ok(runtime.includes('uniform sampler2D uTerrain'));
  assert.ok(runtime.includes('world.y = terrainHeight(world.xz, aLod)'));
});

test('the analysis records what it measured and where it disagrees with the source', () => {
  assert.ok(analysis.source.sha256);
  assert.ok(analysis.parameters.fft_size && analysis.parameters.hop);
  assert.equal(analysis.sound_field.channel_correlation, 1, 'this master is mono and must be declared so');
  for (const line of analysis.lyrics) {
    assert.equal(typeof line.declared_seconds, 'number');
    assert.equal(typeof line.aligned_seconds, 'number');
    assert.equal(typeof line.drift_seconds, 'number');
    assert.ok(line.alignment_method);
  }
});

/* ---------------------------------------------------------------- the lyric */

test('lyrics keep the source order and stay inside the recording', async () => {
  const lrc = await readFile(join(pkg, 'lyrics', 'track-01.lrc'), 'utf8');
  const lines = lrc.split(/\r?\n/)
    .map(l => l.match(/^\[\d+:\d+(?:\.\d+)?\]\s*(.+)$/))
    .filter(Boolean).map(m => m[1].trim());
  assert.equal(lines.length, analysis.lyrics.length);
  let last = -1;
  for (let i = 0; i < lines.length; i++) {
    assert.equal(analysis.lyrics[i].text, lines[i], `lyric ${i} text drifted from the .lrc`);
    assert.ok(analysis.lyrics[i].aligned_seconds > last, `lyric ${i} out of order`);
    last = analysis.lyrics[i].aligned_seconds;
    assert.ok(last <= analysis.duration_seconds);
  }
});

test('each landmark is anchored to a measured band of the singer’s own voice', () => {
  for (const line of analysis.lyrics.slice(0, 4)) {
    assert.equal(typeof line.terrain_band, 'number');
    assert.ok(line.terrain_band >= 0 && line.terrain_band < 128);
    assert.ok(line.terrain_band_hz > 80 && line.terrain_band_hz < 6400);
  }
});

/* ------------------------------------------------------------ interface law */

test('the instrument layer is a map, never a transport', () => {
  // The design carries a section timeline, a frequency axis and landmark
  // callouts. None of them may become playback controls: pause, seek and
  // volume stay in the utility sheet, so the world frame still contains no
  // player. The timeline seeks by *musical location*, which is navigation.
  for (const required of ['id="timeline-marks"', 'id="freq-bands"', 'id="callouts"', 'id="hud-toggle"']) {
    assert.ok(html.includes(required), required);
  }
  const hud = html.slice(html.indexOf('<div id="hud"'), html.indexOf('<!-- Captions'));
  for (const forbidden of ['id="play', 'Pause', 'volume', 'type="range"']) {
    assert.ok(!hud.includes(forbidden), `transport control leaked into the instrument layer: ${forbidden}`);
  }
  // And it can be switched off entirely.
  assert.ok(runtime.includes('_setHud('));
});

test('the primary interface has no conventional player chrome', () => {
  const body = html.slice(html.indexOf('<body'), html.indexOf('</main>'));
  for (const forbidden of ['id="next"', 'id="prev"', 'id="progress', 'class="progress-bar"',
                           'id="playlist"', 'id="tracklist"', 'id="player"']) {
    assert.ok(!body.includes(forbidden), forbidden);
  }
  // And no branding in the world frame.
  const withoutColophon = body.replace(/<p id="colophon-text">[\s\S]*?<\/p>/, '');
  assert.ok(!/NOIZES/.test(withoutColophon));
});

test('conventional controls and keyboard routes always remain available', () => {
  for (const required of ['id="utility"', 'id="transport"', 'id="sheet-seek"', 'id="volume"',
                          'id="lyric-list"', 'aria-live="polite"', 'aria-live="assertive"',
                          'id="motion-toggle"', 'id="contrast-toggle"', 'id="caption-toggle"']) {
    assert.ok(html.includes(required), required);
  }
  for (const key of ["event.key === ' '", "event.key === 'Escape'", "'ArrowLeft'", "'Enter'"]) {
    assert.ok(runtime.includes(key), key);
  }
  // The single control must hide itself when the pointer rests, and come back.
  assert.ok(html.includes('#stage[data-chrome="visible"] #utility'));
  assert.ok(runtime.includes("dataset.chrome = 'hidden'"));
});

test('the cue inspector is developer-only', () => {
  assert.ok(html.includes("get('debug') === '1'"));
  assert.match(html, /<section id="debug" hidden/);
});

/* --------------------------------------------------- quality and fallbacks */

test('all four quality profiles exist and preserve the narrative', () => {
  for (const profile of ['cinematic', 'balanced', 'lite', 'essential']) {
    assert.ok(html.includes(profile), profile);
  }
  // Essential is reachable both by choice and automatically.
  assert.ok(runtime.includes('_startEssential'));
  assert.ok(html.includes('data-quality-option="essential"'));
});

test('a missing WebGL context selects Essential without losing playback or lyrics', () => {
  assert.ok(runtime.includes("if (!gl) return 'essential'"));
  assert.ok(runtime.includes("webglcontextlost"));
  assert.ok(runtime.includes('class EssentialStage'));
  // The fallback draws from the same terrain data and the same clock.
  const essential = runtime.slice(runtime.indexOf('class EssentialStage'));
  assert.ok(essential.includes('this.analysis.terrainAt('), 'Essential must draw the real terrain');
  assert.ok(essential.includes('f.time'), 'Essential must run on the audio clock');
});

test('reduced motion is a different edit, not the same edit with movement removed', () => {
  assert.ok(runtime.includes('reducedMotion'));
  // Each shot carries an authored still that reduced motion holds instead of
  // travelling the rail.
  const shots = runtime.slice(runtime.indexOf('const SHOTS = {'), runtime.indexOf('class CueEngine'));
  const stills = shots.match(/still:\s*[\d.]+/g) || [];
  assert.ok(stills.length >= 15, `expected an authored still per shot, found ${stills.length}`);
  assert.ok(runtime.includes('reducedMotion ? shot.still'));
});

test('the performance governor is hysteretic and never overrides the listener', () => {
  const governor = runtime.slice(runtime.indexOf('class PerformanceGovernor'), runtime.indexOf('class AccessibilityController'));
  assert.ok(governor.includes('this.locked'), 'a listener choice must lock the profile');
  assert.ok(/this\.overBudget > \d\d/.test(governor), 'downgrade must require sustained overrun');
  assert.ok(governor.includes('this.cooldown'), 'there must be a cooldown between changes');
  assert.ok(!/this\.index--/.test(governor), 'the governor must never upgrade on its own');
});

/* --------------------------------------------------------------- the sequence */

test('the shipped timeline matches the authored sequence and stays ordered', async () => {
  const timeline = await readJson('timeline/transcendence.timeline.json');
  assert.equal(timeline.master_clock, 'audio.currentTime');
  assert.ok(timeline.cues.length >= 20, `only ${timeline.cues.length} cues`);
  let last = -1;
  for (const cue of timeline.cues) {
    assert.ok(cue.time >= last, 'cues out of order');
    last = cue.time;
  }
  assert.equal(timeline.range_seconds[1], 104);
  // Every cue time in the shipped timeline must also exist in the runtime.
  for (const cue of timeline.cues) assert.ok(runtime.includes(`id: '${cue.id}'`), cue.id);
});

test('cue times are measured musical events, not round numbers', () => {
  const timeline = SEQUENCE_TIMES();
  const measured = [18.65, 31.25, 64.71, 79.04, 91.5];
  for (const t of measured) assert.ok(timeline.includes(t), `missing measured cue at ${t}`);
  // The vocal-entry cue is the measured first vocal-phrase onset, rounded to
  // the hundredth of a second that the sequence is written in. It must not
  // drift further than that rounding.
  assert.ok(
    Math.abs(analysis.vocal_phrases[0].start - 18.65) <= 0.01,
    `vocal entry cue 18.65 does not match the measured onset ${analysis.vocal_phrases[0].start}`,
  );
});

function SEQUENCE_TIMES() {
  return [...runtime.matchAll(/time:\s*([\d.]+),\s*id:/g)].map(m => Number(m[1]));
}

/* ---------------------------------------------------------------- the package */

test('the package is within the declared size budget', async () => {
  const info = await stat(nz);
  const mb = info.size / 1024 / 1024;
  assert.ok(mb < 100, `package is ${mb.toFixed(1)} MB`);
});
