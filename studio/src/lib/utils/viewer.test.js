import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { sha256Hex } from '../domain/package-validation.js';
import { parseMediaRequest, prepareNzForViewer, VIEWER_FRAME_BOOTSTRAP } from './viewer.js';

async function viewerPackage() {
  const zip = new JSZip();
  const path = 'tracks/01-track/audio/primary.wav';
  const bytes = Uint8Array.from([1, 2, 3]);
  const hash = await sha256Hex(bytes);
  const component = { component_id: 'audio', track_id: 'track', scope: 'track', type: 'audio', role: 'primary_master', path, size: 3, sha256: hash, mime: 'audio/wav' };
  const inventoryHash = await sha256Hex(new TextEncoder().encode(`${path}:${hash}:3`));
  zip.file(path, bytes);
  zip.file('experience.html', `<audio src="${path}"></audio><script>window.NZ_CONFIG={"tracks":[{"src":"${path}"}]}</script>`);
  zip.file('manifest.json', JSON.stringify({
    noizes_version: '1.0.0', package_type: 'music_release',
    release: { release_id: 'r', release_type: 'single', title: 'T', track_count: 1, disc_count: 1 },
    tracks: [{ track_id: 'track', disc_number: 1, track_number: 1, title: 'T', primary_audio_component: 'audio' }],
    components: [component], experience: { entry: 'experience.html' },
  }));
  zip.file('authenticity.json', JSON.stringify({ hash: inventoryHash, signed: false }));
  for (const path of ['edition.json', 'rights.json', 'credits.json', 'technical.json', 'experience.json']) zip.file(path, '{}');
  return zip.generateAsync({ type: 'blob' });
}

describe('offline viewer preparation', () => {
  it('validates package bytes and hands resources to the sandbox bootstrap', async () => {
    const result = await prepareNzForViewer(await viewerPackage(), {
      storage: {
        getItem: (key) => key === 'nz-release-resume:r:edition:open-copy'
          ? JSON.stringify({ current_track_id: 'track', current_track_position_ms: 1200 })
          : null,
      },
    });
    expect(result.validation.valid).toBe(true);
    expect(result.html).toContain('src="tracks/01-track/audio/primary.wav"');
    expect(result.html).toContain('"src":"tracks/01-track/audio/primary.wav"');
    expect(result.html).toContain('window.NZ_VIEWER_STATE');
    expect(result.html).toContain('"current_track_position_ms":1200');
    expect(result.storageKeys.resumeKey).toBe('nz-release-resume:r:edition:open-copy');
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0]).toMatchObject({ path: 'tracks/01-track/audio/primary.wav', mime: 'audio/wav' });
    expect(Array.from(new Uint8Array(result.resources[0].bytes))).toEqual([1, 2, 3]);
    expect(VIEWER_FRAME_BOOTSTRAP).toContain('noizes:viewer:load');
    expect(VIEWER_FRAME_BOOTSTRAP).toContain('window.NZ_RESOURCE_URLS');
    expect(VIEWER_FRAME_BOOTSTRAP).toContain("html.split(\"'\"+resource.path+\"'\")");
    expect(VIEWER_FRAME_BOOTSTRAP).toContain('document.write(html)');
  });
});

describe('viewer media overlay requests', () => {
  it('tells the experience the viewer can show YouTube', async () => {
    const result = await prepareNzForViewer(await viewerPackage(), { storage: { getItem: () => null } });
    expect(result.html).toContain('"capabilities":{"media_overlay":["youtube"]}');
  });

  it('accepts a YouTube video id and builds the privacy-enhanced embed itself', () => {
    const media = parseMediaRequest({ type: 'noizes:media:open', provider: 'youtube', video_id: 'oXCxc4EpIzc', title: '  Ujuzi \n ft Fello ' });
    expect(media).toEqual({
      provider: 'youtube',
      videoId: 'oXCxc4EpIzc',
      title: 'Ujuzi ft Fello',
      embedUrl: 'https://www.youtube-nocookie.com/embed/oXCxc4EpIzc?autoplay=1&playsinline=1&rel=0&modestbranding=1',
    });
  });

  it('rejects anything that is not a bare YouTube id', () => {
    for (const video_id of ['', 'short', 'oXCxc4EpIzc&list=x', 'https://evil.example/', '../../../etc', 'oXCxc4EpIz"', 42]) {
      expect(parseMediaRequest({ type: 'noizes:media:open', provider: 'youtube', video_id })).toBeNull();
    }
    expect(parseMediaRequest({ type: 'noizes:media:open', provider: 'vimeo', video_id: 'oXCxc4EpIzc' })).toBeNull();
    expect(parseMediaRequest({ type: 'noizes:storage:set', provider: 'youtube', video_id: 'oXCxc4EpIzc' })).toBeNull();
    expect(parseMediaRequest(null)).toBeNull();
  });

  it('caps the title length', () => {
    expect(parseMediaRequest({ type: 'noizes:media:open', provider: 'youtube', video_id: 'oXCxc4EpIzc', title: 'x'.repeat(500) }).title).toHaveLength(160);
  });
});
