import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });

const compositions = [
  { id: 'ExperienceDemo', out: 'experience-demo.webm' },
  { id: 'HowToExplore', out: 'how-to-explore.webm' },
  { id: 'WhatsInside', out: 'whats-inside.webm' },
];

async function main() {
  console.log('Bundling Remotion project...');
  const bundleLocation = await bundle({
    entryPoint: path.join(__dirname, 'src/Root.jsx'),
  });

  for (const comp of compositions) {
    console.log(`Rendering ${comp.id}...`);
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: comp.id,
    });

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'vp8',
      outputLocation: path.join(outDir, comp.out),
    });
    console.log(`  -> out/${comp.out}`);
  }

  console.log('All videos rendered.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
