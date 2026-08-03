// Builds the Transcendence Edition .nz.
//
// Strictly additive: it reads the Guided edition's build output and never
// writes to it, to the Masterpiece edition, or to any of their sources.
//
//   node scripts/build-transcendence.mjs [--force-assets]

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const REPO = join(ROOT, '..', '..');
const GUIDED = join(ROOT, 'build', 'The-House-That-Remembered-Us-Guided');
const SOURCE = join(ROOT, 'transcendence');
const PKG = join(ROOT, 'build', 'The-House-That-Remembered-Us-Transcendence');
const OUT = join(ROOT, 'dist', 'The-House-That-Remembered-Us-Transcendence.nz');

const EDITION_ID = 'transcendence-sonic-terrain-001';
const SLICE = { track: 'track-01', start: 0, end: 104 };

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const exists = async path => { try { await access(path); return true; } catch { return false; } };
const put = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); };

const log = (...parts) => console.log(...parts);

/* ------------------------------------------------------------ preconditions */

if (!await exists(GUIDED)) {
  console.error(`The Guided edition build is required as the package base but was not found at:\n  ${GUIDED}\nRun "npm run build" first.`);
  process.exit(1);
}

/* -------------------------------------------------- analysis and textures */

const analysisPath = join(SOURCE, 'analysis', 'track-01.analysis.json');
const force = process.argv.includes('--force-assets');
if (force || !await exists(analysisPath)) {
  log('· analysing track one');
  execFileSync('node', [join(ROOT, 'scripts', 'analyze-transcendence.mjs')], { stdio: 'inherit' });
}
const textureManifestPath = join(SOURCE, 'assets', 'textures.manifest.json');
if (force || !await exists(textureManifestPath)) {
  log('· generating procedural textures');
  execFileSync('node', [join(ROOT, 'scripts', 'generate-textures-transcendence.mjs')], { stdio: 'inherit' });
}

/* ------------------------------------------------------------- package base */

await rm(PKG, { recursive: true, force: true });
await cp(GUIDED, PKG, { recursive: true });

/* ----------------------------------------------- local runtime dependencies */

/* Three.js ships as ES modules that import each other by relative path. The
 * package has no module resolver and no network, so both files are converted
 * into one script that installs a package-local global. */
function toGlobalNamespace(source) {
  const match = source.match(/export\{([^}]*)\};?\s*$/);
  if (!match) throw new Error('Unable to convert the local Three.js export block');
  const entries = match[1].split(',').map(entry => {
    const parts = entry.trim().split(/\s+as\s+/);
    return `${JSON.stringify(parts[1] || parts[0])}:${parts[0]}`;
  });
  return { body: source.slice(0, match.index), object: entries.join(',') };
}

async function buildThreeBundle() {
  const base = join(REPO, 'studio', 'node_modules', 'three', 'build');
  let core = await readFile(join(base, 'three.core.min.js'), 'utf8');
  let main = await readFile(join(base, 'three.module.min.js'), 'utf8');

  const coreExport = toGlobalNamespace(core);
  core = `(()=>{${coreExport.body}window.__THREE_CORE__={${coreExport.object}};})();`;

  const coreImport = main.match(/import\{([^}]*)\}from"\.\/three\.core\.min\.js";/);
  if (!coreImport) throw new Error('Unable to convert the local Three.js core import');
  const destructured = coreImport[1].split(',').map(entry => {
    const parts = entry.trim().split(/\s+as\s+/);
    return parts.length === 2 ? `${parts[0]}:${parts[1]}` : parts[0];
  }).join(',');
  main = main
    .replace(coreImport[0], `const{${destructured}}=window.__THREE_CORE__;`)
    .replace(/export\{[^}]*\}from"\.\/three\.core\.min\.js";/, '');

  const mainExport = toGlobalNamespace(main);
  const version = JSON.parse(await readFile(join(REPO, 'studio', 'node_modules', 'three', 'package.json'), 'utf8')).version;
  return {
    version,
    code: core + mainExport.body + `window.THREE=Object.assign(window.__THREE_CORE__,{${mainExport.object}});delete window.__THREE_CORE__;`,
  };
}

