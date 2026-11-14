// Runs the project's own validator and viewer preparation (studio/src/lib) against the built .nz,
// then checks the things specific to this release: three playable tracks, byte-identical masters, no network references.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, ''), STUDIO = join(ROOT, '..', '..', 'studio');
const NZ = join(ROOT, 'dist', 'The-House-That-Remembered-Us-Rooms.nz');
const JSZip = createRequire(join(STUDIO, 'package.json'))('jszip');
const { validateNzArchive } = await import(pathToFileURL(join(STUDIO, 'src/lib/domain/package-validation.js')));
const { prepareNzForViewer } = await import(pathToFileURL(join(STUDIO, 'src/lib/utils/viewer.js')));
const bytes = await readFile(NZ), zip = await JSZip.loadAsync(bytes), errors = [];
const result = await validateNzArchive(zip);
for (const c of result.checks) console.log(`${c.status.toUpperCase().padEnd(4)} ${c.label} — ${c.note}`);
if (!result.valid) errors.push('project validator reported failures');
const prepared = await prepareNzForViewer(bytes, { storage: null });
const cfg = JSON.parse(await readFile(join(ROOT, 'release.json'), 'utf8')), manifest = result.manifest;
if (manifest.tracks.length !== cfg.tracks.length) errors.push(`expected ${cfg.tracks.length} tracks, found ${manifest.tracks.length}`);
for (const [i, t] of manifest.tracks.entries()) {
  const comp = manifest.components.find((c) => c.component_id === t.primary_audio_component);
  const source = await readFile(join(ROOT, 'source-audio', cfg.tracks[i].file));
  if (createHash('sha256').update(source).digest('hex') !== comp.sha256) errors.push(`${t.title}: packaged audio differs from the supplied file`);
  if (!prepared.resources.some((r) => r.path === comp.path && /^audio\//.test(r.mime))) errors.push(`${t.title}: viewer would not receive ${comp.path}`);
  if (!prepared.html.includes(`"${comp.path}"`)) errors.push(`${t.title}: experience does not reference ${comp.path}`);
  console.log(`TRACK ${t.track_number} ${t.title} · ${(t.duration_ms / 1000).toFixed(1)}s · ${comp.path} · identical to source`);
}
const html = await zip.file('experience.html').async('string');
const urls = [...html.matchAll(/["'(](https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^"')\s]*/gi)].map((m) => m[0]).filter((u) => !/w3\.org|threejs\.org|github\.com|mozilla\.org|khronos\.org|wikipedia\.org|jcgt\.org|example\.com|youtube-nocookie\.com/i.test(u));
if (/<(?:script|link|img|audio|video|iframe)\b[^>]+(?:src|href)=["'](?:https?:)?\/\//i.test(html)) errors.push('experience.html loads a remote resource');
if (/\bfetch\s*\(\s*["']https?:|XMLHttpRequest\(\)\.open\(["'][A-Z]+["'],\s*["']https?:/.test(html)) errors.push('experience.html fetches a remote URL');
if (!/connect-src 'none'/.test(html)) errors.push('missing connect-src none policy');
// the one permitted network origin: the YouTube player, opened only when the listener taps a room's screen
const frames = [...html.matchAll(/frame-src ([^;"]+)/g)].map((m) => m[1].trim());
if (frames.some((f) => f !== 'https://www.youtube-nocookie.com')) errors.push(`unexpected frame-src: ${frames.join(', ')}`);
if (frames.length) console.log(`online video: frame-src limited to ${frames[0]} (tap-to-play only; songs and house stay offline)`);
if (urls.length) console.log(`note: ${urls.length} URL-like string(s) inside the bundled runtime (comments/namespaces, never requested): ${[...new Set(urls)].slice(0, 4).join(' ')}`);
if (errors.length) { console.error('\nINVALID\n' + errors.join('\n')); process.exit(1); }
console.log(`\nVALID · ${result.summary.passed} passed · ${result.summary.warned} warnings · ${result.summary.failed} failed · viewer resources: ${prepared.resources.length} · ${(bytes.length / 1048576).toFixed(1)} MB`);
