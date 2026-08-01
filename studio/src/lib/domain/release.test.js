import { describe, expect, it } from 'vitest';
import {
  AUDIO_VERSION_ROLES,
  PLAYBACK_MODES,
  RELEASE_TYPES,
  createAudioAsset,
  createAudioVersion,
  createReleaseProject,
  duplicateTrack,
  normalizeReleaseProject,
  normalizeReleaseType,
  orderedTracks,
  removeTrack,
  reorderTrack,
  stableUuid,
  validateReleaseProject,
} from './release.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function publishableProject(overrides = {}) {
  const project = createReleaseProject({
    release: {
      release_type: 'single',
      title: 'Steady',
      primary_artist: 'dBoy',
      year: '2026',
    },
    tracks: [{ title: 'Steady', primary_artist: 'dBoy' }],
    ...overrides,
  });
  const track = project.tracks[0];
  const version = createAudioVersion({ track_id: track.track_id, role: 'primary_master' });
  const asset = createAudioAsset({
    track_id: track.track_id,
    version_id: version.version_id,
    role: 'primary_master',
    scope: 'track',
    filename: 'steady.wav',
  }, { releaseId: project.release.release_id });
  version.audio_asset_id = asset.asset_id;
  track.primary_version_id = version.version_id;
  track.primary_audio_ref = asset.asset_id;
  project.audio_versions = [version];
  project.audio_assets = [asset];
  project.rights.release_rights = {
    ...project.rights.release_rights,
    copyright: '© 2026 dBoy',
    authority_confirmed: true,
  };
  return project;
}

