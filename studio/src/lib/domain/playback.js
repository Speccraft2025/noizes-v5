import { PLAYBACK_MODES } from './release.js';

export function normalizePlaybackSettings(input = {}) {
  return {
    mode: PLAYBACK_MODES.includes(input.mode) ? input.mode : 'sequential',
    crossfade_ms: Math.max(250, Number(input.crossfade_ms) || 1500),
    allow_track_skip: input.allow_track_skip !== false,
    allow_seek: input.allow_seek !== false,
    allow_shuffle: input.allow_shuffle === true,
    allow_repeat: input.allow_repeat !== false,
    allow_archive_during_journey: input.allow_archive_during_journey !== false,
    resume_enabled: input.resume_enabled !== false,
  };
}

export function playbackResumeKey({ releaseId, editionId = 'edition', copyId = 'open-copy' }) {
  return `nz-release-resume:${releaseId || 'unknown'}:${editionId}:${copyId}`;
}

export function completeReleasePositionMs(tracks, activeIndex, trackPositionMs) {
  return tracks.slice(0, activeIndex).reduce((total, track) => total + (Number(track.duration_ms) || 0), 0)
    + Math.max(0, Number(trackPositionMs) || 0);
}

export function createPlaybackState(config = {}, restored = null) {
  const tracks = Array.isArray(config.tracks) ? config.tracks : [];
  const settings = normalizePlaybackSettings(config.playback);
  const restoredIndex = restored?.current_track_id
    ? tracks.findIndex((track) => track.track_id === restored.current_track_id)
    : -1;
  const activeIndex = restoredIndex >= 0 ? restoredIndex : 0;
  const trackPositionMs = Math.max(0, Number(restored?.current_track_position_ms) || 0);
  return {
    tracks,
    settings,
    active_index: activeIndex,
    active_track_id: tracks[activeIndex]?.track_id || '',
    queue: tracks.slice(activeIndex + 1).map((track) => track.track_id),
    track_position_ms: trackPositionMs,
    complete_release_position_ms: completeReleasePositionMs(tracks, activeIndex, trackPositionMs),
    playing: false,
    transition: null,
    completed_tracks: Array.isArray(restored?.completed_tracks) ? [...new Set(restored.completed_tracks)] : [],
    release_completed: Boolean(restored?.release_completed),
  };
}

function atIndex(state, index, positionMs = 0) {
  const bounded = Math.max(0, Math.min(index, Math.max(0, state.tracks.length - 1)));
  return {
    ...state,
    active_index: bounded,
    active_track_id: state.tracks[bounded]?.track_id || '',
    queue: state.tracks.slice(bounded + 1).map((track) => track.track_id),
    track_position_ms: positionMs,
    complete_release_position_ms: completeReleasePositionMs(state.tracks, bounded, positionMs),
    transition: null,
  };
}

export function reducePlayback(state, event) {
  switch (event.type) {
    case 'play':
      return { ...state, playing: true };
    case 'pause':
      return { ...state, playing: false, transition: null };
    case 'time': {
      const position = Math.max(0, Number(event.position_ms) || 0);
      return {
        ...state,
        track_position_ms: position,
        complete_release_position_ms: completeReleasePositionMs(state.tracks, state.active_index, position),
      };
    }
    case 'seek':
      if (!state.settings.allow_seek) return state;
      return reducePlayback(state, { type: 'time', position_ms: event.position_ms });
    case 'select_track': {
      if (!state.settings.allow_track_skip) return state;
      const index = state.tracks.findIndex((track) => track.track_id === event.track_id);
      return index < 0 ? state : { ...atIndex(state, index), playing: event.autoplay ?? state.playing };
    }
    case 'transition_start': {
      const nextIndex = state.active_index + 1;
      if (nextIndex >= state.tracks.length) return state;
      return {
        ...state,
        transition: {
          type: state.settings.mode,
          from_track_id: state.active_track_id,
          to_track_id: state.tracks[nextIndex].track_id,
          duration_ms: state.settings.mode === 'crossfade' ? state.settings.crossfade_ms : 0,
          progress: 0,
        },
      };
    }
    case 'transition_progress':
      return state.transition ? {
        ...state,
        transition: { ...state.transition, progress: Math.max(0, Math.min(1, Number(event.progress) || 0)) },
      } : state;
    case 'track_ended':
    case 'transition_complete': {
      const completed = [...new Set([...state.completed_tracks, state.active_track_id].filter(Boolean))];
      if (state.active_index >= state.tracks.length - 1) {
        return {
          ...state,
          playing: false,
          transition: null,
          completed_tracks: completed,
          release_completed: state.tracks.length > 0 && completed.length >= state.tracks.length,
        };
      }
      return {
        ...atIndex({ ...state, completed_tracks: completed }, state.active_index + 1),
        playing: state.playing,
      };
    }
    default:
      return state;
  }
}
