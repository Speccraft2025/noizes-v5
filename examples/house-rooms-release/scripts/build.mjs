// Builds build/<name>/ and dist/<name>.nz from src/, release.json, source-audio/ and analysis/analysis.json.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const NAME = 'The-House-That-Remembered-Us-Rooms';
const PKG = join(ROOT, 'build', NAME), OUT = join(ROOT, 'dist', `${NAME}.nz`);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const json = (v) => JSON.stringify(v, null, 2) + '\n';
const put = async (p, v) => { await mkdir(dirname(p), { recursive: true }); await writeFile(p, v); };
const cfg = JSON.parse(await readFile(join(ROOT, 'release.json'), 'utf8'));
if (!existsSync(join(ROOT, 'analysis', 'analysis.json'))) execFileSync('node', [join(ROOT, 'scripts', 'analyze.mjs')], { stdio: 'inherit' });
const analysis = JSON.parse(await readFile(join(ROOT, 'analysis', 'analysis.json'), 'utf8'));

await rm(PKG, { recursive: true, force: true }); await mkdir(join(PKG, 'audio'), { recursive: true });

// --- Three.js: converted from the repository's local ESM build to an inline global (same approach as the reference album) ---
const threeDir = join(ROOT, '..', '..', 'studio', 'node_modules', 'three');
const threeVersion = JSON.parse(await readFile(join(threeDir, 'package.json'), 'utf8')).version;
const exportObject = (source) => { const m = source.match(/export\{([^}]*)\};?\s*$/); if (!m) throw new Error('Unable to convert local Three.js export'); const object = m[1].split(',').map((e) => { const p = e.trim().split(/\s+as\s+/); return `${JSON.stringify(p[1] || p[0])}:${p[0]}`; }).join(','); return { body: source.slice(0, m.index), object }; };
let core = await readFile(join(threeDir, 'build', 'three.core.min.js'), 'utf8'), three = await readFile(join(threeDir, 'build', 'three.module.min.js'), 'utf8');
const coreExport = exportObject(core); core = `(()=>{${coreExport.body}window.__THREE_CORE__={${coreExport.object}};})();`;
const coreImport = three.match(/import\{([^}]*)\}from"\.\/three\.core\.min\.js";/); if (!coreImport) throw new Error('Unable to convert local Three.js core import');
const destructured = coreImport[1].split(',').map((e) => { const p = e.trim().split(/\s+as\s+/); return p.length === 2 ? `${p[0]}:${p[1]}` : p[0]; }).join(',');
three = three.replace(coreImport[0], `const{${destructured}}=window.__THREE_CORE__;`).replace(/export\{[^}]*\}from"\.\/three\.core\.min\.js";/, '');
const threeExport = exportObject(three);
const threeRuntime = (core + `(()=>{${threeExport.body}window.THREE=Object.assign(window.__THREE_CORE__,{${threeExport.object}});delete window.__THREE_CORE__;})();`).replace(/<\/script/gi, '<\\/script');

// --- tracks ---
const tracks = [], components = []; let n = 0;
const component = async (fields, path) => { const b = await readFile(join(PKG, path)); const c = { component_id: `component-${++n}`, ...fields, path, size: b.length, sha256: sha(b) }; components.push(c); return c; };
const runtimeTracks = [];
for (const [i, t] of cfg.tracks.entries()) {
  const id = `track-${String(i + 1).padStart(2, '0')}`, ext = t.file.split('.').pop().toLowerCase(), path = `audio/${id}.${ext}`;
  await cp(join(ROOT, 'source-audio', t.file), join(PKG, path)); // the supplied master, byte for byte
  const a = analysis[t.file]; if (!a) throw new Error(`No analysis for ${t.file}; run scripts/analyze.mjs`);
  const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(PKG, path)]).toString().trim());
  const audio = await component({ scope: 'track', track_id: id, type: 'audio', role: 'primary_master', mime: ({ mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4' })[ext] }, path);
  tracks.push({ track_id: id, disc_number: 1, track_number: i + 1, position: i + 1, title: t.title, primary_artist: t.artist || cfg.primary_artist || '', primary_audio_component: audio.component_id, duration_ms: Math.round(duration * 1000), hidden: false, bonus: false, room: t.room });
  runtimeTracks.push({ id, key: `${id}:${audio.sha256.slice(0, 8)}`, screen: t.screen || null, title: t.title, artist: t.artist || cfg.primary_artist || '', src: path, duration: Math.round(duration * 100) / 100, bpm: a.bpm_estimate, onset: a.percussion_onset_s || 0, rises: a.energy_rises.map((r) => r.t), drops: a.energy_drops.map((r) => r.t), energy: a.energy_1s.map((v) => Math.round(v * 100) / 100) });
}
await put(join(PKG, 'analysis', 'analysis.json'), json(Object.fromEntries(cfg.tracks.map((t, i) => [tracks[i].track_id, { source_file: t.file, room: t.room, ...analysis[t.file] }]))));
await component({ scope: 'release', type: 'analysis', role: 'audio_analysis' }, 'analysis/analysis.json');
if (cfg.cover_source) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(ROOT, cfg.cover_source), '-vf', 'crop=ih:ih,scale=1000:1000', '-q:v', '3', join(PKG, 'cover.jpg')]);
  await component({ scope: 'release', type: 'image', role: 'cover_artwork', mime: 'image/jpeg' }, 'cover.jpg');
}

