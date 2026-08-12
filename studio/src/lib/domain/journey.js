const clean = (value) => String(value ?? '').trim();

export const RELEASE_MOMENT_TYPES = Object.freeze([
  'opening',
  'release_identity',
  'release_introduction',
  'tracklist_reveal',
  'interlude',
  'chapter_card',
  'disc_change',
  'story',
  'artwork',
  'gallery',
  'credits',
  'closing_reflection',
  'collector_message',
  'archive_invitation',
  'history_invitation',
]);

export const TRACK_MOMENT_TYPES = Object.freeze([
  'title_reveal',
  'artwork',
  'lyrics',
  'image',
  'video',
  'story',
  'note',
  'effect',
  'credits',
  'track_ending',
  'transition',
]);

export const RELEASE_PLACEMENTS = Object.freeze([
  'before_first_track',
  'before_track',
  'after_track',
  'disc_start',
  'disc_end',
  'during_transition',
  'after_final_track',
]);

export const RELEASE_PACING = Object.freeze({
  opening:              10000,
  release_identity:      8000,
  release_introduction: 12000,
  tracklist_reveal:     10000,
  interlude:             7000,
  chapter_card:          6000,
  disc_change:           6000,
  story:                12000,
  artwork:              10000,
  gallery:              14000,
  credits:              10000,
  closing_reflection:   12000,
  collector_message:    10000,
  archive_invitation:    8000,
  history_invitation:    8000,
});

export const TRACK_PACING = Object.freeze({
  title_reveal:  6000,
  artwork:       8000,
  lyrics:        7000,
  image:         8000,
  video:        10000,
  story:         8000,
  note:          7000,
  effect:        5000,
  credits:       7000,
  track_ending:  5000,
  transition:    4000,
});

export const MOMENT_EFFECTS = Object.freeze([
  'none',
  'soft_glow',
  'cover_bloom',
  'slow_drift',
  'film_grain',
  'violet_wash',
]);

