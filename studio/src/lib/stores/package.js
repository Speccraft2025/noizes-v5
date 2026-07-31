import { writable, derived } from 'svelte/store';
import {
  createAudioAsset,
  createAudioVersion,
  createReleaseAsset,
  createReleaseProject,
  orderedTracks,
  stableUuid,
} from '../domain/release.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DEFAULT_GUIDE = Object.freeze({
  version: 1,
  allowFreeExplore: true,
  nodes: [
    { id: 'arrival', type: 'arrival', label: 'Arrival', view: 'intro' },
    { id: 'object', type: 'object', label: 'The Object', view: 'intro' },
    { id: 'listen', type: 'listen', label: 'Listen', view: 'view-player' },
    { id: 'record', type: 'record', label: 'Collector Record', view: 'intro' },
    { id: 'end', type: 'ending', label: 'End', view: 'view-player' }
  ]
});

/**
 * The canonical Studio source of truth. The compatibility stores below are
 * temporary lenses for the current single-track screens and will disappear as
 * those screens move to the Phase 2 tracklist workflow.
 */
export const releaseProject = writable(createReleaseProject({
  release: { release_type: 'single', year: new Date().getFullYear().toString() },
  journey: { legacy_guide: DEFAULT_GUIDE },
}));

function lens(store, select, merge) {
  return {
    subscribe(run) {
      return store.subscribe((value) => run(select(value)));
    },
    set(value) {
      store.update((project) => merge(project, value));
    },
    update(updater) {
      store.update((project) => merge(project, updater(select(project))));
    },
  };
}

function firstTrack(project) {
  return orderedTracks(project.tracks)[0] ?? null;
}

export const identity = lens(
  releaseProject,
  (project) => ({
    artist: project.release.primary_artist,
    title: project.release.title,
    release_id: project.release.release_id,
    release_type: project.release.release_type,
    featured_artists: project.release.featured_artists,
    compilation_artists: project.release.compilation_artists,
    year: project.release.year,
    release_date: project.release.release_date,
    genre: project.release.genre.join(', '),
    location: project.release.location,
    description: project.release.description,
    catalogue_number: project.release.catalogue_number,
    label: project.release.label,
  }),
  (project, value) => {
    const oldRelease = project.release;
    const requestedId = String(value.release_id || '').trim();
    const releaseId = requestedId
      ? (UUID_RE.test(requestedId) ? requestedId.toLowerCase() : stableUuid(requestedId))
      : oldRelease.release_id;
    const release = {
      ...oldRelease,
      release_id: releaseId,
      legacy_release_id: requestedId && !UUID_RE.test(requestedId) ? requestedId : oldRelease.legacy_release_id,
      release_type: value.release_type || oldRelease.release_type,
      primary_artist: value.artist ?? oldRelease.primary_artist,
      title: value.title ?? oldRelease.title,
      featured_artists: Array.isArray(value.featured_artists) ? value.featured_artists : oldRelease.featured_artists,
      compilation_artists: Array.isArray(value.compilation_artists) ? value.compilation_artists : oldRelease.compilation_artists,
      year: value.year ?? oldRelease.year,
      release_date: value.release_date ?? oldRelease.release_date,
      genre: Array.isArray(value.genre)
        ? value.genre
        : String(value.genre ?? '').split(',').map((entry) => entry.trim()).filter(Boolean),
      location: value.location ?? oldRelease.location,
      description: value.description ?? oldRelease.description,
      catalogue_number: value.catalogue_number ?? oldRelease.catalogue_number,
      label: value.label ?? oldRelease.label,
    };
    const linkSingleTitle = project.tracks.length === 1
      && oldRelease.release_type === 'single'
      && project.tracks[0].title === oldRelease.title;
    const tracks = project.tracks.map((track) => ({
      ...track,
      title: linkSingleTitle ? release.title : track.title,
      primary_artist: track.inherit_release_artist ? release.primary_artist : track.primary_artist,
    }));
    return {
      ...project,
      release,
      tracks,
      edition: { ...project.edition, release_id: releaseId },
    };
  }
);

