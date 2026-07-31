import { writeFile, mkdir } from 'node:fs/promises';
import JSZip from 'jszip';
import { buildPackage } from '../src/lib/utils/packager.js';

globalThis.document = { createElement: () => ({ click() {} }) };
URL.createObjectURL = () => 'blob:offline-check';
URL.revokeObjectURL = () => {};

const file = (name, type, bytes) => ({ name, type, arrayBuffer: async () => Uint8Array.from(bytes).buffer });
function silentWav() {
  const samples = 8000;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28); buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const pdf = file('liner-notes.pdf', 'application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const result = await buildPackage({
  identity: { artist: 'Offline Artist', title: 'Known Good', release_id: 'nz-offline-check', year: '2026', description: 'Offline verification fixture' },
  edition: { edition_type: 'fixed', edition_name: 'First Edition', edition_size: '10', price: '1000', currency: 'KES', transferable: true },
  rights: { copyright: '© 2026 Offline Artist', license: 'All Rights Reserved', credits: '' },
  assets: { audioFile: file('main.wav', 'audio/wav', silentWav()), coverFile: file('cover.png', 'image/png', png), lyrics: [], guide: null },
  template: 'legacy-theme',
  play: { games: [], difficulty: 'standard', intensity: 1 },
  extras: { story: 'A self-contained object.', links: [], pdfs: [{ id: 'liner-notes', title: 'Liner Notes', name: pdf.name, file: pdf }] },
});

const out = '/tmp/noizes-known-good';
await mkdir(out, { recursive: true });
await writeFile(`${out}/known-good.nz`, Buffer.from(await result.blob.arrayBuffer()));
const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
for (const name of Object.keys(zip.files)) {
  if (zip.files[name].dir) continue;
  const bytes = await zip.files[name].async('nodebuffer');
  await mkdir(`${out}/${name.split('/').slice(0, -1).join('/')}`, { recursive: true });
  await writeFile(`${out}/${name}`, bytes);
}
console.log(out);
