import { describe, expect, it } from 'vitest';
import { ARCHIVE_SECTIONS, buildReleaseArchive, buildReleaseHistory } from './archive.js';

describe('multi-track Archive', () => {
  it('separates track audio versions, stems, and the continuous release master', () => {
    const archive = buildReleaseArchive({
      release: { release_id: 'release', title: 'Album', track_count: 1 },
      tracks: [{
        track_id: 'track', title: 'Song', primary_audio_component: 'primary',
        audio_versions: [
          { version_id: 'v1', role: 'primary_master', is_primary: true, audio_component: 'primary' },
          { version_id: 'v2', role: 'stem', audio_component: 'stem' },
        ],
      }],
      components: [
        { component_id: 'primary', scope: 'track', track_id: 'track', type: 'audio', role: 'primary_master' },
        { component_id: 'stem', scope: 'track', track_id: 'track', type: 'audio', role: 'stem' },
        { component_id: 'mix', scope: 'release', type: 'audio', role: 'continuous_master' },
      ],
    });
    expect(archive.sections).toEqual(ARCHIVE_SECTIONS);
    expect(archive.tracks[0].primary_audio.component_id).toBe('primary');
    expect(archive.tracks[0].audio_versions[1].group).toBe('Stems');
    expect(archive.release_assets.continuous_masters[0].component_id).toBe('mix');
  });

  it('preserves compilation artists and track-specific rights', () => {
    const archive = buildReleaseArchive({
      release: { release_type: 'compilation', primary_artist: 'Curator' },
      tracks: [{ track_id: 'a', title: 'One', primary_artist: 'Artist A', rights: { master: { holder: 'A' } } }],
    });
    expect(archive.tracks[0]).toMatchObject({ primary_artist: 'Artist A', rights: { master: { holder: 'A' } } });
  });
});

describe('multi-track History', () => {
  it('keeps ownership on the authenticated release copy and track history informational', () => {
    const history = buildReleaseHistory({
      release: { release_id: 'release', title: 'Album' },
      edition: { edition_id: 'edition', edition_name: 'First Edition', edition_size: 100 },
      provenance: { copy_id: 'copy', copy_number: 47, events: [{ kind: 'acquired', at: '2026-01-01' }] },
      tracks: [{ track_id: 'track', title: 'Song', creation_history: [{ kind: 'recorded' }] }],
      packaged_at: '2026-07-31T00:00:00.000Z',
    });
    expect(history).toMatchObject({ scope: 'release_copy', copy: { copy_id: 'copy', copy_number: 47 } });
    expect(history.ownership_history).toEqual([{ kind: 'acquired', at: '2026-01-01' }]);
    expect(history.track_creation_history[0]).toMatchObject({ scope: 'informational_work_history', events: [{ kind: 'recorded' }] });
    expect(history).not.toHaveProperty('track_ownership');
    expect(history.offline_snapshot.provenance_event_count).toBe(1);
  });
});
