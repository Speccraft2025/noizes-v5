import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { normalizePackageManifest, sha256Hex, validateNzArchive } from './package-validation.js';

async function normalizedZip(bytes = [1, 2, 3]) {
  const zip = new JSZip();
  const path = 'tracks/01-track/audio/primary.wav';
  const buffer = Uint8Array.from(bytes);
  const sha256 = await sha256Hex(buffer);
  const component = { component_id: 'audio', scope: 'track', track_id: 'track', type: 'audio', role: 'primary_master', path, size: buffer.byteLength, sha256 };
  const inventoryHash = await sha256Hex(new TextEncoder().encode(`${path}:${sha256}:${buffer.byteLength}`));
  const manifest = {
    noizes_version: '1.0.0', package_type: 'music_release',
    release: { release_id: 'release', release_type: 'single', title: 'Title', track_count: 1, disc_count: 1 },
    tracks: [{ track_id: 'track', disc_number: 1, track_number: 1, title: 'Track', primary_audio_component: 'audio' }],
    components: [component], experience: { entry: 'experience.html' },
  };
  zip.file(path, buffer);
  zip.file('manifest.json', JSON.stringify(manifest));
  zip.file('authenticity.json', JSON.stringify({ method: 'sha256-component-inventory', hash: inventoryHash, signed: false }));
  zip.file('experience.html', '<!doctype html><title>Offline</title>');
  for (const file of ['edition.json', 'rights.json', 'credits.json', 'technical.json', 'experience.json', 'archive.json', 'history.json']) zip.file(file, '{}');
  return zip;
}

describe('package validation', () => {
  it('verifies normalized relationships, component bytes and inventory hash', async () => {
    const result = await validateNzArchive(await normalizedZip());
    expect(result.valid).toBe(true);
    expect(result.format).toBe('normalized_release');
    expect(result.checks.find((check) => check.label === 'component inventory')).toMatchObject({ status: 'pass', note: '1/1 components verified' });
  });

  it('blocks a package whose component bytes do not match the manifest', async () => {
    const zip = await normalizedZip();
    zip.file('tracks/01-track/audio/primary.wav', Uint8Array.from([9, 9, 9]));
    const result = await validateNzArchive(zip);
    expect(result.valid).toBe(false);
    expect(result.checks.map((check) => check.code)).toContain('component_integrity_failed');
  });

  it('blocks corrupt required JSON and incomplete normalized relationships', async () => {
    const zip = await normalizedZip();
    zip.file('rights.json', '{broken');
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    manifest.release.track_count = 2;
    zip.file('manifest.json', JSON.stringify(manifest));
    const result = await validateNzArchive(zip);
    expect(result.valid).toBe(false);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'rights.json', status: 'fail', code: 'required_json_invalid' }),
      expect.objectContaining({ label: 'release relationships', status: 'fail', code: 'relationships_invalid' }),
    ]));
  });

  it('blocks private invitation data or unknown track links in portable credits', async () => {
    const zip = await normalizedZip();
    zip.file('credits.json', JSON.stringify({
      records: [{ credit_id: 'credit-1', name: 'Guest', role: 'Featured Artist', email: 'private@example.com', track_ids: ['missing-track'] }],
      tracks: [{ track_id: 'track', linked_release_credit_ids: ['missing-credit'] }],
    }));
    const result = await validateNzArchive(zip);
    expect(result.valid).toBe(false);
    expect(result.checks).toContainEqual(expect.objectContaining({ label: 'credit relationships', status: 'fail', code: 'credits_invalid' }));
  });

  it('normalizes legacy manifests into one internal Single track without migration', () => {
    const manifest = normalizePackageManifest({ noizes_version: '0.1', release_id: 'old', artist: 'A', title: 'T' }, ['audio/song.mp3']);
    expect(manifest).toMatchObject({
      package_type: 'music_release',
      release: { release_type: 'single', track_count: 1 },
      tracks: [{ track_id: 'legacy-primary-track', primary_audio_component: 'legacy-primary-audio' }],
      compatibility: { legacy: true },
    });
  });
});
