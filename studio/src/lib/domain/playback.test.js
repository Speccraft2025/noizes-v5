import { describe, expect, it } from 'vitest';
import {
  completeReleasePositionMs,
  createPlaybackState,
  normalizePlaybackSettings,
  playbackResumeKey,
  reducePlayback,
} from './playback.js';

const tracks = [
  { track_id: 'one', disc_number: 1, duration_ms: 100_000 },
  { track_id: 'two', disc_number: 1, duration_ms: 120_000 },
  { track_id: 'three', disc_number: 2, duration_ms: 80_000 },
];

describe('release playback state', () => {
  it('normalizes sequential, gapless, and crossfade settings', () => {
    expect(normalizePlaybackSettings({ mode: 'sequential' }).mode).toBe('sequential');
    expect(normalizePlaybackSettings({ mode: 'gapless' }).mode).toBe('gapless');
    expect(normalizePlaybackSettings({ mode: 'crossfade', crossfade_ms: 2200 })).toMatchObject({ mode: 'crossfade', crossfade_ms: 2200 });
    expect(normalizePlaybackSettings({ mode: 'unknown' }).mode).toBe('sequential');
  });

  it('advances a sequential release and completes the album', () => {
    let state = createPlaybackState({ tracks, playback: { mode: 'sequential' } });
    state = reducePlayback(state, { type: 'play' });
    state = reducePlayback(state, { type: 'track_ended' });
    expect(state).toMatchObject({ active_track_id: 'two', active_index: 1, playing: true, completed_tracks: ['one'] });
    state = reducePlayback(state, { type: 'track_ended' });
    state = reducePlayback(state, { type: 'track_ended' });
    expect(state).toMatchObject({ active_track_id: 'three', playing: false, release_completed: true, completed_tracks: ['one', 'two', 'three'] });
  });

  it('models a gapless handoff as one release-level transition', () => {
    let state = createPlaybackState({ tracks, playback: { mode: 'gapless' } });
    state = reducePlayback(reducePlayback(state, { type: 'play' }), { type: 'transition_start' });
    expect(state.transition).toMatchObject({ type: 'gapless', from_track_id: 'one', to_track_id: 'two', duration_ms: 0 });
    state = reducePlayback(state, { type: 'transition_complete' });
    expect(state).toMatchObject({ active_track_id: 'two', playing: true, transition: null });
  });

  it('tracks crossfade progress and cancels cleanly on pause', () => {
    let state = createPlaybackState({ tracks, playback: { mode: 'crossfade', crossfade_ms: 1750 } });
    state = reducePlayback(reducePlayback(state, { type: 'play' }), { type: 'transition_start' });
    state = reducePlayback(state, { type: 'transition_progress', progress: 0.4 });
    expect(state.transition).toMatchObject({ type: 'crossfade', duration_ms: 1750, progress: 0.4 });
    state = reducePlayback(state, { type: 'pause' });
    expect(state).toMatchObject({ playing: false, transition: null, active_track_id: 'one' });
  });

  it('enforces seek and skip policy', () => {
    let locked = createPlaybackState({ tracks, playback: { allow_seek: false, allow_track_skip: false } });
    expect(reducePlayback(locked, { type: 'seek', position_ms: 50_000 })).toBe(locked);
    expect(reducePlayback(locked, { type: 'select_track', track_id: 'three' })).toBe(locked);

    let open = createPlaybackState({ tracks, playback: { allow_seek: true, allow_track_skip: true } });
    open = reducePlayback(open, { type: 'seek', position_ms: 45_000 });
    open = reducePlayback(open, { type: 'select_track', track_id: 'three', autoplay: true });
    expect(open).toMatchObject({ active_track_id: 'three', track_position_ms: 0, playing: true });
  });

  it('calculates whole-release position and restores a later track', () => {
    expect(completeReleasePositionMs(tracks, 2, 15_000)).toBe(235_000);
    const restored = createPlaybackState({ tracks, playback: {} }, {
      current_track_id: 'two',
      current_track_position_ms: 30_000,
      completed_tracks: ['one'],
    });
    expect(restored).toMatchObject({ active_track_id: 'two', active_index: 1, complete_release_position_ms: 130_000, completed_tracks: ['one'] });
    expect(playbackResumeKey({ releaseId: 'r', editionId: 'e', copyId: 'c' })).toBe('nz-release-resume:r:e:c');
  });

  it('honors creator permissions for shuffle and repeat controls', () => {
    let state = createPlaybackState({ tracks, playback: { allow_shuffle: true, allow_repeat: true } });
    state = reducePlayback(state, { type: 'set_shuffle', enabled: true });
    state = reducePlayback(state, { type: 'set_repeat', enabled: true });
    expect(state).toMatchObject({ shuffle_enabled: true, repeat_enabled: true });
    const locked = reducePlayback(createPlaybackState({ tracks, playback: { allow_shuffle: false, allow_repeat: false } }), { type: 'set_shuffle', enabled: true });
    expect(locked.shuffle_enabled).toBe(false);
  });

  it('marks the release complete before a permitted repeat begins again', () => {
    let state = createPlaybackState({ tracks, playback: { allow_repeat: true } });
    state = reducePlayback(state, { type: 'set_repeat', enabled: true });
    state = { ...state, active_index: tracks.length - 1, active_track_id: tracks.at(-1).track_id, playing: true };
    state = reducePlayback(state, { type: 'track_ended' });
    expect(state).toMatchObject({ active_index: 0, release_completed: true, repeat_enabled: true, playing: true });
  });
});
