// Emits src/lib/templates/TRANSCENDENCE.html: the Transcendence document with
// Three.js and GSAP inlined from node_modules, every other marker left intact for
// `buildTranscendenceHTML()` to fill at export time.
//
// Why a prebuild rather than doing this at export time: converting Three's ESM
// distribution into a package-local global is regex surgery on 740 KB of minified
// code. It is deterministic, but it should fail on a developer's machine when
// Three changes shape — not in a creator's browser halfway through an export.
//
//   npm run build:transcendence-template
//
// The output is committed, like ULTRA.html, so `npx vitest` and `vite dev` work
// on a fresh clone without a generate step. TRANSCENDENCE.versions.json records
// what went in; a test fails if it drifts from package.json.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDIO = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const SOURCE = join(STUDIO, 'src', 'lib', 'experiences', 'transcendence');
const TEMPLATE_OUT = join(STUDIO, 'src', 'lib', 'templates', 'TRANSCENDENCE.html');
const VERSIONS_OUT = join(STUDIO, 'src', 'lib', 'templates', 'TRANSCENDENCE.versions.json');

/* Three.js ships as ES modules that import each other by relative path. The
 * exported package has no module resolver and no network, so both files are
 * converted into one script that installs a package-local global. */
function toGlobalNamespace(source) {
  const match = source.match(/export\{([^}]*)\};?\s*$/);
  if (!match) throw new Error('Unable to convert the Three.js export block — its distribution shape changed.');
  const entries = match[1].split(',').map((entry) => {
    const parts = entry.trim().split(/\s+as\s+/);
    return `${JSON.stringify(parts[1] || parts[0])}:${parts[0]}`;
  });
  return { body: source.slice(0, match.index), object: entries.join(',') };
}

async function buildThreeBundle() {
  const base = join(STUDIO, 'node_modules', 'three', 'build');
  let core = await readFile(join(base, 'three.core.min.js'), 'utf8');
  let main = await readFile(join(base, 'three.module.min.js'), 'utf8');

  const coreExport = toGlobalNamespace(core);
  core = `(()=>{${coreExport.body}window.__THREE_CORE__={${coreExport.object}};})();`;

  const coreImport = main.match(/import\{([^}]*)\}from"\.\/three\.core\.min\.js";/);
  if (!coreImport) throw new Error('Unable to convert the Three.js core import — its distribution shape changed.');
  const destructured = coreImport[1].split(',').map((entry) => {
    const parts = entry.trim().split(/\s+as\s+/);
    return parts.length === 2 ? `${parts[0]}:${parts[1]}` : parts[0];
  }).join(',');
  main = main
    .replace(coreImport[0], `const{${destructured}}=window.__THREE_CORE__;`)
    .replace(/export\{[^}]*\}from"\.\/three\.core\.min\.js";/, '');

  const mainExport = toGlobalNamespace(main);
  const version = JSON.parse(await readFile(join(STUDIO, 'node_modules', 'three', 'package.json'), 'utf8')).version;
  return {
    version,
    code: core + mainExport.body
      + `window.THREE=Object.assign(window.__THREE_CORE__,{${mainExport.object}});delete window.__THREE_CORE__;`,
  };
}

const three = await buildThreeBundle();
const gsapDir = join(STUDIO, 'node_modules', 'gsap');
const gsap = await readFile(join(gsapDir, 'dist', 'gsap.min.js'), 'utf8');
const gsapVersion = JSON.parse(await readFile(join(gsapDir, 'package.json'), 'utf8')).version;

const document = await readFile(join(SOURCE, 'experience.html'), 'utf8');
for (const token of ['/* THREE_RUNTIME */', '/* GSAP_RUNTIME */']) {
  if (!document.includes(token)) throw new Error(`experience.html no longer declares ${token}`);
}

// split/join, never replace: minified code is full of `$&` and `$1`.
const html = document
  .split('/* THREE_RUNTIME */').join(three.code)
  .split('/* GSAP_RUNTIME */').join(gsap);

await mkdir(dirname(TEMPLATE_OUT), { recursive: true });
await writeFile(TEMPLATE_OUT, html);
await writeFile(VERSIONS_OUT, JSON.stringify({
  generated_by: 'studio/scripts/build-transcendence-template.mjs',
  three: three.version,
  gsap: gsapVersion,
  note: 'Regenerate with `npm run build:transcendence-template` after changing either dependency.',
}, null, 2) + '\n');

const kb = (html.length / 1024).toFixed(0);
console.log(`TRANSCENDENCE.html → ${kb} KB (three ${three.version}, gsap ${gsapVersion})`);
