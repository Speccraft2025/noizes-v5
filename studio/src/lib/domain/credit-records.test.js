import { describe, expect, it } from 'vitest';
import { createReleaseProject } from './release.js';
import { creditRecordsForTrack, mergeFeaturedCreditRecords } from './credit-records.js';

describe('structured release credits', () => {
  it('prefills featured artists and links track-level appearances', () => {
    const project = createReleaseProject({
      release: { title: 'Signals', primary_artist: 'A', featured_artists: ['Release Guest'] },
      tracks: [
        { title: 'One', featured_artists: ['Track Guest'] },
        { title: 'Two', featured_artists: ['Track Guest', 'Release Guest'] },
      ],
    });
    const merged = mergeFeaturedCreditRecords(project);
    const records = merged.rights.release_rights.credit_records;
    expect(records.map((record) => record.name)).toEqual(['Release Guest', 'Track Guest']);
    expect(records.find((record) => record.name === 'Track Guest').track_ids).toEqual([
      project.tracks[0].track_id,
      project.tracks[1].track_id,
    ]);
    expect(creditRecordsForTrack(merged, project.tracks[1].track_id)).toHaveLength(2);
  });

  it('does not duplicate or overwrite an edited featured-artist record', () => {
    const project = createReleaseProject({
      release: { title: 'Single', primary_artist: 'A', featured_artists: ['Guest'] },
      rights: {
        release_rights: {
          credit_records: [{ name: 'Guest', role: 'Featured Artist', email: 'guest@example.com', track_ids: [] }],
        },
      },
    });
    const merged = mergeFeaturedCreditRecords(mergeFeaturedCreditRecords(project));
    expect(merged.rights.release_rights.credit_records).toHaveLength(1);
    expect(merged.rights.release_rights.credit_records[0].email).toBe('guest@example.com');
  });
});