// --- experience.html ---
const read = (f) => readFile(join(ROOT, 'src', f), 'utf8');
const runtime = (await Promise.all(['textures.js', 'world.js', 'post.js', 'matte.js', 'audio.js', 'app.js'].map(read))).join('\n');
const resumeKey = `nz-release-resume:${cfg.release_id}:${cfg.edition_id}:${cfg.copy_id}`;
const roomCount = (cfg.rooms && cfg.rooms.count) || runtimeTracks.length, assign = cfg.rooms && cfg.rooms.assign;
const rooms = Array.from({ length: roomCount }, (_, i) => ({ track: assign && assign[i] ? assign[i] - 1 : i % runtimeTracks.length }));
const config = { release: { id: cfg.release_id, title: cfg.title, artist: cfg.primary_artist || '' }, resumeKey, tracks: runtimeTracks, rooms, notes: cfg.notes || {}, eggs: cfg.eggs || [], frames: [] };
// corridor pictures: stills are scaled down; a GIF (or an 'animate' stand-in) becomes a 4x4 sheet of frames the house steps through
for (const [i, f] of (cfg.frames || []).entries()) {
  const tmp = join(ROOT, 'build', `frame-${i}.jpg`), src = join(ROOT, f.source), isGif = /\.gif$/i.test(f.source);
  if (f.animate || isGif) {
    const vf = isGif ? 'fps=6,scale=256:192:force_original_aspect_ratio=increase,crop=256:192,tile=4x4' : "zoompan=z='1+0.018*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=16:s=256x192:fps=6,tile=4x4";
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', vf, '-frames:v', '1', '-q:v', '4', tmp]);
    config.frames.push({ src: 'data:image/jpeg;base64,' + (await readFile(tmp)).toString('base64'), caption: f.caption || '', anim: { cols: 4, rows: 4, n: 16, fps: 6 } });
  } else {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `${f.crop ? `crop=${f.crop},` : ''}scale=640:480:force_original_aspect_ratio=increase,crop=640:480`, '-q:v', '4', tmp]);
    config.frames.push({ src: 'data:image/jpeg;base64,' + (await readFile(tmp)).toString('base64'), caption: f.caption || '' });
  }
  await rm(tmp);
}
// renditions projected at a stop are inlined as data URIs so they load inside the sandboxed viewer, over http and from file://
for (const [stop, m] of Object.entries(cfg.mattes || {})) {
  const tmp = join(ROOT, 'build', `matte-${stop}.jpg`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(ROOT, m.source), '-q:v', '3', tmp]);
  (config.mattes ||= {})[stop] = 'data:image/jpeg;base64,' + (await readFile(tmp)).toString('base64'); await rm(tmp);
}
const css = await read('styles.css');
let html = await read('experience.html');
html = html.replace('/* HOUSE_CSS */', () => css).replace('/* HOUSE_CONFIG */', () => JSON.stringify(config).replace(/</g, '\\u003c')).replace('/* THREE_RUNTIME */', () => threeRuntime).replace('/* HOUSE_RUNTIME */', () => runtime.replace(/<\/script/gi, '<\\/script'));
if (/<(?:script|link)\b[^>]+(?:src|href)=["']https?:\/\//i.test(html)) throw new Error('external runtime dependency');
await put(join(PKG, 'experience.html'), html);
await component({ scope: 'release', type: 'experience', role: 'house_rooms_runtime', mime: 'text/html' }, 'experience.html');

// --- release documents ---
const now = new Date().toISOString(), total = tracks.reduce((s, t) => s + t.duration_ms, 0);
const release = { release_id: cfg.release_id, release_type: 'ep', title: cfg.title, primary_artist: cfg.primary_artist || '', year: cfg.year, genre: [], language: [], track_count: tracks.length, disc_count: 1, total_duration_ms: total, description: cfg.description };
const inventory = components.map((c) => `${c.path}:${c.sha256}:${c.size}`).sort().join('\n');
await put(join(PKG, 'experience.json'), json({ schema_version: '4.0.0', type: 'house-rooms', entry: 'experience.html', release_id: cfg.release_id, default_mode: 'house', fallback_mode: 'simple-player', reduced_motion_supported: true, navigation: 'first-person, guided between stations', rooms: tracks.map((t) => ({ track_id: t.track_id, room: t.room })), analysis: 'analysis/analysis.json', interaction: { start: '"Enter house" unlocks audio in one gesture', movement: 'tap or click a door; drag or arrow keys to look', keyboard: '1-3 rooms, 0 corridor, Esc back, Space play/pause, T track list' } }));
await put(join(PKG, 'edition.json'), json({ edition_id: cfg.edition_id, name: 'Rooms test edition', copy: '001 / 001', purpose: 'Playable test of a house-as-tracklist release', transferable: false, demo_only: true, commercial_clearance: 'Test build. Not cleared for distribution.' }));
await put(join(PKG, 'rights.json'), json({ status: 'unreleased-test', statement: 'Recordings supplied by the release owner for a private test build. No licence is granted by this package.', credit_line: '' }));
await put(join(PKG, 'credits.json'), json({ records: [], tracks: tracks.map((t) => ({ track_id: t.track_id, linked_release_credit_ids: [] })), note: 'No credits were supplied with the audio files; none have been invented.' }));
await put(join(PKG, 'authenticity.json'), json({ method: 'sha256-component-inventory', hash: sha(Buffer.from(inventory)), signed: false, release_id: cfg.release_id, edition_id: cfg.edition_id, development_signature: { status: 'placeholder', statement: 'This build is unsigned. The component inventory hash above is the only integrity claim made.' } }));
await put(join(PKG, 'technical.json'), json({ packager: 'house-rooms builder 1.0.0', built_at: now, offline: true, network_capable: 'optional-video', online_media: (cfg.tracks.filter((t) => t.screen).map((t) => ({ track: t.title, provider: t.screen.provider, video_id: t.screen.video_id, loaded: 'only when the listener taps the screen', host: 'Noizes viewer media overlay, or the experience overlay when served directly' }))), content_security_policy: "default-src 'none'; frame-src https://www.youtube-nocookie.com; connect-src 'none'", runtime_dependencies: [{ name: 'Three.js', version: threeVersion, licence: 'MIT', delivery: 'converted from the local ESM distribution to an inline package-local global' }], renderer: 'WebGL via Three.js; all surface textures are generated on canvas at start-up, so the scene ships no image files', fonts: 'system font stacks only; none bundled', audio: tracks.map((t, i) => ({ track_id: t.track_id, path: runtimeTracks[i].src, delivery: 'supplied file, unmodified' })), fallback: 'Simple player: three native audio elements, one at a time' }));
await put(join(PKG, 'history.json'), json({ copy: { copy_id: cfg.copy_id, copy_number: 1 }, scope: 'release_copy', simulation: true }));
await put(join(PKG, 'archive.json'), json({ release, package_contents: components.map(({ component_id, type, role, path }) => ({ component_id, type, role, path })) }));
await put(join(PKG, 'manifest.json'), json({
  noizes_version: '1.0.0', format: 'noizes', format_version: '5.0', package_type: 'music_release', release,
  tracks: tracks.map(({ room, ...t }) => t), components: components.map((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined))),
  experience: { entry: 'experience.html', schema: '4.0.0', type: 'house-rooms', default_mode: 'house', fallback_mode: 'simple-player', reduced_motion_supported: true, navigation: 'first-person-guided' },
  edition: { path: 'edition.json', edition_id: cfg.edition_id, applies_to: 'release' }, authenticity: { path: 'authenticity.json', method: 'sha256-component-inventory' }, rights: { path: 'rights.json' }, archive: { path: 'archive.json', schema: '1.0.0' }, history: { path: 'history.json', scope: 'release_copy' },
  created_at: now, artist: cfg.primary_artist || '', title: cfg.title, release_id: cfg.release_id, year: cfg.year,
}));
await put(join(PKG, 'README-OFFLINE.txt'), `The House That Remembered Us — rooms test edition\n\nOpen this .nz in the Noizes viewer (/open), or unzip it, serve the folder with any static server and open experience.html.\nEverything needed is inside this package. Nothing is fetched from the network.\n`);
await mkdir(dirname(OUT), { recursive: true }); await rm(OUT, { force: true });
execFileSync('zip', ['-q', '-r', '-X', OUT, '.', '-x', '.DS_Store'], { cwd: PKG });
const size = (await readFile(OUT)).length;
console.log(`BUILT ${OUT}\n${tracks.length} tracks · ${components.length} components · experience.html ${(html.length / 1024).toFixed(0)} KB · package ${(size / 1048576).toFixed(1)} MB`);
