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
  edition: { edition_type: 'Open Edition' },
  rights: {},
  assets: { audioFile: null, coverFile: null, lyrics: [] },
  template: 'ultra',
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
    expect(result.filename).toBe('t_ultra_noizes.nz');
  });
});