const three = await buildThreeBundle();
const gsapPath = join(REPO, 'studio', 'node_modules', 'gsap');
const gsap = await readFile(join(gsapPath, 'dist', 'gsap.min.js'), 'utf8');
const gsapVersion = JSON.parse(await readFile(join(gsapPath, 'package.json'), 'utf8')).version;
log(`· bundled three ${three.version} and gsap ${gsapVersion} from the local repository`);

/* ------------------------------------------------------------ the document */

const RUNTIME_MODULES = [
  '01-prelude.js', '02-analysis.js', '03-clock.js', '04-sequence.js', '05-shaders.js',
  '06-landmarks.js', '07-world.js', '08-camera.js', '09-audio.js', '10-essential.js',
  '11-systems.js', '12-app.js',
];

const runtime = (await Promise.all(
  RUNTIME_MODULES.map(async file => `\n/* ==== ${file} ==== */\n` + await readFile(join(SOURCE, 'runtime', file), 'utf8')),
)).join('\n');

const css = await readFile(join(SOURCE, 'styles.css'), 'utf8');
const analysisPayload = await readFile(analysisPath, 'utf8');

const edition = {
  edition_id: EDITION_ID,
  name: 'Transcendence Edition — Sonic Terrain',
  copy: '001 / 001',
  purpose: 'Flagship demonstration of a portable, ownable, authenticated music world',
  transferable: false,
  simulation: true,
  demo_only: true,
  commercial_clearance: 'Not cleared for commercial distribution. Demonstration use only.',
  scope: { track_id: SLICE.track, seconds: [SLICE.start, SLICE.end] },
  principle: 'Audio supplies the terrain. Analysis supplies the physics. The artist supplies the meaning. Noizes preserves the resulting world. Nothing in this landscape was modelled: it is the measured shape of the recording, flown through in sync with its own playback.',
};

const debugPanel = `<section id="debug" hidden aria-label="Developer cue inspector">
    <div class="debug-jumps"></div>
    <label>Time <input id="debug-time" type="range" min="0" max="${SLICE.end}" step="0.05" value="0"></label>
    <output id="debug-output"></output>
  </section>`;

const colophon = `${edition.name} · copy ${edition.copy}. Demonstration edition, not cleared for commercial distribution. `
  + `Audio: Library of Congress National Jukebox, public domain in the United States. `
  + `Every texture in this package was generated procedurally by the build; no third-party image is included. `
  + `Runtime: Three.js ${three.version} (MIT) and GSAP ${gsapVersion}, both bundled locally. `
  + `No network connection is used or possible: this page declares connect-src 'none'.`;

let html = await readFile(join(SOURCE, 'experience.html'), 'utf8');
html = html
  .replace('/* TRANSCENDENCE_CSS */', () => css)
  .replace('<!-- DEBUG_PANEL -->', () => debugPanel)
  .replace('/* ANALYSIS_PAYLOAD */', () => analysisPayload)
  .replace('/* EDITION_PAYLOAD */', () => JSON.stringify(edition))
  .replace('/* THREE_RUNTIME */', () => three.code)
  .replace('/* GSAP_RUNTIME */', () => gsap)
  .replace('/* TRANSCENDENCE_RUNTIME */', () => runtime)
  .replace('<p id="colophon-text"></p>', `<p id="colophon-text">${colophon}</p>`);

await put(join(PKG, 'experience.html'), html);

/* ------------------------------------------------------------------ assets */

