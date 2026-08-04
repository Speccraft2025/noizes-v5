import { describe, it, expect } from 'vitest';
import {
  describePackageContents, describeExperienceSections, describeTrustIndicators,
  summarizeExperience, formatDuration, formatBytes,
} from './drop-contents.js';

const manifest = (overrides = {}) => ({
  release: { total_duration_ms: 3_780_000 },
  tracks: [{ track_id: 't1' }, { track_id: 't2' }],
  components: [
    { type: 'audio', role: 'primary_master', path: 'tracks/01-t1/audio/primary.mp3', track_id: 't1' },
    { type: 'audio', role: 'primary_master', path: 'tracks/02-t2/audio/primary.mp3', track_id: 't2' },
    { type: 'image', role: 'main_cover', path: 'release/cover/cover.jpg' },
  ],
  rights: { path: 'rights.json' },
  authenticity: { path: 'authenticity.json' },
  ...overrides,
});

describe('describePackageContents', () => {
  it('describes audio from the tracklist and the release duration', () => {
    const [audio] = describePackageContents(manifest());
    expect(audio).toMatchObject({ key: 'audio', label: 'Audio', count: 2 });
    expect(audio.detail).toBe('2 tracks · 1 hr 3 min');
  });

  it('never lists a content type the package does not contain', () => {
    // The rule that matters: a Drop Page listing video for a package with no
    // video is a false claim about something somebody is about to buy.
    const keys = describePackageContents(manifest()).map((row) => row.key);
    expect(keys).not.toContain('video');
    expect(keys).not.toContain('stems');
    expect(keys).not.toContain('lyrics');
    expect(keys).not.toContain('notes');
  });

  it('lists video, documents and stems when they are declared', () => {
    const rows = describePackageContents(manifest({
      components: [
        ...manifest().components,
        { type: 'video', role: 'visual', path: 'release/video/a.mp4' },
        { type: 'document', role: 'notes', path: 'release/documents/liner.pdf' },
        { type: 'audio', role: 'stem', path: 'tracks/01-t1/audio/stem-1.wav', track_id: 't1' },
      ],
    }));
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
    expect(byKey.video.detail).toBe('1 visual piece');
    expect(byKey.notes.detail).toBe('1 document');
    expect(byKey.stems.detail).toBe('1 stem file');
  });

  it('counts alternate takes as versions, never as extra tracks', () => {
    const rows = describePackageContents(manifest({
      components: [
        ...manifest().components,
        { type: 'audio', role: 'acapella_take', version_id: 'v9', track_id: 't1', path: 'tracks/01-t1/audio/acapella.mp3' },
      ],
    }));
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
    expect(byKey.audio.count).toBe(2);
    expect(byKey.versions).toMatchObject({ count: 1, detail: '1 additional take' });
  });

  it('reports lyrics only when the caller counts them', () => {
    expect(describePackageContents(manifest()).find((row) => row.key === 'lyrics')).toBeUndefined();
    expect(describePackageContents(manifest(), { lyricTrackCount: 10 }).find((row) => row.key === 'lyrics'))
      .toMatchObject({ detail: 'Synced lyrics for 10 tracks' });
  });

  it('returns nothing at all for an empty manifest rather than inventing rows', () => {
    expect(describePackageContents({})).toEqual([]);
    expect(describePackageContents(null)).toEqual([]);
  });
});

describe('describeExperienceSections', () => {
  it('offers only the sections the package declares', () => {
    const sections = describeExperienceSections(manifest(), {});
    const keys = sections.map((section) => section.key);
    expect(keys).toContain('tracklist');
    expect(keys).toContain('credits');
    expect(keys).not.toContain('play');
    expect(keys).not.toContain('video');
    expect(keys).not.toContain('gallery');
  });

  it('adds a gallery only when there is more than one image', () => {
    const oneImage = describeExperienceSections(manifest(), {});
    expect(oneImage.map((s) => s.key)).not.toContain('gallery');

    const many = describeExperienceSections(manifest({
      components: [...manifest().components, { type: 'image', role: 'photo', path: 'release/images/b.jpg' }],
    }), {});
    expect(many.map((s) => s.key)).toContain('gallery');
  });

  it('surfaces interactive pieces and the opening from the stored summary', () => {
    const sections = describeExperienceSections(manifest(), {
      has_play: true, has_opening: true, lyric_track_count: 10,
    });
    const keys = sections.map((section) => section.key);
    expect(keys).toContain('play');
    expect(keys).toContain('opening');
    expect(keys).toContain('lyrics');
  });

  it('carries the track count so a card can say how many', () => {
    const tracklist = describeExperienceSections(manifest(), {}).find((s) => s.key === 'tracklist');
    expect(tracklist.count).toBe(2);
    expect(tracklist.anchor).toBe('tracks');
  });
});

describe('summarizeExperience', () => {
  it('records only what the package actually declares', () => {
    expect(summarizeExperience({}, [])).toEqual({
      has_opening: false, has_story: false, has_play: false, has_guide: false,
      lyric_track_count: 0,
    });
  });

  it('reads the journey, story, games and guide out of experience.json', () => {
    expect(summarizeExperience({
      journey: { release_moments: [{ id: 'm1' }] },
      guide: { story: 'How it was made' },
      play: { games: ['echo'] },
    }, [])).toMatchObject({
      has_opening: true, has_story: true, has_play: true, has_guide: true,
    });
  });

  it('does not count whitespace as a story', () => {
    expect(summarizeExperience({ guide: { story: '   ' } }, []).has_story).toBe(false);
  });

  it('counts a track as having lyrics for timed lines or plain text', () => {
    const count = summarizeExperience({}, [
      { lyrics: { timed_lines: [{ t: 0 }] } },
      { lyrics: { plain_text: 'a line' } },
      { lyrics: { timed_lines: [], plain_text: '  ' } },
      { lyrics: {} },
      {},
    ]).lyric_track_count;
    expect(count).toBe(2);
  });
});

describe('describeTrustIndicators', () => {
  it('always states what is true of every package', () => {
    const keys = describeTrustIndicators({}).map((item) => item.key);
    expect(keys).toEqual(['offline', 'portable']);
  });

  it('claims a signature only when a signature and a key are both present', () => {
    const unsigned = describeTrustIndicators({ authenticity: { signature: 'abc' } });
    expect(unsigned.map((item) => item.key)).not.toContain('signed');

    const signed = describeTrustIndicators({
      authenticity: { signature: 'abc', signer_public_key: 'key' },
    });
    expect(signed.map((item) => item.key)).toContain('signed');
  });

  it('claims validation only when the package record says valid', () => {
    expect(describeTrustIndicators({ packageRecord: { validation_status: 'unvalidated' } })
      .map((item) => item.key)).not.toContain('validated');
    expect(describeTrustIndicators({ packageRecord: { validation_status: 'valid' } })
      .map((item) => item.key)).toContain('validated');
  });
});

describe('formatting', () => {
  it('omits a duration the manifest does not carry', () => {
    expect(formatDuration(0)).toBe('');
    expect(formatDuration(null)).toBe('');
  });

  it('reads durations the way a person would say them', () => {
    expect(formatDuration(60_000)).toBe('1 minute');
    expect(formatDuration(3_600_000)).toBe('1 hour');
    expect(formatDuration(3_780_000)).toBe('1 hr 3 min');
  });

  it('formats sizes without false precision', () => {
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(52 * 1024 * 1024)).toBe('52 MB');
  });
});
