import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import JSZip from 'jszip';
import { buildPackage } from './packager.js';
import { createAudioAsset, createAudioVersion, createReleaseAsset, createReleaseProject } from '../domain/release.js';

/**
 * Alternate takes have always been written into the package, but the runtime
 * never saw them: `playbackTracks` carried a single `src` and nothing else, so
 * an acapella sat inside the .nz with no way to reach it.
 *
 * These tests follow a version all the way from the project to the config the
 * player actually reads, because that was exactly the gap.
 */

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

const file = (name, bytes) => ({
  name,
  type: 'audio/wav',
  size: bytes.length,
  arrayBuffer: async () => Uint8Array.from(bytes).buffer,
});

const cover = {
  name: 'c.jpg',
  type: 'image/jpeg',
  size: 3,
  arrayBuffer: async () => Uint8Array.from([7, 8, 9]).buffer,
};

/** A release whose single track has `roles.length` takes. */
async function packageWithVersions(roles) {
  const project = createReleaseProject({
    release: { release_type: 'single', title: 'Ovacado', primary_artist: 'Jazel' },
    tracks: [{ title: 'Ovacado', primary_artist: 'Jazel', disc_number: 1, track_number: 1 }],
    edition: { edition_name: 'First', edition_size: '100', price: '1000', currency: 'KES' },
  });
  project.release_assets = [
    createReleaseAsset({ role: 'main_cover', type: 'image', file: cover }, { releaseId: project.release.release_id }),
  ];

  const track = project.tracks[0];
  roles.forEach((role, index) => {
    const isPrimary = role === 'primary_master';
    const version = createAudioVersion({ track_id: track.track_id, role, is_primary: isPrimary });
    const asset = createAudioAsset({
      track_id: track.track_id,
      version_id: version.version_id,
      role,
      scope: 'track',
      file: file(`${role}.wav`, [index + 1, index + 2, index + 3]),
    }, { releaseId: project.release.release_id });
    version.audio_asset_id = asset.asset_id;
    if (isPrimary) {
      track.primary_version_id = version.version_id;
      track.primary_audio_ref = asset.asset_id;
    }
    project.audio_versions.push(version);
    project.audio_assets.push(asset);
  });

  const result = await buildPackage({ project, template: 'ultra-v2', play: { games: [] }, download: false });
  const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
  const html = await zip.file('experience.html').async('string');
  return { zip, html, project };
}

/** The track list the player reads, lifted out of the baked config. */
function playbackTracksFrom(html) {
  const marker = 'window.NZ_CONFIG = ';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('NZ_CONFIG not found in experience.html');
  const body = html.slice(start + marker.length);
  const end = body.indexOf('\n</script>') >= 0 ? body.indexOf('\n</script>') : body.length;
  // The config is emitted as an object literal; evaluate it in isolation.
  // eslint-disable-next-line no-new-func
  return new Function(`return ${body.slice(0, end).trim().replace(/;$/, '')}`)().tracks ?? [];
}

describe('switchable audio versions reach the player', () => {
  it('carries every take, with a source the runtime can load', async () => {
    const { html } = await packageWithVersions(['primary_master', 'acapella', 'instrumental']);
    const [track] = playbackTracksFrom(html);

    expect(track.versions).toHaveLength(3);
    for (const version of track.versions) {
      expect(version.version_id, 'a take with no id cannot be selected').toBeTruthy();
      expect(version.src, `${version.role} has no source`).toBeTruthy();
      expect(version.title).toBeTruthy();
    }
    expect(track.versions.map((v) => v.role).sort())
      .toEqual(['acapella', 'instrumental', 'primary_master']);
  });

  it('leads with the primary, so the switcher opens on the expected take', async () => {
    const { html } = await packageWithVersions(['acapella', 'primary_master', 'instrumental']);
    const [track] = playbackTracksFrom(html);

    expect(track.versions[0].is_primary).toBe(true);
    expect(track.versions[0].role).toBe('primary_master');
  });

  it('gives each take a distinct file rather than pointing them all at one', async () => {
    // Sharing a src would make the switcher appear to work while playing the
    // same audio — the most confusing possible failure.
    const { html } = await packageWithVersions(['primary_master', 'acapella']);
    const [track] = playbackTracksFrom(html);

    const sources = track.versions.map((v) => v.src);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it('ships no switcher when there is only one take', async () => {
    // A control offering a single choice is noise.
    const { html } = await packageWithVersions(['primary_master']);
    const [track] = playbackTracksFrom(html);

    expect(track.versions).toEqual([]);
    expect(track.src, 'the primary must still play').toBeTruthy();
  });

  it('still names the primary source at the top level for older viewers', async () => {
    const { html } = await packageWithVersions(['primary_master', 'acapella']);
    const [track] = playbackTracksFrom(html);

    // A viewer that knows nothing about versions must still play the record.
    expect(track.src).toBeTruthy();
    expect(track.versions.some((v) => v.src === track.src)).toBe(true);
  });

  it('writes each take into the package as its own file', async () => {
    const { zip, project } = await packageWithVersions(['primary_master', 'acapella']);
    const track = project.tracks[0];
    const folder = `tracks/${String(track.position).padStart(2, '0')}-${track.track_id}`;

    expect(zip.file(`${folder}/audio/primary.wav`), 'primary missing').toBeTruthy();
    // JSZip lists the folder itself alongside its contents; count only files.
    const audioFiles = Object.keys(zip.files)
      .filter((name) => name.startsWith(`${folder}/audio/`) && !zip.files[name].dir);
    expect(audioFiles).toHaveLength(2);
    expect(audioFiles.some((name) => name.includes('acapella'))).toBe(true);
  });
});