const TEXTURES = [
  ['dust-grain.png', 'tx-dust-grain.png', 'Irregular suspended-matter sprite with lens halo'],
  ['blue-noise.png', 'tx-blue-noise.png', 'Tileable blue noise for dithering and film grain'],
];
for (const [from, to] of TEXTURES) {
  await cp(join(SOURCE, 'assets', from), join(PKG, 'assets', 'images', to));
}
await cp(analysisPath, join(PKG, 'analysis', 'track-01.analysis.json'));
// The terrain image is not an illustration of the recording: it is the world.
await cp(join(SOURCE, 'analysis', 'track-01.terrain.png'), join(PKG, 'analysis', 'track-01.terrain.png'));

/* ---------------------------------------------------------------- timeline */

const analysis = JSON.parse(analysisPayload);
const sequenceSource = await readFile(join(SOURCE, 'runtime', '04-sequence.js'), 'utf8');
const cueTimes = [...sequenceSource.matchAll(/time:\s*([\d.]+),\s*id:\s*'([\w-]+)',\s*phase:\s*'([\w-]+)',\s*shot:\s*'(\w+)'/g)]
  .map(m => ({ time: Number(m[1]), id: m[2], phase: m[3], shot: m[4] }));
if (cueTimes.length < 20) throw new Error(`Expected the authored sequence to parse; found ${cueTimes.length} cues`);

await put(join(PKG, 'timeline', 'transcendence.timeline.json'), json({
  schema_version: '1.0.0',
  master_clock: 'audio.currentTime',
  track_id: SLICE.track,
  range_seconds: [SLICE.start, SLICE.end],
  reconstruction: 'Reduce the authored sequence from the beginning at every frame: the state at t depends on nothing but t.',
  analysis: 'analysis/track-01.analysis.json',
  determinism: 'Every particle position is f(seed, audioTime) with no integration and no frame history. Seeking, pausing, tab changes and replay reconstruct identical state.',
  measured_anchors: {
    statement: 'Every cue time is a measured musical event, not an estimate by ear.',
    vocal_entry: analysis.vocal_phrases[0].start,
    section_boundaries: analysis.sections,
    lyric_onsets: analysis.lyrics.slice(0, 4).map(l => ({ text: l.text, aligned_seconds: l.aligned_seconds, declared_seconds: l.declared_seconds, drift_seconds: l.drift_seconds })),
  },
  cues: cueTimes,
}));

/* ------------------------------------------------------------------- docs */

const DOC_CANDIDATES = [
  'TRANSCENDENCE_TREATMENT.md',
  'TRANSCENDENCE_SONIC_TERRAIN.md',
  'TRANSCENDENCE_CREATIVE_DIRECTION.md',
  'TRANSCENDENCE_ARCHITECTURE.md',
  'TRANSCENDENCE_CAMERA_LANGUAGE.md',
  'TRANSCENDENCE_LIGHTING.md',
  'TRANSCENDENCE_MATERIAL_SYSTEM.md',
  'TRANSCENDENCE_SHADER_SYSTEM.md',
  'TRANSCENDENCE_ANALYSIS.md',
  'TRANSCENDENCE_SPATIAL_AUDIO.md',
  'TRANSCENDENCE_ACCESSIBILITY.md',
  'TRANSCENDENCE_PERFORMANCE.md',
  'TRANSCENDENCE_QA.md',
  'TRANSCENDENCE_FRAME_REVIEW.md',
];
const docs = [];
for (const file of DOC_CANDIDATES) {
  if (!await exists(join(ROOT, file))) continue;
  await cp(join(ROOT, file), join(PKG, 'assets', 'documents', file));
  docs.push(file);
}
log(`· included ${docs.length} creative documents`);

/* ------------------------------------------------------------- descriptors */

