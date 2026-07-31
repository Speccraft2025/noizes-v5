import { describe, expect, it } from 'vitest';
import {
  createReleaseMoment,
  createTrackMoment,
  materializeJourney,
  momentsReached,
  releaseTimeline,
  validateJourney,
} from './journey.js';

const tracks = [
  { track_id: 'track-a', track_number: 1, title: 'A', primary_artist: 'Artist' },
  { track_id: 'track-b', track_number: 2, title: 'B', primary_artist: 'Artist' },
];

describe('Journey domain', () => {
  it('materializes the coherent album default from an empty Journey', () => {
    const journey = materializeJourney({}, tracks, { idFactory: (() => { let id = 0; return () => `id-${++id}`; })() });
    expect(journey.release_moments.map((moment) => moment.type)).toContain('opening');
    expect(journey.release_moments.map((moment) => moment.type)).toContain('archive_invitation');
    expect(journey.track_journeys).toHaveLength(2);
    expect(journey.track_journeys[1].moments[0]).toMatchObject({ track_id: 'track-b', type: 'title_reveal', at_ms: 0 });
  });

  it('presents one release overview with transitions between tracks', () => {
    const timeline = releaseTimeline({}, tracks);
    expect(timeline.filter((item) => item.kind === 'track')).toHaveLength(2);
    expect(timeline.filter((item) => item.kind === 'transition')).toEqual([
      expect.objectContaining({ from_track_id: 'track-a', to_track_id: 'track-b' }),
    ]);
    expect(timeline.at(0).moment.type).toBe('opening');
    expect(timeline.at(-1).moment.type).toBe('history_invitation');
  });

  it('finds synchronized Moments after a track change without replaying visited Moments', () => {
    const moments = [
      createTrackMoment({ moment_id: 'title', track_id: 'track-b', at_ms: 0, type: 'title_reveal' }),
      createTrackMoment({ moment_id: 'story', track_id: 'track-b', at_ms: 12000, type: 'story' }),
    ];
    expect(momentsReached(moments, 0, 250, [])).toEqual([expect.objectContaining({ moment_id: 'title' })]);
    expect(momentsReached(moments, 0, 13000, ['title'])).toEqual([expect.objectContaining({ moment_id: 'story' })]);
    expect(momentsReached(moments, 13000, 1000, [])).toEqual([]);
  });

  it('validates stable IDs, anchors and track Moment types', () => {
    const journey = {
      release_moments: [createReleaseMoment({ moment_id: 'same', type: 'story', placement: 'before_track', anchor_track_id: 'gone' })],
      track_journeys: [{ track_id: 'track-a', moments: [createTrackMoment({ moment_id: 'same', type: 'story', track_id: 'track-a' })] }],
    };
    const result = validateJourney(journey, tracks);
    expect(result.valid).toBe(false);
    expect(result.errors.map((issue) => issue.code)).toContain('journey_moment_id_duplicate');
    expect(result.warnings.map((issue) => issue.code)).toContain('journey_anchor_missing');
  });
});