export const assets = lens(
  releaseProject,
  (project) => {
    const track = firstTrack(project);
    const primaryAudio = project.audio_assets.find((asset) => asset.asset_id === track?.primary_audio_ref)
      ?? project.audio_assets.find((asset) => asset.track_id === track?.track_id && asset.role === 'primary_master');
    const cover = project.release_assets.find((asset) => asset.role === 'main_cover');
    const lyricRecord = project.lyrics.find((entry) => entry.track_id === track?.track_id);
    return {
      audioFile: primaryAudio?.file ?? null,
      coverFile: cover?.file ?? null,
      audioName: primaryAudio?.filename ?? '',
      coverName: cover?.filename ?? '',
      lyrics: lyricRecord?.timed_lines ?? [],
      guide: project.journey.legacy_guide ?? DEFAULT_GUIDE,
    };
  },
  (project, value) => {
    const track = firstTrack(project);
    if (!track) return project;
    let tracks = project.tracks;
    let audioVersions = project.audio_versions;
    let audioAssets = project.audio_assets;
    let releaseAssets = project.release_assets;
    const currentAudio = audioAssets.find((asset) => asset.asset_id === track.primary_audio_ref)
      ?? audioAssets.find((asset) => asset.track_id === track.track_id && asset.role === 'primary_master');
    const currentVersions = audioVersions.filter((version) => version.track_id === track.track_id && (version.is_primary || version.role === 'primary_master'));

    if (value.audioFile || value.audioName) {
      let version = currentVersions[0];
      if (!version) version = createAudioVersion({ track_id: track.track_id, role: 'primary_master' });
      const nextAudio = currentAudio
        ? {
            ...currentAudio,
            version_id: version.version_id,
            file: value.audioFile ?? currentAudio.file,
            filename: value.audioName || value.audioFile?.name || currentAudio.filename,
            mime: value.audioFile?.type || currentAudio.mime,
            size: value.audioFile?.size || currentAudio.size,
          }
        : createAudioAsset({
            track_id: track.track_id,
            version_id: version.version_id,
            scope: 'track',
            role: 'primary_master',
            file: value.audioFile,
            filename: value.audioName,
          }, { releaseId: project.release.release_id });
      version = { ...version, is_primary: true, role: 'primary_master', audio_asset_id: nextAudio.asset_id };
      audioVersions = [...audioVersions.filter((item) => item.version_id !== version.version_id), version];
      audioAssets = [...audioAssets.filter((item) => item.asset_id !== nextAudio.asset_id), nextAudio];
      tracks = tracks.map((item) => item.track_id === track.track_id
        ? { ...item, primary_version_id: version.version_id, primary_audio_ref: nextAudio.asset_id }
        : item);
    } else if (currentAudio || currentVersions.length) {
      const removedAssetIds = new Set([currentAudio?.asset_id, ...currentVersions.map((version) => version.audio_asset_id)].filter(Boolean));
      const removedVersionIds = new Set(currentVersions.map((version) => version.version_id));
      audioAssets = audioAssets.filter((asset) => !removedAssetIds.has(asset.asset_id));
      audioVersions = audioVersions.filter((version) => !removedVersionIds.has(version.version_id));
      tracks = tracks.map((item) => item.track_id === track.track_id
        ? { ...item, primary_version_id: '', primary_audio_ref: '' }
        : item);
    }

    const currentCover = releaseAssets.find((asset) => asset.role === 'main_cover');
    if (value.coverFile || value.coverName) {
      const nextCover = currentCover
        ? {
            ...currentCover,
            file: value.coverFile ?? currentCover.file,
            filename: value.coverName || value.coverFile?.name || currentCover.filename,
            mime: value.coverFile?.type || currentCover.mime,
            size: value.coverFile?.size || currentCover.size,
          }
        : createReleaseAsset({
            type: 'image',
            role: 'main_cover',
            file: value.coverFile,
            filename: value.coverName,
          }, { releaseId: project.release.release_id });
      releaseAssets = [...releaseAssets.filter((asset) => asset.asset_id !== nextCover.asset_id), nextCover];
    } else if (currentCover) {
      releaseAssets = releaseAssets.filter((asset) => asset.asset_id !== currentCover.asset_id);
    }

    const lyrics = [
      ...project.lyrics.filter((entry) => entry.track_id !== track.track_id),
      {
        ...(project.lyrics.find((entry) => entry.track_id === track.track_id) ?? {}),
        track_id: track.track_id,
        language: project.lyrics.find((entry) => entry.track_id === track.track_id)?.language ?? '',
        instrumental: project.lyrics.find((entry) => entry.track_id === track.track_id)?.instrumental ?? false,
        plain_text: project.lyrics.find((entry) => entry.track_id === track.track_id)?.plain_text ?? '',
        timed_lines: Array.isArray(value.lyrics) ? value.lyrics : [],
        translations: project.lyrics.find((entry) => entry.track_id === track.track_id)?.translations ?? [],
      },
    ];

    return {
      ...project,
      tracks,
      audio_versions: audioVersions,
      audio_assets: audioAssets,
      release_assets: releaseAssets,
      lyrics,
      journey: { ...project.journey, legacy_guide: value.guide ?? project.journey.legacy_guide },
    };
  }
);