await put(join(PKG, 'edition.json'), json(edition));
await put(join(PKG, 'experience.json'), json({
  schema_version: '4.0.0',
  type: 'sonic-terrain',
  entry: 'experience.html',
  default_mode: 'world',
  fallback_mode: 'essential',
  reduced_motion_supported: true,
  high_contrast_supported: true,
  timeline: 'timeline/transcendence.timeline.json',
  analysis: 'analysis/track-01.analysis.json',
  scope: `${SLICE.end}-second authored arc on ${SLICE.track}`,
  quality_profiles: ['cinematic', 'balanced', 'lite', 'essential'],
  clock: 'audio.currentTime is the only authored clock',
  interaction: {
    threshold: 'press and hold to lower the stylus; unlocks media and AudioContext in one gesture',
    attention: 'pointer, touch or arrow keys; stillness thickens the deposit',
    engraving: 'hold during an inscription to press that line deeper; affects only the residue',
  },
  principle: edition.principle,
}));

await put(join(PKG, 'technical.json'), json({
  packager: 'Noizes Transcendence builder 1.0.0',
  built_at: new Date().toISOString(),
  offline: true,
  network_capable: false,
  content_security_policy: "connect-src 'none'; no external origin is reachable from the experience",
  runtime_dependencies: [
    { name: 'Three.js', version: three.version, licence: 'MIT', delivery: 'converted from the local ESM distribution to an inline package-local global' },
    { name: 'GSAP', version: gsapVersion, licence: 'GSAP Standard License', delivery: 'inlined from the local repository dependency', role: 'paused choreography evaluator reconciled to audio.currentTime' },
  ],
  renderer: 'WebGL2 via Three.js. The ground is a camera-carried grid whose vertex heights are sampled from analysis/track-01.terrain.png in a vertex shader; there is no authored terrain geometry in the package.',
  post_chain: ['bright pass', 'separable bloom', 'half-resolution blur', 'depth-of-field composite', 'ACES-style tonemap', 'sRGB encode', 'vignette', 'chromatic aberration', 'blue-noise grain and dither'],
  quality_profiles: ['cinematic', 'balanced', 'lite', 'essential'],
  performance_governor: 'measured frame time, exponential moving average, 90-frame hysteresis, never auto-upgrades, never overrides a listener choice',
  developer_cue_inspector: '?debug=1',
  terrain: 'analysis/track-01.terrain.png — one pixel per (time frame, log-frequency band). R elevation, G harmonic mask, B transient, A ridge salience.',
  textures: 'the two remaining bitmaps are generated procedurally by scripts/generate-textures-transcendence.mjs; no third-party image is embedded',
  fonts: 'system old-style serif stack; no font file is downloaded or redistributed',
  audio_graph: ['music (master recording, never processed)', 'world ambience', 'near field', 'transition'],
}));

/* ------------------------------------------------------------ rights ledger */

const ledger = JSON.parse(await readFile(join(PKG, 'metadata', 'asset-rights-ledger.json'), 'utf8'));
const experienceBytes = await readFile(join(PKG, 'experience.html'));

const ledgerEntry = (over) => ({
  performer: '', direct_download_source: 'Not applicable',
  work_status: 'Original generated work', lyrics_status: 'Not applicable',
  recording_status: 'Not applicable', artwork_status: 'Not applicable',
  attribution_required: false, modification_allowed: true, commercial_use_allowed: false,
  territorial_notes: 'Original content generated by this repository’s build scripts.',
  verification_date: '2026-08-02',
  ...over,
});

ledger.push(ledgerEntry({
  asset_id: 'transcendence-three-runtime',
  local_path: 'experience.html',
  title: `Three.js ${three.version} runtime`,
  creator: 'Three.js authors',
  source_institution: 'Three.js npm distribution vendored in studio/node_modules',
  source_page: 'https://threejs.org/',
  work_status: 'Third-party software',
  license: 'MIT', license_url: 'https://github.com/mrdoob/three.js/blob/dev/LICENSE',
  attribution_required: true,
  attribution_text: 'Three.js is bundled locally as the spatial rendering runtime.',
  commercial_use_allowed: true,
  territorial_notes: 'MIT licence.',
  verification_evidence: 'The local ESM distribution is converted to a package-local global at build time and inlined into experience.html. No CDN or network request is involved.',
  sha256: sha(experienceBytes),
}));

