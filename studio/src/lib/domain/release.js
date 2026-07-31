export const STUDIO_PROJECT_SCHEMA_VERSION = 2;

export const RELEASE_TYPES = Object.freeze([
  'single',
  'ep',
  'album',
  'mixtape',
  'compilation',
  'live_release',
  'soundtrack',
  'dj_mix',
  'other',
]);

export const RELEASE_TYPE_LABELS = Object.freeze({
  single: 'Single',
  ep: 'EP',
  album: 'Album',
  mixtape: 'Mixtape',
  compilation: 'Compilation',
  live_release: 'Live Release',
  soundtrack: 'Soundtrack',
  dj_mix: 'DJ Mix',
  other: 'Other',
});

export const AUDIO_VERSION_ROLES = Object.freeze([
  'primary_master',
  'alternate',
  'instrumental',
  'acapella',
  'demo',
  'stem',
  'live',
  'radio_edit',
  'extended',
  'commentary',
  'bonus_audio',
]);

export const PLAYBACK_MODES = Object.freeze([
  'sequential',
  'gapless',
  'crossfade',
  'manual',
  'creator_defined',
  'continuous_master',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MULTI_TRACK_TYPES = new Set(['ep', 'album', 'mixtape', 'compilation', 'live_release', 'soundtrack']);

const clean = (value) => String(value ?? '').trim();
const positiveInt = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

function stringList(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (!clean(value)) return [];
  return String(value).split(',').map(clean).filter(Boolean);
}

function hashWords(value) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  let h3 = 0xc0decafe;
  let h4 = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
    h3 = Math.imul(h3 ^ code, 2246822507);
    h4 = Math.imul(h4 ^ code, 3266489909);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** Stable compatibility ID for legacy packages that used human-readable IDs. */
export function stableUuid(value) {
  const words = hashWords(`noizes:${clean(value) || 'legacy'}`);
  const bytes = words.flatMap((word) => [word >>> 24, word >>> 16, word >>> 8, word].map((part) => part & 0xff));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return stableUuid(`${Date.now()}:${Math.random()}`);
}

function normalizeId(value, fallbackSeed, idFactory) {
  const id = clean(value);
  if (UUID_RE.test(id)) return id.toLowerCase();
  if (id) return stableUuid(id);
  return clean(idFactory?.()) || stableUuid(fallbackSeed);
}

export function normalizeReleaseType(value) {
  const normalized = clean(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'live') return 'live_release';
  if (normalized === 'djmix') return 'dj_mix';
  return RELEASE_TYPES.includes(normalized) ? normalized : 'other';
}

export function createTrack(input = {}, options = {}) {
  const idFactory = options.idFactory || createUuid;
  const releaseId = options.releaseId || 'unassigned-release';
  const index = options.index ?? 0;
  const inheritedArtist = clean(options.releaseArtist);
  const suppliedArtist = clean(input.primary_artist ?? input.artist);

  return {
    track_id: normalizeId(input.track_id ?? input.id, `${releaseId}:track:${index + 1}`, idFactory),
    position: positiveInt(input.position ?? input.sequence, index + 1),
    disc_number: positiveInt(input.disc_number, 1),
    track_number: positiveInt(input.track_number, index + 1),
    title: clean(input.title),
    subtitle: clean(input.subtitle),
    primary_artist: suppliedArtist || inheritedArtist,
    featured_artists: stringList(input.featured_artists),
    producers: stringList(input.producers ?? input.producer),
    writers: stringList(input.writers ?? input.composers),
    isrc: clean(input.isrc).toUpperCase(),
    explicit: Boolean(input.explicit),
    bonus: Boolean(input.bonus),
    hidden: Boolean(input.hidden),
    description: clean(input.description ?? input.notes),
    release_date: clean(input.release_date),
    artwork_ref: clean(input.artwork_ref),
    primary_version_id: clean(input.primary_version_id),
    primary_audio_ref: clean(input.primary_audio_ref),
    lyrics_ref: clean(input.lyrics_ref),
    credits_ref: clean(input.credits_ref),
    rights_ref: clean(input.rights_ref),
    appears_in_journey: input.appears_in_journey !== false,
    appears_in_archive: input.appears_in_archive !== false,
    inherit_release_artist: input.inherit_release_artist ?? !suppliedArtist,
    inherit_release_credits: input.inherit_release_credits !== false,
    inherit_release_rights: input.inherit_release_rights !== false,
  };
}

export function createAudioVersion(input = {}, options = {}) {
  const idFactory = options.idFactory || createUuid;
  const trackId = clean(input.track_id ?? options.trackId);
  const role = clean(input.role) || 'alternate';
  return {
    version_id: normalizeId(input.version_id ?? input.id, `${trackId}:version:${options.index ?? 0}:${role}`, idFactory),
    track_id: trackId,
    role,
    title: clean(input.title) || (role === 'primary_master' ? 'Primary master' : 'Alternate version'),
    is_primary: input.is_primary === true || role === 'primary_master',
    audio_asset_id: clean(input.audio_asset_id ?? input.asset_id),
    notes: clean(input.notes),
  };
}

export function createAudioAsset(input = {}, options = {}) {
  const idFactory = options.idFactory || createUuid;
  const trackId = clean(input.track_id ?? options.trackId);
  const scope = input.scope === 'release' || !trackId ? 'release' : 'track';
  const role = clean(input.role) || (scope === 'track' ? 'alternate' : 'continuous_master');
  const file = input.file ?? input.audioFile ?? null;
  const filename = clean(input.filename ?? input.name ?? file?.name);

  return {
    asset_id: normalizeId(input.asset_id ?? input.component_id ?? input.id, `${options.releaseId}:asset:${options.index ?? 0}:${filename || role}`, idFactory),
    version_id: clean(input.version_id),
    track_id: scope === 'track' ? trackId : '',
    scope,
    type: 'audio',
    role,
    title: clean(input.title) || filename || (role === 'primary_master' ? 'Primary master' : role.replaceAll('_', ' ')),
    filename,
    path: clean(input.path ?? input.storage_path),
    mime: clean(input.mime ?? file?.type),
    duration_ms: Math.max(0, Number(input.duration_ms) || 0),
    sample_rate: Math.max(0, Number(input.sample_rate) || 0),
    bit_depth: Math.max(0, Number(input.bit_depth) || 0),
    channels: Math.max(0, Number(input.channels) || 0),
    size: Math.max(0, Number(input.size ?? file?.size) || 0),
    sha256: clean(input.sha256).toLowerCase(),
    file,
  };
}

export function createReleaseAsset(input = {}, options = {}) {
  const idFactory = options.idFactory || createUuid;
  const file = input.file ?? null;
  const filename = clean(input.filename ?? file?.name);
  return {
    asset_id: normalizeId(input.asset_id ?? input.id, `${options.releaseId}:release-asset:${options.index ?? 0}:${filename || input.role}`, idFactory),
    scope: 'release',
    type: clean(input.type) || 'image',
    role: clean(input.role) || 'supporting',
    title: clean(input.title),
    filename,
    path: clean(input.path ?? input.storage_path),
    mime: clean(input.mime ?? file?.type),
    size: Math.max(0, Number(input.size ?? file?.size) || 0),
    sha256: clean(input.sha256).toLowerCase(),
    file,
  };
}

function defaultJourney(trackIds, input = {}) {
  const trackJourneys = Array.isArray(input.track_journeys)
    ? input.track_journeys
    : trackIds.map((trackId) => ({ track_id: trackId, moments: [] }));
  return {
    version: positiveInt(input.version, 1),
    playback_mode: PLAYBACK_MODES.includes(input.playback_mode) ? input.playback_mode : 'sequential',
    release_moments: Array.isArray(input.release_moments) ? input.release_moments : [],
    track_journeys: trackJourneys,
    transitions: Array.isArray(input.transitions) ? input.transitions : [],
    navigation: {
      allow_track_skip: input.navigation?.allow_track_skip !== false,
      allow_seek: input.navigation?.allow_seek !== false,
      allow_shuffle: input.navigation?.allow_shuffle === true,
      allow_repeat: input.navigation?.allow_repeat !== false,
      allow_archive_during_journey: input.navigation?.allow_archive_during_journey !== false,
      resume_enabled: input.navigation?.resume_enabled !== false,
    },
    legacy_guide: input.legacy_guide ?? input.guide ?? null,
  };
}

/**
 * Converts both current Studio state and legacy v1 manifests into the one
 * multi-track-capable project model used by every new release.
 */
export function normalizeReleaseProject(input = {}, options = {}) {
  const idFactory = options.idFactory || createUuid;
  const now = options.now || new Date();
  const identity = input.release ?? input.identity ?? input;
  const suppliedReleaseId = clean(identity.release_id ?? input.release_id);
  const releaseId = normalizeId(suppliedReleaseId, `release:${identity.primary_artist ?? identity.artist}:${identity.title}:${now.getFullYear()}`, idFactory);
  const releaseType = normalizeReleaseType(identity.release_type ?? input.release_type ?? 'single');
  const primaryArtist = clean(identity.primary_artist ?? identity.artist);
  const release = {
    release_id: releaseId,
    legacy_release_id: suppliedReleaseId && !UUID_RE.test(suppliedReleaseId) ? suppliedReleaseId : '',
    release_type: releaseType,
    title: clean(identity.title),
    primary_artist: primaryArtist,
    featured_artists: stringList(identity.featured_artists),
    compilation_artists: stringList(identity.compilation_artists),
    year: clean(identity.year) || String(now.getFullYear()),
    release_date: clean(identity.release_date),
    genre: stringList(identity.genre ?? identity.genres),
    location: clean(identity.location),
    description: clean(identity.description),
    catalogue_number: clean(identity.catalogue_number),
    label: clean(identity.label),
  };

  const hasExplicitTracks = Array.isArray(input.tracks);
  const sourceTracks = hasExplicitTracks
    ? input.tracks
    : [{
        title: release.title,
        primary_artist: release.primary_artist,
        inherit_release_artist: true,
        disc_number: 1,
        track_number: 1,
      }];
  let tracks = sourceTracks.map((track, index) => createTrack(track, {
    idFactory,
    releaseId,
    releaseArtist: primaryArtist,
    index,
  }));

  const embeddedVersions = sourceTracks.flatMap((track, trackIndex) =>
    Array.isArray(track.audio_versions)
      ? track.audio_versions.filter((version) => version && typeof version === 'object').map((version) => ({
          ...version,
          track_id: version.track_id || tracks[trackIndex]?.track_id,
        }))
      : []
  );
  let audioVersions = [...(input.audio_versions ?? input.versions ?? []), ...embeddedVersions]
    .map((version, index) => createAudioVersion(version, { idFactory, index }));
  let audioAssets = (input.audio_assets ?? []).map((asset, index) => createAudioAsset(asset, {
    idFactory,
    releaseId,
    index,
  }));
  let releaseAssets = (input.release_assets ?? []).map((asset, index) => createReleaseAsset(asset, {
    idFactory,
    releaseId,
    index,
  }));

  // Current v1 Studio state stored one audio and one cover in an overloaded
  // Assets object. Normalize it without making those fields part of v2.
  const legacyAssets = input.assets && !Array.isArray(input.assets) ? input.assets : null;
  if (legacyAssets && tracks[0]) {
    if (legacyAssets.audioFile || legacyAssets.audioName) {
      const version = createAudioVersion({
        track_id: tracks[0].track_id,
        role: 'primary_master',
        title: 'Primary master',
        is_primary: true,
      }, { idFactory, index: audioVersions.length });
      const asset = createAudioAsset({
        track_id: tracks[0].track_id,
        version_id: version.version_id,
        scope: 'track',
        role: 'primary_master',
        file: legacyAssets.audioFile,
        filename: legacyAssets.audioName,
      }, { idFactory, releaseId, index: audioAssets.length });
      version.audio_asset_id = asset.asset_id;
      tracks[0].primary_version_id = version.version_id;
      tracks[0].primary_audio_ref = asset.asset_id;
      audioVersions.push(version);
      audioAssets.push(asset);
    }
    if (legacyAssets.coverFile || legacyAssets.coverName) {
      releaseAssets.push(createReleaseAsset({
        role: 'main_cover',
        type: 'image',
        file: legacyAssets.coverFile,
        filename: legacyAssets.coverName,
      }, { idFactory, releaseId, index: releaseAssets.length }));
    }
  }

  // Link primary versions and files consistently even when an imported draft
  // only supplied one side of the relationship.
  tracks = tracks.map((track) => {
    const trackVersions = audioVersions.filter((version) => version.track_id === track.track_id);
    let primaryVersion = trackVersions.find((version) => version.version_id === track.primary_version_id)
      || trackVersions.find((version) => version.is_primary || version.role === 'primary_master');
    let primaryAsset = audioAssets.find((asset) => asset.asset_id === track.primary_audio_ref)
      || audioAssets.find((asset) => asset.track_id === track.track_id && asset.role === 'primary_master');

    if (!primaryVersion && primaryAsset) {
      primaryVersion = createAudioVersion({
        track_id: track.track_id,
        role: 'primary_master',
        is_primary: true,
        audio_asset_id: primaryAsset.asset_id,
      }, { idFactory, index: audioVersions.length });
      audioVersions.push(primaryVersion);
    }
    if (primaryVersion && !primaryAsset && primaryVersion.audio_asset_id) {
      primaryAsset = audioAssets.find((asset) => asset.asset_id === primaryVersion.audio_asset_id);
    }
    if (primaryVersion && primaryAsset) {
      primaryVersion.audio_asset_id = primaryAsset.asset_id;
      primaryAsset.version_id = primaryVersion.version_id;
    }
    return {
      ...track,
      primary_version_id: primaryVersion?.version_id || track.primary_version_id,
      primary_audio_ref: primaryAsset?.asset_id || track.primary_audio_ref,
    };
  });

  const lyricsSource = input.lyrics ?? (legacyAssets?.lyrics ? [{
    track_id: tracks[0]?.track_id,
    timed_lines: legacyAssets.lyrics,
  }] : []);
  const lyrics = (Array.isArray(lyricsSource) ? lyricsSource : []).map((entry) => ({
    track_id: clean(entry.track_id) || tracks[0]?.track_id || '',
    language: clean(entry.language),
    instrumental: Boolean(entry.instrumental),
    spoken_word: Boolean(entry.spoken_word),
    plain_text: clean(entry.plain_text),
    timed_lines: Array.isArray(entry.timed_lines) ? entry.timed_lines : [],
    translations: Array.isArray(entry.translations) ? entry.translations : [],
    transliterations: Array.isArray(entry.transliterations) ? entry.transliterations : [],
    credits: entry.credits ?? {},
  }));

  const editionInput = input.edition ?? {};
  const edition = {
    ...editionInput,
    edition_id: normalizeId(editionInput.edition_id, `${releaseId}:edition:first`, idFactory),
    release_id: releaseId,
    applies_to: 'release',
    edition_name: clean(editionInput.edition_name) || 'First Edition',
    edition_description: clean(editionInput.edition_description),
    edition_type: 'fixed',
    edition_size: clean(editionInput.edition_size),
    price: clean(editionInput.price),
    currency: clean(editionInput.currency) || 'KES',
    transferable: editionInput.transferable !== false,
  };

  const simpleRights = input.rights ?? {};
  const rights = simpleRights.release_rights
    ? simpleRights
    : {
        release_rights: {
          copyright: clean(simpleRights.copyright),
          license: clean(simpleRights.license) || 'All Rights Reserved',
          producer: clean(simpleRights.producer),
          credits: clean(simpleRights.credits),
        },
        track_rights: [],
        asset_permissions: [],
      };

  const journeyInput = input.journey ?? {
    legacy_guide: legacyAssets?.guide ?? null,
  };

  return {
    studio_schema_version: STUDIO_PROJECT_SCHEMA_VERSION,
    release,
    tracks,
    audio_versions: audioVersions,
    audio_assets: audioAssets,
    release_assets: releaseAssets,
    lyrics,
    journey: defaultJourney(tracks.map((track) => track.track_id), journeyInput),
    edition,
    rights,
    extras: input.extras ?? {},
  };
}

export function createReleaseProject(input = {}, options = {}) {
  return normalizeReleaseProject(input, options);
}

export function orderedTracks(tracks = []) {
  return [...tracks].sort((left, right) =>
    positiveInt(left.disc_number) - positiveInt(right.disc_number)
    || positiveInt(left.track_number) - positiveInt(right.track_number)
    || positiveInt(left.position) - positiveInt(right.position)
    || clean(left.track_id).localeCompare(clean(right.track_id))
  );
}

/** Reorders public sequence numbers while retaining every stable track ID. */
export function reorderTrack(tracks = [], trackId, toIndex) {
  const ordered = orderedTracks(tracks);
  const fromIndex = ordered.findIndex((track) => track.track_id === trackId);
  if (fromIndex < 0) return ordered;
  const [moved] = ordered.splice(fromIndex, 1);
  const target = Math.max(0, Math.min(Number(toIndex) || 0, ordered.length));
  ordered.splice(target, 0, moved);

  const perDisc = new Map();
  return ordered.map((track, index) => {
    const disc = positiveInt(track.disc_number);
    const nextTrackNumber = (perDisc.get(disc) || 0) + 1;
    perDisc.set(disc, nextTrackNumber);
    return { ...track, position: index + 1, track_number: nextTrackNumber };
  });
}

export function duplicateTrack(project, trackId, options = {}) {
  const idFactory = options.idFactory || createUuid;
  const source = project.tracks.find((track) => track.track_id === trackId);
  if (!source) return project;
  const duplicate = createTrack({
    ...source,
    track_id: '',
    title: source.title ? `${source.title} (copy)` : '',
    primary_version_id: '',
    primary_audio_ref: '',
  }, {
    idFactory,
    releaseId: project.release.release_id,
    releaseArtist: project.release.primary_artist,
    index: project.tracks.length,
  });
  return {
    ...project,
    tracks: reorderTrack([...project.tracks, duplicate], duplicate.track_id, project.tracks.length),
    journey: {
      ...project.journey,
      track_journeys: [...project.journey.track_journeys, { track_id: duplicate.track_id, moments: [] }],
    },
  };
}

export function validateReleaseProject(project, options = {}) {
  const forPublish = options.forPublish !== false;
  const errors = [];
  const warnings = [];
  const add = (severity, code, path, message) => (severity === 'error' ? errors : warnings).push({ code, path, message });
  const release = project?.release ?? {};
  const tracks = Array.isArray(project?.tracks) ? project.tracks : [];
  const versions = Array.isArray(project?.audio_versions) ? project.audio_versions : [];
  const assets = Array.isArray(project?.audio_assets) ? project.audio_assets : [];

  if (!UUID_RE.test(clean(release.release_id))) add('error', 'release_id_invalid', 'release.release_id', 'Release ID must be a UUID.');
  if (!RELEASE_TYPES.includes(release.release_type)) add('error', 'release_type_invalid', 'release.release_type', 'Choose a supported release type.');
  if (forPublish && !clean(release.title)) add('error', 'release_title_missing', 'release.title', 'Release title is required.');
  if (forPublish && !clean(release.primary_artist) && release.release_type !== 'compilation') {
    add('error', 'release_artist_missing', 'release.primary_artist', 'Primary artist is required.');
  }

  const continuousMaster = assets.some((asset) => asset.scope === 'release' && asset.role === 'continuous_master');
  if (!tracks.length && !(release.release_type === 'dj_mix' && continuousMaster)) {
    add('error', 'tracklist_empty', 'tracks', 'The release needs at least one track.');
  }
  if (MULTI_TRACK_TYPES.has(release.release_type) && tracks.length < 2) {
    add('error', 'multi_track_release_too_short', 'tracks', `${RELEASE_TYPE_LABELS[release.release_type]} releases need at least two tracks.`);
  }
  if (release.release_type === 'single' && tracks.filter((track) => !track.bonus).length > 1) {
    add('warning', 'single_multiple_main_tracks', 'tracks', 'A Single normally has one main track; mark additional works as bonus or use another release type.');
  }

  const trackIds = new Set();
  const positions = new Set();
  const publicNumbers = new Set();
  for (const [index, track] of tracks.entries()) {
    const path = `tracks[${index}]`;
    if (!UUID_RE.test(clean(track.track_id))) add('error', 'track_id_invalid', `${path}.track_id`, 'Track ID must be a UUID.');
    if (trackIds.has(track.track_id)) add('error', 'track_id_duplicate', `${path}.track_id`, 'Track IDs must be unique.');
    trackIds.add(track.track_id);

    if (!clean(track.title)) add('error', 'track_title_missing', `${path}.title`, 'Empty placeholder tracks cannot be published.');
    if (!clean(track.primary_artist)) add('error', 'track_artist_missing', `${path}.primary_artist`, 'Every track needs a primary artist or explicit release-level inheritance.');
    if (track.edition || track.edition_id || track.edition_size) {
      add('error', 'track_edition_not_allowed', path, 'Edition supply belongs to the complete release, never an individual track.');
    }

    const position = positiveInt(track.position, index + 1);
    if (positions.has(position)) add('warning', 'track_position_duplicate', `${path}.position`, 'Track positions should be unique and deterministic.');
    positions.add(position);
    const publicNumber = `${positiveInt(track.disc_number)}:${positiveInt(track.track_number)}`;
    if (publicNumbers.has(publicNumber)) {
      add(forPublish ? 'error' : 'warning', 'track_number_duplicate', path, 'Two tracks cannot publish with the same disc and track number.');
    }
    publicNumbers.add(publicNumber);

    const primaryAssets = assets.filter((asset) => asset.track_id === track.track_id && asset.role === 'primary_master');
    const referencedPrimary = assets.find((asset) => asset.asset_id === track.primary_audio_ref && asset.track_id === track.track_id);
    if (primaryAssets.length > 1) add('error', 'primary_audio_duplicate', path, 'A track may have only one primary master audio asset.');
    if (forPublish && !track.hidden && !referencedPrimary && primaryAssets.length !== 1) {
      add('error', 'primary_audio_missing', path, 'Every visible track needs one primary audio asset.');
    }

    const primaryVersions = versions.filter((version) => version.track_id === track.track_id && (version.is_primary || version.role === 'primary_master'));
    if (primaryVersions.length > 1) add('error', 'primary_version_duplicate', path, 'A track may have only one primary audio version.');
  }

  const versionIds = new Set();
  for (const [index, version] of versions.entries()) {
    const path = `audio_versions[${index}]`;
    if (versionIds.has(version.version_id)) add('error', 'version_id_duplicate', `${path}.version_id`, 'Audio version IDs must be unique.');
    versionIds.add(version.version_id);
    if (!trackIds.has(version.track_id)) add('error', 'version_track_missing', `${path}.track_id`, 'Audio version references an unknown track.');
  }

  const assetIds = new Set();
  for (const [index, asset] of assets.entries()) {
    const path = `audio_assets[${index}]`;
    if (assetIds.has(asset.asset_id)) add('error', 'asset_id_duplicate', `${path}.asset_id`, 'Audio asset IDs must be unique.');
    assetIds.add(asset.asset_id);
    if (asset.scope === 'track' && !trackIds.has(asset.track_id)) add('error', 'asset_track_missing', `${path}.track_id`, 'Track-scoped audio references an unknown track.');
    if (asset.scope === 'release' && asset.track_id) add('error', 'release_asset_has_track', `${path}.track_id`, 'Release-scoped audio cannot also belong to a track.');
    if (asset.scope === 'track' && !asset.track_id) add('error', 'track_asset_missing_track', `${path}.track_id`, 'Track-scoped audio must belong to a track.');
    if (asset.version_id && !versionIds.has(asset.version_id)) add('error', 'asset_version_missing', `${path}.version_id`, 'Audio asset references an unknown version.');
  }

  const edition = project?.edition ?? {};
  if (edition.applies_to && edition.applies_to !== 'release') {
    add('error', 'edition_scope_invalid', 'edition.applies_to', 'An edition must apply to the complete release.');
  }
  if (edition.release_id && edition.release_id !== release.release_id) {
    add('error', 'edition_release_mismatch', 'edition.release_id', 'Edition and release IDs do not match.');
  }

  return { valid: errors.length === 0, errors, warnings };
}
