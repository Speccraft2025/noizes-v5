// Validates the Transcendence Edition .nz.
//
// Everything below is checked against the *extracted archive*, not the source
// tree, so it verifies what a listener would actually receive.
//
//   node scripts/validate-transcendence.mjs

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const NZ = join(ROOT, 'dist', 'The-House-That-Remembered-Us-Transcendence.nz');
const TEMP = join(ROOT, '.validation-transcendence');

const errors = [];
const fail = message => errors.push(message);

await rm(TEMP, { recursive: true, force: true });
await mkdir(TEMP, { recursive: true });

// Archive integrity first: a corrupt zip makes every later check meaningless.
try {
  execFileSync('unzip', ['-tq', NZ], { stdio: 'pipe' });
} catch {
  console.error('archive integrity check failed');
  process.exit(1);
}
execFileSync('unzip', ['-q', NZ, '-d', TEMP]);

const read = async path => JSON.parse(await readFile(join(TEMP, path), 'utf8'));
const manifest = await read('manifest.json');
const ledger = await read('metadata/asset-rights-ledger.json');
const analysis = await read('analysis/track-01.analysis.json');
const timeline = await read('timeline/transcendence.timeline.json');
const authenticity = await read('authenticity.json');
const html = await readFile(join(TEMP, 'experience.html'), 'utf8');

/* ------------------------------------------------------------- required files */

const REQUIRED = [
  'manifest.json', 'experience.html', 'edition.json', 'rights.json', 'credits.json',
  'authenticity.json', 'technical.json', 'experience.json', 'archive.json', 'history.json',
  'README-OFFLINE.txt',
  'timeline/transcendence.timeline.json',
  'analysis/track-01.analysis.json',
  'analysis/track-01.terrain.png',
  'metadata/accessibility.json', 'metadata/asset-rights-ledger.json',
  'audio/track-01.mp3', 'audio/track-01.ogg', 'lyrics/track-01.lrc',
];
for (const path of REQUIRED) {
  try { await readFile(join(TEMP, path)); } catch { fail(`missing ${path}`); }
}

/* --------------------------------------------------- component inventory + hashes */

const ids = new Set(), paths = new Set();
for (const component of manifest.components) {
  if (ids.has(component.component_id)) fail(`duplicate component id ${component.component_id}`);
  ids.add(component.component_id);
  if (paths.has(component.path)) fail(`duplicate component path ${component.path}`);
  paths.add(component.path);
  try {
    const bytes = await readFile(join(TEMP, component.path));
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash !== component.sha256) fail(`hash mismatch ${component.path}`);
    if (bytes.length !== component.size) fail(`size mismatch ${component.path}`);
  } catch {
    fail(`declared component missing from archive: ${component.path}`);
  }
}
for (const track of manifest.tracks) {
  if (!ids.has(track.primary_audio_component)) fail(`track ${track.track_id} references a missing audio component`);
}
if (manifest.release.track_count !== manifest.tracks.length) fail('track_count does not match the track list');

// The authenticity inventory must cover exactly the manifest's components.
const inventory = manifest.components.map(c => `${c.path}:${c.sha256}:${c.size}`).sort().join('\n');
if (authenticity.hash !== createHash('sha256').update(Buffer.from(inventory)).digest('hex')) {
  fail('authenticity inventory hash does not match the manifest components');
}
if (authenticity.signed !== false || authenticity.development_signature?.status !== 'placeholder') {
  fail('authenticity must declare itself unsigned with a placeholder development signature');
}
if (authenticity.source_recording?.sha256 !== analysis.source.sha256) {
  fail('authenticity does not record the audio hash the analysis was computed from');
}

/* ------------------------------------------------------------- offline guarantees */