ledger.push(ledgerEntry({
  asset_id: 'transcendence-gsap-runtime',
  local_path: 'experience.html',
  title: `GSAP ${gsapVersion} runtime`,
  creator: 'GreenSock / Webflow',
  source_institution: 'GSAP npm distribution vendored in studio/node_modules',
  source_page: 'https://www.npmjs.com/package/gsap',
  work_status: 'Third-party software',
  license: 'GSAP Standard License', license_url: 'https://gsap.com/standard-license/',
  attribution_text: 'GSAP is bundled as a paused choreography evaluator; it never runs on its own clock.',
  commercial_use_allowed: true,
  territorial_notes: 'Use subject to the bundled dependency licence. This edition is demonstration-only.',
  verification_evidence: 'Inlined from the local repository dependency at build time; no CDN is used.',
  sha256: sha(experienceBytes),
}));

for (const [from, to, title] of TEXTURES) {
  const bytes = await readFile(join(PKG, 'assets', 'images', to));
  ledger.push(ledgerEntry({
    asset_id: `transcendence-${to.replace(/\.png$/, '')}`,
    local_path: `assets/images/${to}`,
    title,
    creator: 'Generated by scripts/generate-textures-transcendence.mjs for the Noizes Transcendence build',
    source_institution: 'Original generated demonstration asset',
    source_page: `Project source: scripts/generate-textures-transcendence.mjs → transcendence/assets/${from}`,
    artwork_status: 'Original procedurally generated texture; no photograph, scan, model output or third-party image was used',
    license: 'Project demonstration asset', license_url: 'Not applicable',
    attribution_text: 'No external source image exists: this file is computed from seeded integer hashing.',
    verification_evidence: 'Authored pixel by pixel by the repository build script from a fixed seed. Deleting the file and re-running the generator reproduces it byte for byte. No real person, place, brand or document is depicted.',
    sha256: sha(bytes),
  }));
}

const terrainBytes = await readFile(join(PKG, 'analysis', 'track-01.terrain.png'));
ledger.push(ledgerEntry({
  asset_id: 'transcendence-track-01-terrain',
  local_path: 'analysis/track-01.terrain.png',
  title: 'Sonic Terrain — the landscape itself',
  creator: 'Generated by scripts/analyze-transcendence.mjs',
  source_institution: 'Derived measurement of audio/track-01.mp3',
  source_page: 'Project source: scripts/analyze-transcendence.mjs',
  work_status: 'Derived measurement of a public-domain recording',
  artwork_status: 'Not an illustration: one pixel per (time frame, log-frequency band) of the recording. Every hill, ridge and valley in the experience is read from this image in a vertex shader.',
  verification_evidence: 'Computed from audio/track-01.mp3 by constant-Q analysis with the parameters recorded in track-01.analysis.json. Deleting it and re-running the analyser reproduces it byte for byte.',
  license: 'Public Domain (United States) — derived measurement', license_url: 'https://www.loc.gov/collections/national-jukebox/about-this-collection/rights-and-access/',
  sha256: sha(terrainBytes),
}));

const analysisBytes = await readFile(join(PKG, 'analysis', 'track-01.analysis.json'));
ledger.push(ledgerEntry({
  asset_id: 'transcendence-track-01-analysis',
  local_path: 'analysis/track-01.analysis.json',
  title: 'Deterministic musical analysis of Track One',
  creator: 'Generated by scripts/analyze-transcendence.mjs',
  source_institution: 'Derived measurement of audio/track-01.mp3',
  source_page: 'Project source: scripts/analyze-transcendence.mjs',
  work_status: 'Derived measurement of a public-domain recording',
  verification_evidence: `Computed from audio/track-01.mp3 (sha256 ${analysis.source.sha256.slice(0, 16)}…) with the parameters recorded inside the file. The source recording is public domain in the United States.`,
  license: 'Public Domain (United States) — derived measurement', license_url: 'https://www.loc.gov/collections/national-jukebox/about-this-collection/rights-and-access/',
  sha256: sha(analysisBytes),
}));

