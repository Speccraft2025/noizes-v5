import { describe, expect, it } from 'vitest';
import { estimatePackageSize, formatBytes } from './package-size.js';

describe('package size estimates', () => {
  it('reports release, track, asset and data-URI expansion sizes', () => {
    const project = {
      tracks: [{ track_id: 'a', title: 'A' }],
      release_assets: [{ asset_id: 'cover', size: 3, role: 'main_cover', type: 'image' }],
      audio_assets: [{ asset_id: 'audio', track_id: 'a', scope: 'track', size: 6, role: 'primary_master', type: 'audio' }],
      track_assets: [],
    };
    const result = estimatePackageSize(project);
    expect(result).toMatchObject({ original_bytes: 9, all_assets_data_uri_bytes: 12, data_uri_expansion_bytes: 3, release_bytes: 3 });
    expect(result.per_track[0]).toMatchObject({ track_id: 'a', size: 6, asset_count: 1 });
  });

  it('warns about video, stems, browser memory, and very large packages', () => {
    const size = 600 * 1024 * 1024;
    const result = estimatePackageSize({
      tracks: [{ track_id: 'a', title: 'A' }], release_assets: [],
      audio_assets: [{ track_id: 'a', size, role: 'stem', type: 'audio', filename: 'stems.wav' }],
      track_assets: [{ track_id: 'a', size: 300 * 1024 * 1024, role: 'video', type: 'video', filename: 'film.mp4' }],
    });
    expect(result.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining(['package_over_500mb', 'browser_memory_over_1gb', 'video_asset', 'large_stems', 'data_uri_expansion']));
    expect(formatBytes(size)).toBe('600.0 MB');
  });
});
