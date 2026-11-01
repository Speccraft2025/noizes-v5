// Emits src/lib/templates/JOURNEY.html: the Journey document with Three.js and
// GSAP inlined from node_modules, every other marker left intact for
// `buildJourneyHTML()` to fill at export time.
//
// Mirrors build-transcendence-template.mjs for the road experience system.
//
//   npm run build:journey-template

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDIO = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const SOURCE = join(STUDIO, 'src', 'lib', 'experiences', 'journey');
const TEMPLATE_OUT = join(STUDIO, 'src', 'lib', 'templates', 'JOURNEY.html');
const VERSIONS_OUT = join(STUDIO, 'src', 'lib', 'templates', 'JOURNEY.versions.json');

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

const html = document
  .split('/* THREE_RUNTIME */').join(three.code)
  .split('/* GSAP_RUNTIME */').join(gsap);

await mkdir(dirname(TEMPLATE_OUT), { recursive: true });
await writeFile(TEMPLATE_OUT, html);
await writeFile(VERSIONS_OUT, JSON.stringify({
  generated_by: 'studio/scripts/build-journey-template.mjs',
  three: three.version,
  gsap: gsapVersion,
  note: 'Regenerate with `npm run build:journey-template` after changing either dependency.',
}, null, 2) + '\n');

const kb = (html.length / 1024).toFixed(0);
console.log(`JOURNEY.html → ${kb} KB (three ${three.version}, gsap ${gsapVersion})`);