function fallbackId(seed) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `moment-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function momentId(value, seed, idFactory) {
  return clean(value) || clean(idFactory?.()) || fallbackId(seed);
}

export function createReleaseMoment(input = {}, options = {}) {
  const type = RELEASE_MOMENT_TYPES.includes(input.type) ? input.type : 'story';
  const placement = RELEASE_PLACEMENTS.includes(input.placement) ? input.placement : 'before_first_track';
  return {
    moment_id: momentId(input.moment_id ?? input.id, `release:${options.index ?? 0}:${type}:${placement}`, options.idFactory),
    scope: 'release',
    type,
    title: clean(input.title) || type.replaceAll('_', ' '),
    body: clean(input.body ?? input.text),
    placement,
    anchor_track_id: clean(input.anchor_track_id ?? input.track_id),
    disc_number: Math.max(0, Number.parseInt(input.disc_number, 10) || 0),
    order: Math.max(1, Number.parseInt(input.order, 10) || (options.index ?? 0) + 1),
    asset_ref: clean(input.asset_ref),
    effect: MOMENT_EFFECTS.includes(input.effect) ? input.effect : 'none',
    duration_ms: Math.max(0, Number(input.duration_ms) || RELEASE_PACING[type] || 5000),
    enabled: input.enabled !== false,
  };
}

export function createTrackMoment(input = {}, options = {}) {
  const type = TRACK_MOMENT_TYPES.includes(input.type) ? input.type : 'story';
  const trackId = clean(input.track_id ?? options.trackId);
  return {
    moment_id: momentId(input.moment_id ?? input.id, `track:${trackId}:${options.index ?? 0}:${type}`, options.idFactory),
    scope: 'track',
    track_id: trackId,
    at_ms: Math.max(0, Number(input.at_ms ?? input.time_ms) || 0),
    type,
    title: clean(input.title) || type.replaceAll('_', ' '),
    body: clean(input.body ?? input.text),
    asset_ref: clean(input.asset_ref),
    effect: MOMENT_EFFECTS.includes(input.effect) ? input.effect : 'none',
    duration_ms: Math.max(0, Number(input.duration_ms) || TRACK_PACING[type] || 3500),
    enabled: input.enabled !== false,
  };
}

export function createDefaultReleaseMoments(options = {}) {
  const defaults = [
    { type: 'opening', title: 'Object Encounter', placement: 'before_first_track' },
    { type: 'release_identity', title: 'Release identity', placement: 'before_first_track' },
    { type: 'tracklist_reveal', title: 'Tracklist reveal', placement: 'before_first_track' },
    { type: 'closing_reflection', title: 'Closing reflection', placement: 'after_final_track' },
    { type: 'credits', title: 'Credits preview', placement: 'after_final_track' },
    { type: 'collector_message', title: 'Collector message', placement: 'after_final_track' },
    { type: 'archive_invitation', title: 'Explore Archive', placement: 'after_final_track' },
    { type: 'history_invitation', title: 'View History', placement: 'after_final_track' },
  ];
  return defaults.map((moment, index) => createReleaseMoment(moment, {
    index,
    idFactory: options.idFactory,
  }));
}

export function createDefaultTrackJourney(track, options = {}) {
  return {
    track_id: track.track_id,
    moments: [createTrackMoment({
      track_id: track.track_id,
      type: 'title_reveal',
      title: track.title || `Track ${track.track_number || (options.index ?? 0) + 1}`,
      body: track.primary_artist || '',
      at_ms: 0,
      duration_ms: 3000,
      effect: 'cover_bloom',
    }, { trackId: track.track_id, index: 0, idFactory: options.idFactory })],
  };
}

/**
 * Creates a complete authored Journey without manufacturing per-track copies
 * of release ownership or edition state. Empty journeys receive the album
 * default; authored arrays are preserved and normalized.
 */
export function materializeJourney(journey = {}, tracks = [], options = {}) {
  const releaseInput = Array.isArray(journey.release_moments) ? journey.release_moments : [];
  const releaseMoments = releaseInput.length
    ? releaseInput.map((moment, index) => createReleaseMoment(moment, { index, idFactory: options.idFactory }))
    : createDefaultReleaseMoments(options);

  const inputByTrack = new Map((Array.isArray(journey.track_journeys) ? journey.track_journeys : [])
    .map((entry) => [entry.track_id, entry]));
  const trackJourneys = tracks.map((track, trackIndex) => {
    const entry = inputByTrack.get(track.track_id);
    if (!entry || !Array.isArray(entry.moments) || !entry.moments.length) {
      return createDefaultTrackJourney(track, { index: trackIndex, idFactory: options.idFactory });
    }
    return {
      track_id: track.track_id,
      moments: entry.moments
        .map((moment, index) => createTrackMoment(moment, { trackId: track.track_id, index, idFactory: options.idFactory }))
        .sort((left, right) => left.at_ms - right.at_ms || left.moment_id.localeCompare(right.moment_id)),
    };
  });

  return {
    ...journey,
    version: Math.max(1, Number.parseInt(journey.version, 10) || 1),
    release_moments: releaseMoments.sort((left, right) => left.order - right.order || left.moment_id.localeCompare(right.moment_id)),
    track_journeys: trackJourneys,
    transitions: Array.isArray(journey.transitions) ? journey.transitions : [],
  };
}

export function releaseTimeline(journey = {}, tracks = []) {
  const materialized = materializeJourney(journey, tracks);
  const before = materialized.release_moments.filter((moment) => moment.placement === 'before_first_track');
  const after = materialized.release_moments.filter((moment) => moment.placement === 'after_final_track');
  const items = before.map((moment) => ({ kind: 'moment', moment }));

  tracks.forEach((track, index) => {
    const anchoredBefore = materialized.release_moments.filter((moment) =>
      moment.placement === 'before_track' && moment.anchor_track_id === track.track_id
    );
    items.push(...anchoredBefore.map((moment) => ({ kind: 'moment', moment })));
    items.push({ kind: 'track', track });
    if (index < tracks.length - 1) {
      const anchored = materialized.release_moments.filter((moment) =>
        ['after_track', 'during_transition'].includes(moment.placement) && moment.anchor_track_id === track.track_id
      );
      items.push(...anchored.map((moment) => ({ kind: 'moment', moment })));
      items.push({
        kind: 'transition',
        from_track_id: track.track_id,
        to_track_id: tracks[index + 1].track_id,
      });
    }
  });
  items.push(...after.map((moment) => ({ kind: 'moment', moment })));
  return items;
}

export function momentsReached(moments = [], previousMs, currentMs, visited = []) {
  const visitedSet = new Set(visited);
  const from = Math.max(0, Number(previousMs) || 0);
  const to = Math.max(0, Number(currentMs) || 0);
  if (to < from) return [];
  return moments.filter((moment) => moment.enabled !== false
    && !visitedSet.has(moment.moment_id)
    && Number(moment.at_ms) >= from
    && Number(moment.at_ms) <= to);
}

export function validateJourney(journey = {}, tracks = []) {
  const errors = [];
  const warnings = [];
  const trackIds = new Set(tracks.map((track) => track.track_id));
  const momentIds = new Set();
  const add = (severity, code, path, message) => (severity === 'error' ? errors : warnings).push({ code, path, message });

  for (const [index, moment] of (journey.release_moments || []).entries()) {
    const path = `journey.release_moments[${index}]`;
    if (!clean(moment.moment_id)) add('error', 'journey_moment_id_missing', `${path}.moment_id`, 'Journey Moments need stable IDs.');
    if (momentIds.has(moment.moment_id)) add('error', 'journey_moment_id_duplicate', `${path}.moment_id`, 'Journey Moment IDs must be unique.');
    momentIds.add(moment.moment_id);
    if (!RELEASE_MOMENT_TYPES.includes(moment.type)) add('error', 'journey_release_type_invalid', `${path}.type`, 'Choose a supported release Moment type.');
    if (['before_track', 'after_track', 'during_transition'].includes(moment.placement) && !trackIds.has(moment.anchor_track_id)) {
      add('warning', 'journey_anchor_missing', `${path}.anchor_track_id`, 'This release Moment is not anchored to an existing track.');
    }
  }
  for (const [journeyIndex, trackJourney] of (journey.track_journeys || []).entries()) {
    const path = `journey.track_journeys[${journeyIndex}]`;
    if (!trackIds.has(trackJourney.track_id)) add('warning', 'journey_track_missing', `${path}.track_id`, 'This timeline belongs to a track that no longer exists.');
    for (const [index, moment] of (trackJourney.moments || []).entries()) {
      const momentPath = `${path}.moments[${index}]`;
      if (!clean(moment.moment_id)) add('error', 'journey_moment_id_missing', `${momentPath}.moment_id`, 'Journey Moments need stable IDs.');
      if (momentIds.has(moment.moment_id)) add('error', 'journey_moment_id_duplicate', `${momentPath}.moment_id`, 'Journey Moment IDs must be unique.');
      momentIds.add(moment.moment_id);
      if (!TRACK_MOMENT_TYPES.includes(moment.type)) add('error', 'journey_track_type_invalid', `${momentPath}.type`, 'Choose a supported track Moment type.');
      if (Number(moment.at_ms) < 0) add('error', 'journey_time_invalid', `${momentPath}.at_ms`, 'A Moment time cannot be negative.');
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}