describe('normalized release project', () => {
  it('supports the complete release-type vocabulary without special-case failure', () => {
    expect(RELEASE_TYPES).toEqual([
      'single', 'ep', 'album', 'mixtape', 'compilation', 'live_release', 'soundtrack', 'dj_mix', 'other',
    ]);
    for (const releaseType of RELEASE_TYPES) expect(normalizeReleaseType(releaseType)).toBe(releaseType);
    expect(normalizeReleaseType('Live Release')).toBe('live_release');
    expect(normalizeReleaseType('unusual cultural form')).toBe('other');
  });

  it('keeps version and playback vocabularies extensible but explicit', () => {
    expect(AUDIO_VERSION_ROLES).toContain('primary_master');
    expect(AUDIO_VERSION_ROLES).toContain('instrumental');
    expect(PLAYBACK_MODES).toEqual([
      'sequential', 'gapless', 'crossfade', 'manual', 'creator_defined', 'continuous_master',
    ]);
  });

  it('creates UUID identities for a release, its track, and its release-wide edition', () => {
    const project = createReleaseProject();
    expect(project.release.release_id).toMatch(UUID_RE);
    expect(project.tracks[0].track_id).toMatch(UUID_RE);
    expect(project.edition.edition_id).toMatch(UUID_RE);
    expect(project.edition.release_id).toBe(project.release.release_id);
    expect(project.edition.applies_to).toBe('release');
    expect(project).not.toHaveProperty('copy');
  });

  it('normalizes the old flat Studio state into one release with one real track', () => {
    const audioFile = { name: 'legacy.wav', type: 'audio/wav', size: 2048 };
    const coverFile = { name: 'cover.jpg', type: 'image/jpeg', size: 1024 };
    const project = normalizeReleaseProject({
      identity: {
        release_id: 'nz-legacy-001',
        artist: 'Legacy Artist',
        title: 'Legacy Song',
        genre: 'Soul, Electronic',
        year: '2024',
      },
      assets: {
        audioFile,
        audioName: audioFile.name,
        coverFile,
        coverName: coverFile.name,
        lyrics: [{ t: 0, text: 'Begin' }],
        guide: { version: 1, nodes: [{ id: 'arrival' }] },
      },
      edition: { edition_name: 'First Edition', edition_size: '25' },
    });

    expect(project.release.release_id).toMatch(UUID_RE);
    expect(project.release.legacy_release_id).toBe('nz-legacy-001');
    expect(project.release.genre).toEqual(['Soul', 'Electronic']);
    expect(project.tracks).toHaveLength(1);
    expect(project.tracks[0]).toMatchObject({ title: 'Legacy Song', primary_artist: 'Legacy Artist' });
    expect(project.audio_versions).toHaveLength(1);
    expect(project.audio_assets[0]).toMatchObject({ role: 'primary_master', file: audioFile });
    expect(project.release_assets[0]).toMatchObject({ role: 'main_cover', file: coverFile });
    expect(project.lyrics[0].timed_lines).toEqual([{ t: 0, text: 'Begin' }]);
    expect(project.journey.legacy_guide.nodes[0].id).toBe('arrival');
  });

  it('produces stable compatibility UUIDs for legacy identifiers', () => {
    expect(stableUuid('nz-old')).toBe(stableUuid('nz-old'));
    expect(stableUuid('nz-old')).not.toBe(stableUuid('nz-other'));
    expect(stableUuid('nz-old')).toMatch(UUID_RE);
  });

  it('sorts multi-disc tracks deterministically', () => {
    const tracks = [
      { track_id: 'c', disc_number: 2, track_number: 1, position: 3 },
      { track_id: 'b', disc_number: 1, track_number: 2, position: 2 },
      { track_id: 'a', disc_number: 1, track_number: 1, position: 1 },
    ];
    expect(orderedTracks(tracks).map((track) => track.track_id)).toEqual(['a', 'b', 'c']);
  });

  it('reorders public track numbers without changing stable IDs', () => {
    const project = createReleaseProject({
      release: { release_type: 'album', title: 'Three', primary_artist: 'A' },
      tracks: [
        { title: 'One', track_number: 1 },
        { title: 'Two', track_number: 2 },
        { title: 'Three', track_number: 3 },
      ],
    });
    const ids = project.tracks.map((track) => track.track_id);
    const reordered = reorderTrack(project.tracks, ids[2], 0);
    expect(reordered.map((track) => track.track_id)).toEqual([ids[2], ids[0], ids[1]]);
    expect(reordered.map((track) => track.track_number)).toEqual([1, 2, 3]);
    expect(new Set(reordered.map((track) => track.track_id))).toEqual(new Set(ids));
  });

  it('duplicates track metadata but never aliases the source audio or ID', () => {
    const project = publishableProject();
    const source = project.tracks[0];
    const duplicated = duplicateTrack(project, source.track_id);
    expect(duplicated.tracks).toHaveLength(2);
    expect(duplicated.tracks[1].track_id).not.toBe(source.track_id);
    expect(duplicated.tracks[1].primary_audio_ref).toBe('');
    expect(duplicated.tracks[1].primary_version_id).toBe('');
  });

  it('removes a track and its owned assets, rights, lyrics, and Journey relationships', () => {
    const project = publishableProject({
      release: { release_type: 'album', title: 'Two', primary_artist: 'A' },
      tracks: [{ title: 'One' }, { title: 'Two' }],
    });
    const removedId = project.tracks[0].track_id;
    const removedAssetId = project.audio_assets[0].asset_id;
    project.lyrics = [{ track_id: removedId, plain_text: 'Gone' }];
    project.rights.track_rights = [{ track_id: removedId }];
    project.rights.asset_permissions = [{ asset_id: removedAssetId, confirmed: true }];
    project.rights.release_rights.credit_records = [{
      credit_id: 'ce179b9c-d1ef-469d-b6ba-e8cda646ee04',
      name: 'Guest',
      role: 'Performer',
      track_ids: [removedId, project.tracks[1].track_id],
    }];
    project.journey.transitions = [{ from_track_id: removedId, to_track_id: project.tracks[1].track_id }];
    const remainingId = project.tracks[1].track_id;
    const next = removeTrack(project, removedId);
    expect(next.tracks).toHaveLength(1);
    expect(next.tracks[0]).toMatchObject({ track_id: remainingId, position: 1, track_number: 1 });
    expect(next.audio_assets).toHaveLength(0);
    expect(next.audio_versions).toHaveLength(0);
    expect(next.lyrics).toHaveLength(0);
    expect(next.rights.track_rights).toHaveLength(0);
    expect(next.rights.asset_permissions).toHaveLength(0);
    expect(next.rights.release_rights.credit_records[0].track_ids).toEqual([remainingId]);
    expect(next.journey.transitions).toHaveLength(0);
  });

  it('preserves explicit per-track credits and release-credit inheritance', () => {
    const project = createReleaseProject({
      release: { release_type: 'compilation', title: 'Field Notes', primary_artist: 'Various Artists' },
      tracks: [{ title: 'Signal', primary_artist: 'Guest', inherit_release_credits: false, credits: { text: 'Recorded by A' } }],
    });
    expect(project.tracks[0]).toMatchObject({ inherit_release_credits: false, credits: { text: 'Recorded by A' } });
  });
});
describe('release publication validation', () => {
  it('accepts a complete Single', () => {
    expect(validateReleaseProject(publishableProject())).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('blocks empty placeholder tracks and missing primary audio', () => {
    const result = validateReleaseProject(createReleaseProject({
      release: { release_type: 'single', title: 'Incomplete', primary_artist: 'Artist' },
      tracks: [{}],
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'track_title_missing', 'primary_audio_missing',
    ]));
  });

  it('requires two tracks for ordinary multi-track release types', () => {
    for (const releaseType of ['ep', 'album', 'mixtape', 'compilation', 'live_release', 'soundtrack']) {
      const project = publishableProject({ release: { release_type: releaseType, title: 'Short', primary_artist: 'A' } });
      expect(validateReleaseProject(project).errors.map((issue) => issue.code)).toContain('multi_track_release_too_short');
    }
  });

  it('allows a DJ Mix to use an intentional release-level continuous master', () => {
    const project = createReleaseProject({
      release: { release_type: 'dj_mix', title: 'Night Mix', primary_artist: 'Selector' },
      tracks: [],
      audio_assets: [{ scope: 'release', role: 'continuous_master', filename: 'night.wav' }],
    });
    const result = validateReleaseProject(project);
    expect(result.errors.map((issue) => issue.code)).not.toContain('tracklist_empty');
  });

  it('allows hidden tracks without primary audio but still requires honest identity', () => {
    const project = createReleaseProject({
      release: { release_type: 'single', title: 'Secret', primary_artist: 'Artist' },
      tracks: [{ title: 'Hidden coda', primary_artist: 'Artist', hidden: true }],
    });
    expect(validateReleaseProject(project).errors.map((issue) => issue.code)).not.toContain('primary_audio_missing');
    project.tracks[0].title = '';
    expect(validateReleaseProject(project).errors.map((issue) => issue.code)).toContain('track_title_missing');
  });

  it('blocks duplicate same-disc track numbers and duplicate primary masters', () => {
    const project = publishableProject({
      release: { release_type: 'album', title: 'Twice', primary_artist: 'A' },
      tracks: [
        { title: 'One', primary_artist: 'A', disc_number: 1, track_number: 1 },
        { title: 'Two', primary_artist: 'A', disc_number: 1, track_number: 1 },
      ],
    });
    const first = project.tracks[0];
    project.audio_assets.push(createAudioAsset({
      track_id: first.track_id,
      scope: 'track',
      role: 'primary_master',
      filename: 'duplicate.wav',
    }, { releaseId: project.release.release_id }));
    const codes = validateReleaseProject(project).errors.map((issue) => issue.code);
    expect(codes).toContain('track_number_duplicate');
    expect(codes).toContain('primary_audio_duplicate');
  });

  it('accepts a confirmed PDF permission and rejects an orphaned permission record', () => {
    const project = publishableProject();
    project.extras = { pdfs: [{ id: 'liner-note', title: 'Liner note', file: { name: 'notes.pdf' } }] };
    project.rights.asset_permissions = [{ asset_id: 'liner-note', confirmed: true, basis: 'Creator-owned' }];
    expect(validateReleaseProject(project).errors.map((issue) => issue.code)).not.toContain('permission_asset_missing');
    project.extras.pdfs = [];
    expect(validateReleaseProject(project).errors.map((issue) => issue.code)).toContain('permission_asset_missing');
  });

  it('rejects track-level edition supply and a mismatched edition release', () => {
    const project = publishableProject();
    project.tracks[0].edition_size = 10;
    project.edition.release_id = stableUuid('another release');
    const codes = validateReleaseProject(project).errors.map((issue) => issue.code);
    expect(codes).toContain('track_edition_not_allowed');
    expect(codes).toContain('edition_release_mismatch');
  });
});
