// Builds the frame-review contact sheet from the captured frames.
// The sheet is a development artefact and is deliberately NOT included in the
// .nz release package.
//
//   node scripts/frame-review-transcendence.mjs

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const DIR = join(ROOT, 'screenshots', 'transcendence-review');
const OUT = join(DIR, 'index.html');

const CAPTIONS = {
  '00-sealed': ['—', 'Encounter · the sealed object', 'A 1902 disc at a grazing angle. The grooves are analytic, so they stay sharp at any distance; the diffraction band and the anisotropic sweep are the whole of the lighting. No hero heading, no play button.'],
  '01-announcer': ['0:02', 'The announcer', 'Before any music, a man in 1902 speaks the title into the horn. Each measured syllable onset pushes a ring of pressure through the dust. Nothing else exists yet.'],
  '02-law': ['0:06', 'The law is written', 'The violin’s first sustained tone gives the space its physics. The plate resolves out of the dark and the horn’s wall springs from its rim.'],
  '03-breathing': ['0:12', 'The plate begins to draw', 'Standing waves form nodal figures. Dust collects along the lines that are not moving — the recording drawing itself.'],
  '04-expanse': ['0:16', 'Expanse', 'Brightness peaks in the violin’s upper register and the world answers by becoming enormous.'],
  '05-voice-line1': ['0:20', 'The voice enters · lyric 1', 'Measured onset of the tenor’s first entry. The dust migrates into words lying in the plate’s plane, lit by the same single light, read in perspective.'],
  '06-line2': ['0:33', 'Lyric 2 · low traverse', 'The camera drops almost level with the surface. The line is read in steep foreshortening.'],
  '07-summit': ['0:37', 'Summit', 'The loudest frame of the passage. Plate amplitude peaks and the throat light flares. No shake, no burst — the world simply becomes more.'],
  '08-sustain': ['0:45', 'Sustain and drift', 'The long sustained passage. The camera drifts forward through the near field and the world is allowed to be quiet and large.'],
  '09-approach': ['1:00', 'Approach', 'The view descends toward the wax. Individual grains become resolvable.'],
  '10-line3-macro': ['1:06', 'Lyric 3 · macro', 'Thirty centimetres above the surface. The letters are built from countable grains and the groove structure runs underneath the text.'],
  '11-line4': ['1:21', 'Lyric 4', 'The longest line of the verse, spanning the plate.'],
  '12-converge': ['1:29', 'Convergence', 'Every system aims at one point: light narrows, dust is drawn inward, higher modes decay, the written lines slide toward the centre.'],
  '13-reversal': ['1:32', 'The reversal', 'The plate inverts and the camera passes through the diaphragm. The lines that lay on top as dust are seen from beneath as engraving, cut into the record.'],
  '14-groove': ['1:36', 'Groove travel', 'Inside the spiral. Walls of wax carry the engraved lines past the lens; the horn is gone.'],
  '15-residue': ['1:42', 'Residue · the artefact', 'Matter compacts into a pressed disc turning at 78 rpm, carrying the four lines as micro-engraving and a hash of this listening.'],
  '16-complete': ['1:44', 'Final state', 'The transport holds inside the record’s own near-silence. Nothing is faded or cut.'],
};

const files = (await readdir(DIR))
  .filter(f => f.endsWith('.png') && !f.startsWith('probe'))
  .sort();

const groups = { desktop: [], mobile: [], quality: [], access: [] };
for (const file of files) {
  const key = file.replace(/\.png$/, '');
  if (key.startsWith('m-')) groups.mobile.push(key);
  else if (key.startsWith('q-')) groups.quality.push(key);
  else if (key.startsWith('a-')) groups.access.push(key);
  else groups.desktop.push(key);
}

const sizes = {};
for (const file of files) sizes[file] = (await stat(join(DIR, file))).size;

const card = key => {
  const [time, title, note] = CAPTIONS[key] || ['', key.replace(/^[qma]-/, '').replace(/-/g, ' '), ''];
  return `<figure>
    <a href="${key}.png"><img src="${key}.png" alt="${title}" loading="lazy"></a>
    <figcaption><b>${time ? time + ' · ' : ''}${title}</b>${note ? `<span>${note}</span>` : ''}</figcaption>
  </figure>`;
};

const section = (name, keys, blurb) => keys.length ? `
  <section><h2>${name}</h2>${blurb ? `<p class="blurb">${blurb}</p>` : ''}
  <div class="grid">${keys.map(card).join('')}</div></section>` : '';

await writeFile(OUT, `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Transcendence Edition — frame review</title>
<style>
:root{color-scheme:dark}
body{margin:0;background:#0a0a0c;color:#ddd6c8;font:15px/1.6 "Iowan Old Style",Palatino,Georgia,serif;padding:2.4rem clamp(1rem,4vw,3rem) 6rem}
h1{font-size:1.9rem;font-weight:400;margin:0 0 .3rem}
.sub{color:#8d8578;font-size:.92rem;margin:0 0 2.4rem;max-width:52rem}
h2{font:600 .68rem/1 ui-sans-serif,system-ui;letter-spacing:.24em;text-transform:uppercase;color:#8d8578;margin:3rem 0 .6rem;border-top:1px solid #24242a;padding-top:1.2rem}
.blurb{color:#8d8578;font-size:.86rem;margin:0 0 1.2rem;max-width:52rem}
.grid{display:grid;gap:1.4rem;grid-template-columns:repeat(auto-fill,minmax(min(420px,100%),1fr))}
figure{margin:0}
img{width:100%;display:block;border:1px solid #24242a;border-radius:3px;background:#000}
figcaption{margin-top:.55rem;font-size:.84rem}
figcaption b{display:block;font-weight:400;color:#e8e0d2}
figcaption span{display:block;color:#8d8578;font-size:.8rem;margin-top:.2rem}
a{color:inherit}
.note{margin-top:3rem;padding-top:1.2rem;border-top:1px solid #24242a;color:#8d8578;font-size:.82rem;max-width:52rem}
</style></head><body>
<h1>Transcendence Edition — <i>The Standing Wave</i></h1>
<p class="sub">Frames captured from the <strong>extracted <code>.nz</code> package</strong> served over HTTP, not from source files.
Each image is the renderer's own output read back from the WebGL canvas at CSS resolution — no editing, no tone adjustment, no compositing.
Track one, <em>Home, Sweet Home</em>, Harry Macdonough with Charles D'Almaine, Victor, 23 January 1902.</p>

${section('Desktop · 1440 × 900 · Cinematic', groups.desktop, 'The full authored arc, 0.000 → 104.000 seconds. Every timestamp is a measured musical event from the package’s analysis file.')}
${section('Portrait · 390 × 844', groups.mobile, 'Lite profile, as a representative phone receives it.')}
${section('Quality profiles', groups.quality, 'The same second of the recording under each profile, including the no-WebGL Essential stage.')}
${section('Accessibility states', groups.access, 'Reduced motion is a different edit rather than the same edit with the movement removed. High contrast raises separation without changing composition.')}

<p class="note">This contact sheet is a development artefact and is not included in the released package.
Regenerate with <code>node scripts/frame-review-transcendence.mjs</code> after capturing frames.</p>
</body></html>
`);

console.log(`frame review → ${OUT}`);
console.log(`  ${files.length} frames · ${(Object.values(sizes).reduce((a, b) => a + b, 0) / 1024 / 1024).toFixed(1)} MB`);
