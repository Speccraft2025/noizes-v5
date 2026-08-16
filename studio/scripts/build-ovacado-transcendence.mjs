// Builds the Transcendence edition of Ovacado.
//
// This is a CLI script that mirrors what the Studio browser pipeline does, but
// runs in Node.js using ffmpeg for audio decode instead of OfflineAudioContext.
//
// Usage: node scripts/build-ovacado-transcendence.mjs <path-to-nz-package>

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, cp, rm, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDIO = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const SRC = join(STUDIO, 'src', 'lib');
const RUNTIME_SOURCE = join(SRC, 'experiences', 'transcendence');

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const exists = async path => { try { await access(path); return true; } catch { return false; } };
const put = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); };

// ------------------------------------------------------------------ sources

const BAKE = process.argv[2];
if (!BAKE) {
  console.error('Usage: node scripts/build-ovacado-transcendence.mjs <path-to-extracted-nz>');
  process.exit(1);
}

const TRACK_DIR = join(BAKE, 'tracks', '01-2aa894a6-0458-4c9c-beb7-24b6ab9b2aa0');
const AUDIO_PATH = join(TRACK_DIR, 'audio', 'primary.mp3');
const TRACK_JSON = JSON.parse(await readFile(join(TRACK_DIR, 'track.json'), 'utf8'));
const LYRICS_JSON = JSON.parse(await readFile(join(TRACK_DIR, 'lyrics', 'lyrics.json'), 'utf8'));
const MANIFEST = JSON.parse(await readFile(join(BAKE, 'manifest.json'), 'utf8'));
const EDITION_JSON = JSON.parse(await readFile(join(BAKE, 'edition.json'), 'utf8'));

const OUT_DIR = join(STUDIO, 'build', 'Ovacado-Transcendence');
const OUT_NZ = join(STUDIO, 'dist', 'Ovacado-Transcendence.nz');

console.log(`\nBuilding Transcendence for: ${TRACK_JSON.title} by ${TRACK_JSON.primary_artist}`);
console.log(`  Duration: ${(TRACK_JSON.duration_ms / 1000).toFixed(1)}s`);
console.log(`  Lyrics: ${LYRICS_JSON.timed_lines.length} lines\n`);

// ----------------------------------------------------------- audio decode

const SAMPLE_RATE = 22050;
const FFT_SIZE = 2048;
const HOP = 512;