if (/<(script|link|img|audio|source|video)\b[^>]*\b(src|href)\s*=\s*["']\s*(https?:)?\/\//i.test(html)) {
  fail('the experience references an external URL');
}
if (!/connect-src 'none'/.test(html)) fail("the experience does not declare connect-src 'none'");
for (const marker of ['/* THREE_RUNTIME */', '/* GSAP_RUNTIME */', '/* TRANSCENDENCE_RUNTIME */',
                      '/* TRANSCENDENCE_CSS */', '/* ANALYSIS_PAYLOAD */', '<!-- DEBUG_PANEL -->']) {
  if (html.includes(marker)) fail(`unresolved build marker ${marker}`);
}
if (/\bimport\s*\{[^}]*\}\s*from\s*["']\.\/three\.core/i.test(html) || /\bexport\s*\{[^}]*\}\s*from\s*["']\.\/three\.core/i.test(html)) {
  fail('Three.js ES module syntax survived into the offline runtime');
}
if (!html.includes('window.THREE=Object.assign(window.__THREE_CORE__')) fail('the local Three.js namespace was not installed');
for (const symbol of ['"Scene":', '"WebGLRenderer":', '"PerspectiveCamera":', '"ShaderMaterial":']) {
  if (!html.includes(symbol)) fail(`the bundled Three.js core is missing ${symbol}`);
}
// These checks apply to *this edition's* runtime, not to the vendored libraries.
// Three.js ships loaders that reference fetch and Web Audio helpers we never
// construct; the package's own guarantee is `connect-src 'none'`, which makes
// any such call impossible whoever wrote it.
const runtimeStart = html.indexOf('/* ==== 01-prelude.js ==== */');
if (runtimeStart < 0) fail('the edition runtime block could not be located');
const runtime = runtimeStart < 0 ? '' : html.slice(runtimeStart, html.indexOf('</script>', runtimeStart));
for (const network of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'new WebSocket', 'EventSource']) {
  if (runtime.includes(network)) fail(`the edition runtime contains a network API: ${network}`);
}
if (/getUserMedia|createAnalyser/.test(runtime)) fail('the edition runtime opens a microphone or analyses live audio');
if (!/audio\.currentTime/.test(runtime)) fail('the edition runtime does not read the audio clock');

/* The whole runtime ships as one inline script. A syntax error there is fatal
 * and silent — the page renders nothing and logs nothing useful — so the build
 * must never emit one. A stray backtick inside a GLSL template literal is the
 * way this happens in practice. */
try {
  // eslint-disable-next-line no-new-func
  new Function(runtime);
} catch (error) {
  fail(`the edition runtime does not parse: ${error.message}`);
}

/* -------------------------------------------------------------- the terrain world */