const timelineBytes = await readFile(join(PKG, 'timeline', 'transcendence.timeline.json'));
ledger.push(ledgerEntry({
  asset_id: 'transcendence-timeline',
  local_path: 'timeline/transcendence.timeline.json',
  title: 'Authored sequence for the Transcendence edition',
  creator: 'Noizes Transcendence build',
  source_institution: 'Original authored work',
  source_page: 'Project source: transcendence/runtime/04-sequence.js',
  verification_evidence: 'Extracted from the authored sequence at build time so the shipped timeline can never disagree with the runtime.',
  license: 'Project demonstration asset', license_url: 'Not applicable',
  sha256: sha(timelineBytes),
}));

for (const file of docs) {
  const bytes = await readFile(join(PKG, 'assets', 'documents', file));
  ledger.push(ledgerEntry({
    asset_id: `transcendence-doc-${file.replace(/\.md$/, '').toLowerCase()}`,
    local_path: `assets/documents/${file}`,
    title: file.replace(/_/g, ' ').replace(/\.md$/, ''),
    creator: 'Noizes Transcendence creative direction',
    source_institution: 'Original authored documentation',
    source_page: `Project source: ${file}`,
    verification_evidence: 'Written for this edition and shipped inside the package so the object explains itself offline.',
    license: 'Project demonstration asset', license_url: 'Not applicable',
    sha256: sha(bytes),
  }));
}

await put(join(PKG, 'metadata', 'asset-rights-ledger.json'), json(ledger));

/* ------------------------------------------------------- accessibility meta */

await put(join(PKG, 'metadata', 'accessibility.json'), json({
  schema_version: '2.0.0',
  reduced_motion: 'Authored as a separate edit: the camera holds one composed still per beat and transitions become dissolves. The plate still resonates and the lyric still deposits.',
  high_contrast: 'Raises separation and lifts the floor without changing composition. Captions gain an opaque backing.',
  captions: 'Meaningful non-musical sound and every written line are captioned in the frame and listed in the utility sheet.',
  screen_reader: 'A scene description is announced at every cue boundary. Conventional focusable controls are always present even when visual chrome is hidden.',
  keyboard: {
    'Space': 'pause and resume',
    'Escape': 'close the utility sheet',
    'Arrow keys': 'aim attention',
    'Enter': 'hold to press a line deeper',
    'Tab': 'reach every control',
  },
  colour_independence: 'No essential information is carried only by colour, motion or spatial audio.',
  essential_mode: 'A Canvas 2D and semantic-text stage driven by the same clock, the same cue engine and the same standing-wave solution. Selected automatically when WebGL is unavailable or lost.',
  lyric_access: 'The lyric is live document text, not an image of text.',
}));

/* ---------------------------------------------------------------- manifest */

const manifest = JSON.parse(await readFile(join(PKG, 'manifest.json'), 'utf8'));
manifest.experience = {
  entry: 'experience.html',
  schema: '4.0.0',
  template: 'transcendence-sonic-terrain-1.0',
  type: 'sonic-terrain',
  default_mode: 'world',
  fallback_mode: 'essential',
  timeline: 'timeline/transcendence.timeline.json',
  analysis: 'analysis/track-01.analysis.json',
  reduced_motion_supported: true,
  navigation: 'music-directed',
  clock: 'audio.currentTime',
  quality_profiles: ['cinematic', 'balanced', 'lite', 'essential'],
  authored_arc: { track_id: SLICE.track, start_seconds: SLICE.start, end_seconds: SLICE.end },
};
manifest.extensions = manifest.extensions || {};
manifest.extensions['org.noizes.immersive'] = { version: '1.0.0', stage: 'transcendence-sonic-terrain' };
manifest.created_at = new Date().toISOString();