// Which template / theme the package uses
// Canonical experience. Legacy draft values are normalized during compilation.
export const template = writable('ultra-v2');

// Optional game add-ons baked into the experience ("play" block).
// games: enabled game ids ([] = no Games tab in the package).
export const play = writable({
  games: [],
  difficulty: 'standard', // 'gentle' | 'standard' | 'sharp'
  intensity: 1            // 0.4–1.4 particle/glow budget
});

// Supplementary content library. Games remain in `play` for viewer backwards
// compatibility but are authored from the Extras step alongside narrative media.
export const extras = writable({
  story: '',
  links: [],
  pdfs: []
});

// The nine games the ULTRA template ships. Order = display order.
export const GAME_CATALOG = [
  { id: 'bloom',   name: 'Bloom',   kind: 'toy',    hint: 'touch anywhere — a garden grows on the beat' },
  { id: 'comet',   name: 'Comet',   kind: 'toy',    hint: 'drag through the stars — sweep up stardust' },
  { id: 'pulse',   name: 'Pulse',   kind: 'rhythm', hint: 'tap the rings as they cross the halo' },
  { id: 'serpent', name: 'Serpent', kind: 'arcade', hint: 'steer the serpent — it slithers on the beat' },
  { id: 'glide',   name: 'Glide',   kind: 'arcade', hint: 'tap to fly — thread the beat-born gates' },
  { id: 'apex',    name: 'Apex',    kind: 'arcade', hint: 'steer past rivals — the road runs on energy' },
  { id: 'barrels', name: 'Barrels', kind: 'arcade', hint: 'jump the barrels — they land on the beat' },
  { id: 'clash',   name: 'Clash',   kind: 'arcade', hint: 'neon duel — counter high or low on the beat' },
  { id: 'rush',    name: 'Rush',    kind: 'arcade', hint: 'switch lanes in rhythm — dodge and collect' }
];

export const edition = lens(
  releaseProject,
  (project) => project.edition,
  (project, value) => ({
    ...project,
    edition: {
      ...project.edition,
      ...value,
      release_id: project.release.release_id,
      applies_to: 'release',
      edition_type: 'fixed',
    },
  })
);

export const rights = lens(
  releaseProject,
  (project) => project.rights.release_rights,
  (project, value) => ({
    ...project,
    rights: {
      ...project.rights,
      release_rights: { ...project.rights.release_rights, ...value },
    },
  })
);

export const CURRENCIES = ['KES', 'USD', 'EUR'];

export const LICENSES = [
  'All Rights Reserved',
  'CC BY 4.0',
  'CC BY-SA 4.0',
  'CC BY-NC 4.0',
  'CC BY-NC-SA 4.0',
  'CC0 1.0 Universal'
];

export const manifest = derived(releaseProject, ($project) => ({
  noizes_version: '1.0.0',
  package_type: 'music_release',
  release: {
    ...$project.release,
    track_count: $project.tracks.length,
    disc_count: Math.max(1, ...$project.tracks.map((track) => Number(track.disc_number) || 1)),
  },
  tracks: orderedTracks($project.tracks).map((track) => ({
    track_id: track.track_id,
    disc_number: track.disc_number,
    track_number: track.track_number,
    title: track.title,
    primary_artist: track.primary_artist,
    primary_audio_component: track.primary_audio_ref,
  })),
  components: [
    ...$project.audio_assets.map(({ file: _file, ...asset }) => asset),
    ...$project.release_assets.map(({ file: _file, ...asset }) => asset),
    ...$project.track_assets.map(({ file: _file, ...asset }) => asset),
  ],
  edition: $project.edition,
  rights: $project.rights,
}));