for (const token of [
  'class WorldRenderer', 'class CameraDirector', 'class AudioClock', 'class CueEngine',
  'class PerformanceGovernor', 'class AccessibilityController', 'class EssentialStage',
  'class SpatialAudioSystem', 'class LandmarkField', 'class ArchiveLayer',
  'audio.currentTime', 'gsap.timeline', 'new T.WebGLRenderer',
  'terrainHeight', 'terrainSample', 'uTerrain',
]) {
  if (!html.includes(token)) fail(`runtime token missing: ${token}`);
}
if (!html.includes("this.timeline.time(")) fail('GSAP is not being driven from the audio clock');
if (/setInterval\s*\(/.test(html)) fail('the runtime uses setInterval as a clock');

if (!paths.has('analysis/track-01.terrain.png')) fail('the terrain image is not a declared component');
if (analysis.parameters.terrain.bands !== 128) fail('terrain band count changed without the validator being updated');
if (analysis.parameters.terrain.band_scale !== 'log') fail('terrain band scale is not constant-Q');

/* ----------------------------------------------------------------- the sequence */

if (manifest.experience?.authored_arc?.end_seconds !== 104) fail('authored arc boundary is not 104 s');
if (timeline.master_clock !== 'audio.currentTime') fail('the shipped timeline does not declare the audio clock');
if (timeline.cues.length < 20) fail(`the shipped timeline has only ${timeline.cues.length} cues`);
let previous = -1;
for (const cue of timeline.cues) {
  if (cue.time < previous) fail('shipped timeline cues are not in order');
  previous = cue.time;
}

// Lyrics must stay in the .lrc order and be anchored to measured phrase onsets.
const lrc = await readFile(join(TEMP, 'lyrics/track-01.lrc'), 'utf8');
const lrcLines = lrc.split(/\r?\n/).map(l => l.match(/^\[\d+:\d+(?:\.\d+)?\]\s*(.+)$/)).filter(Boolean).map(m => m[1].trim());
if (lrcLines.length !== analysis.lyrics.length) fail('analysis lyric count does not match the .lrc');
let lastAligned = -1;
for (let i = 0; i < analysis.lyrics.length; i++) {
  const line = analysis.lyrics[i];
  if (line.text !== lrcLines[i]) fail(`lyric ${i} text does not match the .lrc source of truth`);
  if (line.aligned_seconds <= lastAligned) fail(`lyric ${i} is out of order after alignment`);
  lastAligned = line.aligned_seconds;
  if (line.aligned_seconds < 0 || line.aligned_seconds > analysis.duration_seconds) fail(`lyric ${i} falls outside the recording`);
  if (line.alignment_method !== 'order-preserving-vocal-phrase-fit' && line.alignment_method !== 'declared-lrc-time') {
    fail(`lyric ${i} used an undeclared alignment method`);
  }
  if (typeof line.terrain_band !== 'number') fail(`lyric ${i} has no measured terrain band`);
}

/* ------------------------------------------------------------- interface law */

// No conventional player chrome may exist in the primary interface.
const body = html.slice(html.indexOf('<body'), html.indexOf('</main>'));
for (const forbidden of ['id="next"', 'id="prev"', 'id="progress', 'class="progress-bar"',
                         'id="playlist"', 'id="tracklist"', 'id="player"', 'class="player-bar"']) {
  if (body.includes(forbidden)) fail(`conventional player chrome present: ${forbidden}`);
}
// The one discreet control and the accessible alternatives must all exist.
for (const required of ['id="utility"', 'id="sheet"', 'id="transport"', 'id="sheet-seek"',
                        'id="volume"', 'id="lyric-list"', 'aria-live="polite"', 'aria-live="assertive"',
                        'data-quality-option="essential"', 'id="motion-toggle"', 'id="contrast-toggle"']) {
  if (!body.includes(required)) fail(`accessible control missing: ${required}`);
}
if (!/#stage\[data-chrome="visible"\] #utility/.test(html)) fail('the utility control does not hide when the pointer rests');
if (/NOIZES/.test(body.replace(/<p id="colophon-text">[\s\S]*?<\/p>/, ''))) {
  fail('brand name is visible in the primary interface');
}
// The developer inspector must be inert unless explicitly requested.
if (!html.includes("get('debug') === '1'")) fail('the cue inspector is not gated behind ?debug=1');
if (!/<section id="debug" hidden/.test(html)) fail('the cue inspector markup is not hidden by default');

/* -------------------------------------------------------------- rights ledger */

for (const entry of ledger) {
  if (!entry.sha256 || !entry.source_page || !entry.verification_evidence) fail(`incomplete rights record ${entry.asset_id}`);
  if (!paths.has(entry.local_path)) fail(`rights record points at a path not in the package: ${entry.local_path}`);
}
for (const path of paths) {
  if (path.startsWith('audio/') && !ledger.some(e => e.local_path === path)) fail(`unledgered audio ${path}`);
  if (path.startsWith('assets/images/') && !ledger.some(e => e.local_path === path)) fail(`unledgered image ${path}`);
  if (path.startsWith('analysis/') && !ledger.some(e => e.local_path === path)) fail(`unledgered analysis asset ${path}`);
}

/* ------------------------------------------------------------------ no secrets */

const SECRET = [
  /\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{16,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i,
];
for (const path of paths) {
  if (/\.(png|mp3|ogg|jpg|jpeg|webp)$/i.test(path)) continue;
  const text = await readFile(join(TEMP, path), 'utf8');
  for (const pattern of SECRET) {
    if (pattern.test(text)) fail(`possible credential in ${path}`);
  }
}
// Machine-specific absolute paths must never ship.
for (const path of ['experience.html', 'technical.json', 'manifest.json']) {
  const text = await readFile(join(TEMP, path), 'utf8');
  if (/\/Users\/[^/\s"']+\//.test(text) || /[A-Z]:\\Users\\/.test(text)) fail(`absolute machine path in ${path}`);
}

/* ------------------------------------------------------------------- report */

if (errors.length) {
  console.error(`INVALID — ${errors.length} problem${errors.length === 1 ? '' : 's'}:`);
  for (const error of errors) console.error(`  · ${error}`);
  process.exit(1);
}

const bytes = manifest.components.reduce((a, c) => a + c.size, 0);
console.log(
  `VALID TRANSCENDENCE · sonic terrain · ${manifest.experience.authored_arc.end_seconds} s authored arc · `
  + `${manifest.components.length} verified components · ${ledger.length} rights records · `
  + `${(bytes / 1024 / 1024).toFixed(1)} MB declared · offline runtime · unsigned development build`,
);
await rm(TEMP, { recursive: true, force: true });