const componentFor = path => manifest.components.find(component => component.path === path);
// `type` is the media type and `role` is what the file does. The terrain is
// both an image and the analysis, and the inventory should say so honestly.
const typeFor = path => /\.(png|jpe?g|webp)$/i.test(path) ? 'image'
  : path.endsWith('.md') ? 'document'
  : path.startsWith('timeline/') ? 'timeline'
  : path.startsWith('analysis/') ? 'analysis'
  : path.endsWith('.json') ? 'metadata' : 'experience';
const roleFor = path => path === 'analysis/track-01.terrain.png' ? 'sonic_terrain'
  : path === 'experience.html' ? 'transcendence_runtime'
  : path.startsWith('timeline/') ? 'authored_sequence'
  : path.startsWith('analysis/') ? 'deterministic_music_analysis'
  : path.startsWith('assets/images/') ? 'procedural_texture'
  : path.startsWith('assets/documents/') ? 'creative_direction' : 'metadata';

async function refresh(path) {
  const bytes = await readFile(join(PKG, path));
  let component = componentFor(path);
  if (!component) {
    component = {
      component_id: `component-${manifest.components.length + 1}`,
      scope: 'release',
      type: typeFor(path),
      role: roleFor(path),
      path,
    };
    manifest.components.push(component);
  }
  component.size = bytes.length;
  component.sha256 = sha(bytes);
  return component;
}

await refresh('experience.html');
for (const [, to] of TEXTURES) await refresh(`assets/images/${to}`);
await refresh('analysis/track-01.analysis.json');
await refresh('analysis/track-01.terrain.png');
await refresh('timeline/transcendence.timeline.json');
for (const file of docs) await refresh(`assets/documents/${file}`);
await refresh('metadata/accessibility.json');
await refresh('metadata/asset-rights-ledger.json');
await put(join(PKG, 'manifest.json'), json(manifest));

/* ------------------------------------------------------------ authenticity */

const inventory = manifest.components.map(c => `${c.path}:${c.sha256}:${c.size}`).sort().join('\n');
await put(join(PKG, 'authenticity.json'), json({
  method: 'sha256-component-inventory',
  hash: sha(Buffer.from(inventory)),
  signed: false,
  release_id: manifest.release.release_id,
  edition_id: EDITION_ID,
  development_signature: {
    status: 'placeholder',
    statement: 'This build is unsigned. No production signing key exists in this repository and none was fabricated. The component inventory hash above is the only integrity claim made.',
  },
  source_recording: {
    path: 'audio/track-01.mp3',
    sha256: analysis.source.sha256,
    statement: 'The analysis payload shipped in this package was computed from exactly this file.',
  },
  components: manifest.components.map(({ component_id, path, sha256, size }) => ({ component_id, path, sha256, size })),
}));

/* --------------------------------------------------------------- archive */

const archive = JSON.parse(await readFile(join(PKG, 'archive.json'), 'utf8'));
archive.package_contents = manifest.components;
archive.transcendence = {
  edition_id: EDITION_ID,
  scope: `Track one, 00:00–${String(Math.floor(SLICE.end / 60))}:${String(SLICE.end % 60).padStart(2, '0')}`,
  status: 'flagship demonstration edition',
  clock: 'audio.currentTime',
  determinism: 'World state is a pure function of the playhead.',
};
await put(join(PKG, 'archive.json'), json(archive));

const history = JSON.parse(await readFile(join(PKG, 'history.json'), 'utf8'));
if (Array.isArray(history.events)) {
  history.events.push({
    at: new Date().toISOString(),
    type: 'edition.built',
    edition_id: EDITION_ID,
    note: 'Transcendence Edition built additively from the Guided base. No previous edition was modified.',
  });
  await put(join(PKG, 'history.json'), json(history));
  await refresh('history.json');
  await put(join(PKG, 'manifest.json'), json(manifest));
}

