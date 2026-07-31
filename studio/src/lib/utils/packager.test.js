import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import JSZip from 'jszip';
import { buildPackage } from './packager.js';

// buildPackage triggers a browser download at the end; stub just enough DOM
// for it to run in node. The zip itself builds on pure JS + WebCrypto.
const origCreateObjectURL = URL.createObjectURL;
const origRevokeObjectURL = URL.revokeObjectURL;

beforeAll(() => {
  globalThis.document = { createElement: () => ({ click() {} }) };
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};
});

afterAll(() => {
  delete globalThis.document;
  URL.createObjectURL = origCreateObjectURL;
  URL.revokeObjectURL = origRevokeObjectURL;
});

const base = {
  identity: { artist: 'A', title: 'T', release_id: 'nz-p-1', year: '2026' },
  edition: { edition_type: 'fixed', edition_name: 'First Edition', edition_size: '100', price: '1000', currency: 'KES' },
  rights: {},
  assets: { audioFile: null, coverFile: null, lyrics: [] },
  template: 'ultra-v2',
};

async function unzip(result) {
  return JSZip.loadAsync(await result.blob.arrayBuffer());
}

describe('buildPackage — experience.json (play pass-through)', () => {
  it('emits a normalized experience.json when games are enabled', async () => {
    const result = await buildPackage({ ...base, play: { games: ['pulse'] } });
    const zip = await unzip(result);
    const exp = JSON.parse(await zip.file('experience.json').async('string'));
    expect(exp.schema_version).toBe('2.0.0');
    expect(exp.release_id).toBe('nz-p-1');
    expect(exp.play).toEqual({ games: ['pulse'], difficulty: 'standard', intensity: 1 });
    // the Guide always ships, even alongside games
    expect(exp.guide.nodes.map((n) => n.id)).toContain('listen');
    // and the baked HTML carries the same play block
    const html = await zip.file('experience.html').async('string');
    expect(html).toContain('"play"');
  });

  it('always emits experience.json with a Guide (no play block when no games)', async () => {
    const result = await buildPackage({ ...base, play: { games: [], difficulty: 'standard', intensity: 1 } });
    const zip = await unzip(result);
    const exp = JSON.parse(await zip.file('experience.json').async('string'));
    // Guide is present; play block is omitted for a games-free export.
    expect(exp.guide.version).toBe(1);
    expect(exp.play).toBeUndefined();
    // arrival → object → listen → record → end for a plain audio object (no lyrics/games)
    expect(exp.guide.nodes.map((n) => n.id)).toEqual(['arrival', 'object', 'listen', 'record', 'end']);
    for (const name of ['manifest.json', 'edition.json', 'rights.json', 'credits.json', 'authenticity.json', 'technical.json', 'experience.html']) {
      expect(zip.file(name), `${name} missing`).toBeTruthy();
    }
    expect(result.filename).toBe('t_ultra-v2_noizes.nz');
  });

  it('preserves a creator-authored Guide order and labels', async () => {
    const guide = {
      version: 1,
      allowFreeExplore: false,
      nodes: [
        { id: 'listen', type: 'listen', label: 'Enter the sound', view: 'view-player' },
        { id: 'arrival', type: 'arrival', label: 'A note from A', view: 'intro' },
      ],
    };
    const result = await buildPackage({ ...base, assets: { ...base.assets, guide }, template: 'monument' });
    const zip = await unzip(result);
    const exp = JSON.parse(await zip.file('experience.json').async('string'));
    expect(exp.guide).toEqual(guide);
    expect(result.filename).toBe('t_ultra-v2_noizes.nz');
  });

  it('records ultra-v2 as the canonical manifest experience and emits safe online resources separately', async () => {
    const result = await buildPackage({
      ...base,
      template: 'codex',
      extras: { story: 'Behind the song', links: [
        { label: 'Tickets', url: 'https://example.com/tickets', kind: 'tickets' },
        { label: 'Unsafe', url: 'javascript:alert(1)', kind: 'artist' },
      ] },
    });
    const zip = await unzip(result);
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    const resources = JSON.parse(await zip.file('resources.json').async('string'));
    expect(manifest.experience.template).toBe('ultra-v2');
    expect(resources.groups[0].links).toEqual([
      { label: 'Tickets', url: 'https://example.com/tickets', kind: 'tickets', requires_internet: true }
    ]);
  });

  it('embeds PDF extras as a portable Note Wall without external dependencies', async () => {
    const pdfFile = {
      name: 'liner notes.pdf',
      type: 'application/pdf',
      arrayBuffer: async () => Uint8Array.from([0x25, 0x50, 0x44, 0x46]).buffer,
    };
    const result = await buildPackage({
      ...base,
      extras: { story: '', links: [], pdfs: [{ id: 'note-1', title: 'Liner Notes', name: pdfFile.name, file: pdfFile }] },
    });
    const zip = await unzip(result);
    const exp = JSON.parse(await zip.file('experience.json').async('string'));
    expect(exp.attachments).toEqual([{
      id: 'note-1', title: 'Liner Notes', path: 'attachments/01-liner_notes.pdf', mime: 'application/pdf', kind: 'notes'
    }]);
    expect(zip.file('attachments/01-liner_notes.pdf')).toBeTruthy();
    const html = await zip.file('experience.html').async('string');
    expect(html).toContain('data:application/pdf;base64,JVBERg==');
    expect(html).toContain('Note Wall');
  });
});