console.log('· decoding audio via ffmpeg');
function decodePcm(path) {
  const raw = execFileSync('ffmpeg', [
    '-v', 'error', '-i', path,
    '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', '-acodec', 'pcm_f32le', '-',
  ], { maxBuffer: 1 << 30 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}

const samples = decodePcm(AUDIO_PATH);
const duration = samples.length / SAMPLE_RATE;
console.log(`  ${duration.toFixed(2)}s · ${samples.length} samples at ${SAMPLE_RATE} Hz`);

// ----------------------------------------------------------- terrain analysis

console.log('· running terrain analysis');
const { analyseSamples, MEL_BANDS, SAMPLE_RATE: SR } = await import(
  join(SRC, 'analysis', 'terrain.js')
);

const { terrainRGBA, width, height, analysis } = analyseSamples(samples, {
  sampleRate: SAMPLE_RATE,
  source: {
    path: 'audio/primary.mp3',
    title: TRACK_JSON.title,
    performer: TRACK_JSON.primary_artist,
    sha256: sha(await readFile(AUDIO_PATH)),
    bytes: (await readFile(AUDIO_PATH)).length,
  },
  producedBy: 'studio-cli-transcendence',
});

console.log(`  terrain: ${width}x${height} (${width} frames × ${MEL_BANDS} bands)`);
console.log(`  ${analysis.onsets.length} onsets · ${analysis.phrases.length} phrases · ${analysis.sections.length} sections`);
console.log(`  vocal phrases: ${analysis.vocal_phrases.length}`);

// ----------------------------------------------------------- encode terrain PNG

console.log('· encoding terrain PNG');
const { encodePng } = await import(join(SRC, 'analysis', 'encodePng.js'));
const terrainPng = await encodePng(width, height, terrainRGBA);
console.log(`  ${(terrainPng.length / 1024).toFixed(0)} KB`);

// ----------------------------------------------------------- lyric landmarks

console.log('· building lyric landmarks');
const { buildLyricLines } = await import(
  join(SRC, 'experiences', 'transcendence', 'landmarks.js')
);

const bandCentresHz = analysis.parameters?.terrain?.band_centres_hz ?? [];
const timedLines = LYRICS_JSON.timed_lines;
const landmarks = timedLines.map((line, index) => ({
  line: index,
  time: (line.t || 0) / 1000,
  band: Math.round((bandCentresHz.length - 1) * 0.45),
}));

const lyrics = buildLyricLines({
  timedLines,
  landmarks,
  bandCentresHz,
  durationSeconds: duration,
});
const shipped = { ...analysis, lyrics };
console.log(`  ${lyrics.length} lyric lines placed`);

// ----------------------------------------------------------- sequence

console.log('· generating sequence');
const { generateSequence } = await import(
  join(SRC, 'experiences', 'transcendence', 'sequence.js')
);

const arcEnd = duration;
const { cues, snapped } = generateSequence({
  analysis: shipped,
  landmarks: lyrics.map((line, index) => ({
    line: index,
    time: line.aligned_seconds,
    band: line.terrain_band,
  })),
  arcEndSeconds: arcEnd,
});
console.log(`  ${cues.length} cues · ${snapped} snapped to measured events`);

// ----------------------------------------------------------- assemble package

console.log('· assembling package');
await rm(OUT_DIR, { recursive: true, force: true });

// Copy the base package structure from the bake
await cp(BAKE, OUT_DIR, { recursive: true });

// Write terrain and analysis as components
await put(join(OUT_DIR, 'analysis', 'track-01.terrain.png'), terrainPng);
await put(join(OUT_DIR, 'analysis', 'track-01.analysis.json'), json(shipped));

// ----------------------------------------------------------- build the document

console.log('· building experience document');
const { fillMarkers, escapeJsonPayload, escapeHtml, audioSourceTags, timecode } = await import(
  join(SRC, 'experiences', 'transcendence', 'markers.js')
);

const templateHtml = await readFile(join(SRC, 'templates', 'TRANSCENDENCE.html'), 'utf8');
const styles = await readFile(join(RUNTIME_SOURCE, 'styles.css'), 'utf8');

const RUNTIME_MODULES = [
  '01-prelude.js', '02-analysis.js', '03-clock.js', '04-sequence.js', '05-shaders.js',
  '06-landmarks.js', '07-world.js', '08-camera.js', '09-audio.js', '10-essential.js',
  '11-systems.js', '12-app.js',
];
const runtime = (await Promise.all(
  RUNTIME_MODULES.map(async file =>
    `\n/* ==== ${file} ==== */\n` + await readFile(join(RUNTIME_SOURCE, 'runtime', file), 'utf8')
  ),
)).join('\n');

const title = TRACK_JSON.title;
const artist = TRACK_JSON.primary_artist;

const config = {
  version: '1.0.0',
  slice: { track: TRACK_JSON.track_id, start: 0, end: Number(arcEnd.toFixed(3)) },
  assets: {
    terrain: 'analysis/track-01.terrain.png',
    dustGrain: '',
    blueNoise: '',
  },
  artDirection: {
    heightScale: 1,
    ridgeEmphasis: 1,
    timeScale: 1,
    terracing: true,
    terraceStep: 1.5,
    palette: 'alabaster',
    sunElevation: 64.32,
    sunAzimuth: -146.31,
    flightAltitude: 1,
  },
};

const edition = {
  edition_id: EDITION_JSON.edition_id || 'ovacado-transcendence-001',
  name: EDITION_JSON.edition_name || 'First Edition',
  copy: EDITION_JSON.edition_size ? `001 / ${EDITION_JSON.edition_size}` : '',
  release_id: MANIFEST.release?.release_id || '',
  principle: 'Audio supplies the terrain. Analysis supplies the physics. The artist supplies the meaning. Nothing in this landscape was modelled: it is the measured shape of the recording, flown through in sync with its own playback.',
};

const debugPanel = `<section id="debug" hidden aria-label="Developer cue inspector">
    <div class="debug-jumps"></div>
    <label>Time <input id="debug-time" type="range" min="0" max="${Number(arcEnd.toFixed(2))}" step="0.05" value="0"></label>
    <output id="debug-output"></output>
  </section>`;

const html = fillMarkers(templateHtml, {
  css: styles,
  three: '', gsap: '',
  runtime,
  analysis: escapeJsonPayload(shipped),
  edition: escapeJsonPayload(edition),
  config: escapeJsonPayload(config),
  sequence: escapeJsonPayload(cues),
  debugPanel,
  title: escapeHtml(title),
  subtitle: 'Sonic Terrain',
  credit: escapeHtml(artist),
  durationLabel: timecode(arcEnd),
  arcEnd: String(Number(arcEnd.toFixed(2))),
  thresholdTitle: escapeHtml(`${title} — ${artist}`),
  thresholdAction: 'Press and hold to enter the recording',
  thresholdHint: 'Below you is the whole track: time runs to the horizon, frequency runs left to right, elevation is loudness. Holding the gesture begins the flight.',
  openingTitle: 'The sealed object',
  openingScene: 'The whole recording lies below in the dark, unlit and untravelled.',
  lyricProvenance: 'Each line was placed on the terrain by the artist, at a time and a frequency band of their choosing. The terrain itself is measured from the recording; where the words sit on it is an authored decision, recorded as such in the package\'s analysis file.',
  audioSources: audioSourceTags([
    { src: `tracks/01-${TRACK_JSON.track_id}/audio/primary.mp3`, type: 'audio/mpeg' },
  ]),
});

await put(join(OUT_DIR, 'experience.html'), html);

// ----------------------------------------------------------- timeline

console.log('· writing timeline');
const cueTimes = cues.map(({ time, id, phase, shot }) => ({ time, id, phase, shot }));
await put(join(OUT_DIR, 'timeline', 'transcendence.timeline.json'), json({
  schema_version: '1.0.0',
  master_clock: 'audio.currentTime',
  track_id: TRACK_JSON.track_id,
  range_seconds: [0, arcEnd],
  reconstruction: 'Reduce the authored sequence from the beginning at every frame.',
  determinism: 'Every particle position is f(seed, audioTime) with no integration.',
  measured_anchors: {
    statement: 'Cue times are snapped to the nearest measured musical event where one is close enough.',
    section_boundaries: analysis.sections,
  },
  cues: cueTimes,
}));

// ----------------------------------------------------------- update descriptors

console.log('· updating manifest and descriptors');

const manifest = JSON.parse(await readFile(join(OUT_DIR, 'manifest.json'), 'utf8'));
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
  authored_arc: { track_id: TRACK_JSON.track_id, start_seconds: 0, end_seconds: arcEnd },
};
manifest.created_at = new Date().toISOString();

// Add terrain and analysis as components
const experienceBytes = await readFile(join(OUT_DIR, 'experience.html'));
const terrainBytes = await readFile(join(OUT_DIR, 'analysis', 'track-01.terrain.png'));
const analysisBytes = Buffer.from(json(shipped));

const addComponent = (path, type, role, bytes) => {
  const existing = manifest.components.find(c => c.path === path);
  const entry = {
    component_id: existing?.component_id || `component-transcendence-${manifest.components.length + 1}`,
    scope: 'release',
    type,
    role,
    path,
    size: bytes.length,
    sha256: sha(bytes),
  };
  if (existing) Object.assign(existing, entry);
  else manifest.components.push(entry);
};

addComponent('experience.html', 'experience', 'transcendence_runtime', experienceBytes);
addComponent('analysis/track-01.terrain.png', 'image', 'sonic_terrain', terrainBytes);
addComponent('analysis/track-01.analysis.json', 'analysis', 'deterministic_music_analysis', analysisBytes);

const timelineBytes = Buffer.from(json({
  schema_version: '1.0.0', master_clock: 'audio.currentTime',
  track_id: TRACK_JSON.track_id, range_seconds: [0, arcEnd],
}));
addComponent('timeline/transcendence.timeline.json', 'timeline', 'authored_sequence', timelineBytes);

await put(join(OUT_DIR, 'manifest.json'), json(manifest));

// Authenticity
const inventory = manifest.components.map(c => `${c.path}:${c.sha256}:${c.size}`).sort().join('\n');
await put(join(OUT_DIR, 'authenticity.json'), json({
  method: 'sha256-component-inventory',
  hash: sha(Buffer.from(inventory)),
  signed: false,
  release_id: manifest.release?.release_id || '',
  edition_id: edition.edition_id,
  components: manifest.components.map(({ component_id, path, sha256, size }) => ({ component_id, path, sha256, size })),
}));

// Experience descriptor
await put(join(OUT_DIR, 'experience.json'), json({
  schema_version: '4.0.0',
  type: 'sonic-terrain',
  entry: 'experience.html',
  default_mode: 'world',
  fallback_mode: 'essential',
  reduced_motion_supported: true,
  high_contrast_supported: true,
  timeline: 'timeline/transcendence.timeline.json',
  analysis: 'analysis/track-01.analysis.json',
  scope: `${arcEnd.toFixed(0)}-second authored arc`,
  quality_profiles: ['cinematic', 'balanced', 'lite', 'essential'],
  clock: 'audio.currentTime is the only authored clock',
  principle: edition.principle,
}));

// ----------------------------------------------------------- zip

console.log('· creating .nz package');
await mkdir(dirname(OUT_NZ), { recursive: true });
try { await rm(OUT_NZ, { force: true }); } catch {}
execFileSync('zip', ['-q', '-r', '-X', OUT_NZ, '.'], { cwd: OUT_DIR });

const { size } = await import('node:fs').then(fs => fs.statSync(OUT_NZ));
console.log(`\n✓ Built ${OUT_NZ}`);
console.log(`  ${(size / 1024 / 1024).toFixed(2)} MB · ${manifest.components.length} components`);
console.log(`  ${cues.length} cues · ${snapped} measured anchors · ${lyrics.length} lyric landmarks`);
console.log(`  terrain: ${width}×${height} · palette: alabaster`);