await put(join(PKG, 'README-OFFLINE.txt'),
`NOIZES · TRANSCENDENCE EDITION — "The Standing Wave"
Home, Sweet Home · Harry Macdonough with Charles D'Almaine · Victor, 23 January 1902

Open the intact .nz in the Noizes viewer. No network connection is required, and
none is possible: the experience declares connect-src 'none'.

WHAT THIS IS
  A 104-second authored arc that puts you inside the act of recording. In 1902
  there was no microphone: the singer's voice moved a diaphragm, and the
  diaphragm dragged a stylus through wax. This edition reverses that. You stand
  above the diaphragm while the record is being cut, the sung lines settle out
  of the dust onto the plate, and at the climax you pass through the diaphragm
  and find those same lines cut into the groove from below.

HOW TO BEGIN
  Press and hold anywhere to lower the stylus. That one gesture starts the
  recording. Everything conventional — pause, position, volume, captions, the
  lyric, quality, accessibility and credits — is behind the single control in
  the top corner, which appears whenever you move.

BEING PRESENT
  Aim your attention with the pointer or the arrow keys. Hold still and the dust
  settles further. Hold Enter while a line is being written and it is pressed
  deeper — which changes only the artefact you are left with at the end, never
  the recording or the sequence.

ACCESSIBILITY
  Reduced motion is a different edit, not a switched-off one. Essential mode
  keeps the whole arc without a GPU. The lyric is real text. Every control is
  reachable by keyboard and announced to a screen reader.

RIGHTS
  The recording is public domain in the United States (Library of Congress,
  National Jukebox). Every texture in this package was generated by the build
  script from a fixed seed; no third-party image is included. This edition is a
  DEMONSTRATION and is NOT CLEARED FOR COMMERCIAL DISTRIBUTION.
  Full provenance: metadata/asset-rights-ledger.json

INTEGRITY
  This build is UNSIGNED. No production signing key exists in this repository
  and none was fabricated. See authenticity.json.
`);
await refresh('README-OFFLINE.txt');
await refresh('edition.json');
await refresh('experience.json');
await refresh('technical.json');
await refresh('archive.json');
await put(join(PKG, 'manifest.json'), json(manifest));

// The inventory hash covers the manifest's own component list, so it is
// recomputed once every component is final.
const finalInventory = manifest.components.map(c => `${c.path}:${c.sha256}:${c.size}`).sort().join('\n');
const authenticity = JSON.parse(await readFile(join(PKG, 'authenticity.json'), 'utf8'));
authenticity.hash = sha(Buffer.from(finalInventory));
authenticity.components = manifest.components.map(({ component_id, path, sha256, size }) => ({ component_id, path, sha256, size }));
await put(join(PKG, 'authenticity.json'), json(authenticity));

/* -------------------------------------------------------------------- zip */

await mkdir(dirname(OUT), { recursive: true });
await rm(OUT, { force: true });
execFileSync('zip', ['-q', '-r', '-X', OUT, '.'], { cwd: PKG });

const packed = await stat(OUT);
const group = new Map();
for (const component of manifest.components) {
  const key = component.path.split('/')[0].includes('.') ? 'root descriptors' : component.path.split('/')[0];
  group.set(key, (group.get(key) || 0) + component.size);
}
log(`\nBuilt ${OUT}`);
log(`  package ${(packed.size / 1024 / 1024).toFixed(2)} MB compressed · ${manifest.components.length} components · ${ledger.length} rights records`);
for (const [key, size] of [...group].sort((a, b) => b[1] - a[1])) {
  log(`    ${key.padEnd(20)} ${(size / 1024 / 1024).toFixed(2)} MB uncompressed`);
}
