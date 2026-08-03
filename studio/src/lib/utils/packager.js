import JSZip from 'jszip';
import { buildExperienceHTML, buildGuide } from './experience.js';
import { CANONICAL_TEMPLATE, normalizeEdition } from './project.js';
import { normalizeReleaseProject, orderedTracks } from '../domain/release.js';
import { normalizePlaybackSettings } from '../domain/playback.js';
import { materializeJourney } from '../domain/journey.js';
import { buildReleaseArchive, buildReleaseHistory } from '../domain/archive.js';
import { estimatePackageSize } from '../domain/package-size.js';

const safeFilename = (value, fallback = 'asset') => {
  const cleaned = String(value || fallback).replace(/[^a-z0-9._-]/gi, '_').replace(/_+/g, '_');
  return cleaned || fallback;
};

const extension = (filename, fallback = 'bin') => {
  const match = String(filename || '').match(/\.([a-z0-9]{1,8})$/i);
  return match?.[1]?.toLowerCase() || fallback;
};

const trackFolder = (track) => `${String(track.position).padStart(2, '0')}-${track.track_id}`;

function stripFiles(value) {
  if (Array.isArray(value)) return value.map(stripFiles);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'file')
    .map(([key, child]) => [key, stripFiles(child)]));
}

/**
 * Builds both the normalized multi-track archive and the legacy-compatible
 * ULTRA entry document. Phase 3 replaces the latter's one-track playback
 * adapter with the release playback engine; no package data is discarded.
 */
export async function buildPackage(input) {
  const onProgress = typeof input.onProgress === 'function' ? input.onProgress : () => {};
  onProgress({ percent: 1, stage: 'Normalizing release' });
  const legacyCall = !input.project;
  const project = normalizeReleaseProject(input.project ?? {
    identity: input.identity,
    edition: input.edition,
    rights: input.rights,
    assets: input.assets,
    extras: input.extras,
  });
  const zip = new JSZip();
  const template = CANONICAL_TEMPLATE;
  const play = input.play ?? {};
  const extras = input.extras ?? project.extras ?? {};
  const sizeReport = estimatePackageSize(project, extras);
  const release = project.release;
  const tracks = orderedTracks(project.tracks);
  const fixedEdition = normalizeEdition(project.edition);
  const releaseRights = project.rights.release_rights ?? project.rights;
  // Contact and invitation metadata stays in the creator's private draft. A
  // portable collector package receives only the public attribution record.
  const releaseCreditRecords = (releaseRights.credit_records || []).map((record) => ({
    credit_id: record.credit_id,
    name: record.name,
    role: record.role,
    track_ids: Array.isArray(record.track_ids) ? record.track_ids : [],
    source: record.source || 'manual',
  }));
  const publicRights = stripFiles({
    ...project.rights,
    release_rights: { ...releaseRights, credit_records: releaseCreditRecords },
  });
  const releaseId = legacyCall && input.identity?.release_id
    ? input.identity.release_id
    : release.release_id;
  const now = new Date().toISOString();
  const components = [];
  const componentById = new Map();
  const buffersByAssetId = new Map();

  async function writeComponent(asset, path, extra = {}) {
    if (!asset?.file) return null;
    const buffer = await asset.file.arrayBuffer();
    const sha256 = await sha256Hex(buffer);
    const component = {
      component_id: asset.asset_id,
      scope: asset.scope,
      type: asset.type || 'audio',
      role: asset.role,
      title: asset.title || '',
      path,
      filename: asset.filename || asset.file.name || '',
      mime: asset.mime || asset.file.type || '',
      size: buffer.byteLength,
      sha256,
      ...(asset.duration_ms ? { duration_ms: asset.duration_ms } : {}),
      ...(asset.sample_rate ? { sample_rate: asset.sample_rate } : {}),
      ...(asset.bit_depth ? { bit_depth: asset.bit_depth } : {}),
      ...(asset.channels ? { channels: asset.channels } : {}),
      ...extra,
    };
    zip.file(path, buffer);
    components.push(component);
    componentById.set(component.component_id, component);
    buffersByAssetId.set(component.component_id, buffer);
    return component;
  }

  // Release-level media.
  for (const asset of project.release_assets) {
    if (!asset.file) continue;
    const name = safeFilename(asset.filename || asset.file.name);
    let directory = 'release/artwork';
    if (asset.role === 'main_cover') directory = 'release/cover';
    else if (asset.type === 'image') directory = 'release/images';
    else if (asset.type === 'video') directory = 'release/video';
    else if (asset.type === 'document') directory = 'release/documents';
    await writeComponent(asset, `${directory}/${name}`);
  }

  for (const asset of project.audio_assets.filter((item) => item.scope === 'release')) {
    if (!asset.file) continue;
    const ext = extension(asset.filename || asset.file.name, 'audio');
    const name = asset.role === 'continuous_master'
      ? `continuous-master.${ext}`
      : safeFilename(asset.filename || asset.file.name);
    await writeComponent(asset, `release/audio/${name}`);
  }
  onProgress({ percent: 14, stage: 'Packaging release assets' });

  // PDF extras are release documents and Note Wall records, not anonymous
  // attachments outside the archive hierarchy.
  const notes = [];
  for (const [index, pdf] of (extras.pdfs || []).entries()) {
    if (!pdf.file || !(pdf.file.type === 'application/pdf' || pdf.name?.toLowerCase().endsWith('.pdf'))) continue;
    const buffer = await pdf.file.arrayBuffer();
    const name = `${String(index + 1).padStart(2, '0')}-${safeFilename(pdf.name || `note-${index + 1}.pdf`)}`;
    const path = `release/documents/${name}`;
    const componentId = pdf.id || `note-${index + 1}`;
    const sha256 = await sha256Hex(buffer);
    zip.file(path, buffer);
    components.push({
      component_id: componentId,
      scope: 'release',
      type: 'document',
      role: 'notes',
      title: pdf.title?.trim() || pdf.name || `Note ${index + 1}`,
      path,
      filename: pdf.name || name,
      mime: 'application/pdf',
      size: buffer.byteLength,
      sha256,
    });
    notes.push({
      id: componentId,
      title: pdf.title?.trim() || pdf.name || `Note ${index + 1}`,
      path,
      mime: 'application/pdf',
      src: path,
    });
  }
  onProgress({ percent: 20, stage: 'Packaging release documents' });

  const trackRecords = [];
  for (const [trackIndex, track] of tracks.entries()) {
    const folder = `tracks/${trackFolder(track)}`;
    const versions = project.audio_versions.filter((version) => version.track_id === track.track_id);
    const trackComponents = [];

    for (const version of versions) {
      const versionAssets = project.audio_assets.filter((asset) =>
        asset.track_id === track.track_id && (asset.version_id === version.version_id || asset.asset_id === version.audio_asset_id)
      );
      for (const asset of versionAssets) {
        if (!asset.file) continue;
        const ext = extension(asset.filename || asset.file.name, 'audio');
        const filename = version.is_primary || version.role === 'primary_master'
          ? `primary.${ext}`
          : `${safeFilename(version.role)}-${version.version_id.slice(0, 8)}.${ext}`;
        const component = await writeComponent(asset, `${folder}/audio/${filename}`, {
          track_id: track.track_id,
          version_id: version.version_id,
        });
        if (component) trackComponents.push(component.component_id);
      }
    }

    for (const asset of project.track_assets.filter((item) => item.track_id === track.track_id)) {
      if (!asset.file) continue;
      const directory = asset.role === 'track_artwork' ? 'artwork'
        : asset.type === 'video' ? 'video'
          : asset.type === 'document' ? 'documents'
            : 'images';
      const component = await writeComponent(asset, `${folder}/${directory}/${safeFilename(asset.filename || asset.file.name)}`, {
        track_id: track.track_id,
      });
      if (component) trackComponents.push(component.component_id);
    }

    const lyricRecord = project.lyrics.find((entry) => entry.track_id === track.track_id) ?? {
      track_id: track.track_id,
      language: '',
      instrumental: false,
      plain_text: '',
      timed_lines: [],
      translations: [],
    };
    if (lyricRecord.instrumental || lyricRecord.plain_text || lyricRecord.timed_lines?.length || lyricRecord.translations?.length) {
      zip.file(`${folder}/lyrics/lyrics.json`, JSON.stringify(stripFiles(lyricRecord), null, 2));
    }

    const primaryComponent = componentById.get(track.primary_audio_ref)
      ?? components.find((component) => component.track_id === track.track_id && component.role === 'primary_master');
    const record = {
      track_id: track.track_id,
      disc_number: track.disc_number,
      track_number: track.track_number,
      position: track.position,
      title: track.title,
      subtitle: track.subtitle,
      primary_artist: track.primary_artist,
      featured_artists: track.featured_artists,
      producers: track.producers,
      writers: track.writers,
      isrc: track.isrc,
      explicit: track.explicit,
      bonus: track.bonus,
      hidden: track.hidden,
      description: track.description,
      release_date: track.release_date,
      source_release: track.source_release,
      recording_date: track.recording_date,
      recording_location: track.recording_location,
      artwork_ref: track.artwork_ref,
      primary_audio_component: primaryComponent?.component_id || '',
      duration_ms: primaryComponent?.duration_ms || 0,
      audio_versions: versions.map((version) => ({
        ...stripFiles(version),
        audio_component: componentById.get(version.audio_asset_id)?.component_id || version.audio_asset_id || '',
      })),
      components: trackComponents,
      lyrics: stripFiles(lyricRecord),
      credits: {
        inherited_release_credits: track.inherit_release_credits,
        linked_release_credit_ids: releaseCreditRecords
          .filter((credit) => credit.track_ids.includes(track.track_id))
          .map((credit) => credit.credit_id),
        ...(track.credits ?? {}),
      },
      rights: project.rights.track_rights?.find((entry) => entry.track_id === track.track_id) ?? {},
      technical: primaryComponent ? {
        mime: primaryComponent.mime,
        size: primaryComponent.size,
        sha256: primaryComponent.sha256,
      } : {},
      appears_in_journey: track.appears_in_journey,
      appears_in_archive: track.appears_in_archive,
    };
    trackRecords.push(record);
    zip.file(`${folder}/track.json`, JSON.stringify(record, null, 2));
    onProgress({
      percent: 20 + Math.round(((trackIndex + 1) / Math.max(1, tracks.length)) * 42),
      stage: `Packaging track ${trackIndex + 1} of ${tracks.length}`,
      track_id: track.track_id,
    });
  }

  const authoredJourney = materializeJourney(project.journey, tracks);
  const runtimeJourney = {
    ...stripFiles(authoredJourney),
    release_moments: authoredJourney.release_moments.map((moment) => ({
      ...stripFiles(moment),
      asset_src: componentById.get(moment.asset_ref)?.path || '',
    })),
    track_journeys: authoredJourney.track_journeys.map((entry) => ({
      track_id: entry.track_id,
      moments: entry.moments.map((moment) => ({
        ...stripFiles(moment),
        asset_src: componentById.get(moment.asset_ref)?.path || '',
      })),
    })),
  };
  const editionData = {
    ...stripFiles(fixedEdition),
    edition_id: project.edition.edition_id,
    release_id: releaseId,
    applies_to: 'release',
    edition_size: Number(fixedEdition.edition_size),
  };
  zip.file('edition.json', JSON.stringify(editionData, null, 2));
  zip.file('rights.json', JSON.stringify(publicRights, null, 2));
  const creditsData = {
    schema_version: '2.0.0',
    release: releaseRights.credits
      ? String(releaseRights.credits).split('\n').map((line) => line.trim()).filter(Boolean)
      : [],
    records: releaseCreditRecords,
    tracks: tracks.map((track) => ({
      track_id: track.track_id,
      producers: track.producers,
      writers: track.writers,
      inherited_release_credits: track.inherit_release_credits,
      linked_release_credit_ids: releaseCreditRecords
        .filter((credit) => credit.track_ids.includes(track.track_id))
        .map((credit) => credit.credit_id),
      credits: track.credits ?? {},
    })),
  };
  zip.file('credits.json', JSON.stringify(creditsData, null, 2));
  const provenanceData = {
    scope: 'release_copy',
    release_id: release.release_id,
    edition_id: project.edition.edition_id,
    copy_id: null,
    events: [],
  };
  zip.file('provenance.json', JSON.stringify(provenanceData, null, 2));

  const guideBlock = buildGuide({
    hasLyrics: project.lyrics.some((entry) => entry.timed_lines?.length),
    hasPlay: Boolean(play.games?.length),
    hasNotes: Boolean(notes.length),
    story: extras.story?.trim(),
    authored: project.journey.legacy_guide,
  });
  const experienceJson = {
    schema_version: '3.0.0',
    release_id: releaseId,
    journey: stripFiles(authoredJourney),
    guide: guideBlock,
    tracks: trackRecords.map((track) => ({
      track_id: track.track_id,
      title: track.title,
      primary_artist: track.primary_artist,
      primary_audio_component: track.primary_audio_component,
    })),
  };
  if (play.games?.length) {
    experienceJson.play = {
      games: play.games,
      difficulty: play.difficulty || 'standard',
      intensity: typeof play.intensity === 'number' ? play.intensity : 1,
    };
  }
  if (notes.length) {
    experienceJson.attachments = notes.map(({ id, title, path, mime }) => ({ id, title, path, mime, kind: 'notes' }));
  }
  zip.file('experience.json', JSON.stringify(experienceJson, null, 2));

  const safeLinks = (extras.links || []).filter((link) =>
    link.label?.trim() && /^https:\/\//i.test(link.url || '')
  ).map(({ label, url, kind }) => ({ label: label.trim(), url, kind: kind || 'artist', requires_internet: true }));
  const resourcesData = { groups: safeLinks.length ? [{ label: 'Online', links: safeLinks }] : [] };
  zip.file('resources.json', JSON.stringify(resourcesData, null, 2));
  onProgress({ percent: 68, stage: 'Writing release records' });

  const primaryTrack = tracks.find((track) => !track.hidden) ?? tracks[0];
  const primaryAudioAsset = project.audio_assets.find((asset) => asset.asset_id === primaryTrack?.primary_audio_ref)
    ?? project.audio_assets.find((asset) => asset.track_id === primaryTrack?.track_id && asset.role === 'primary_master')
    ?? project.audio_assets.find((asset) => asset.scope === 'release' && asset.role === 'continuous_master');
  const coverAsset = project.release_assets.find((asset) => asset.role === 'main_cover');
  const primaryBuffer = primaryAudioAsset ? buffersByAssetId.get(primaryAudioAsset.asset_id) : null;
  const coverBuffer = coverAsset ? buffersByAssetId.get(coverAsset.asset_id) : null;
  const primaryLyrics = project.lyrics.find((entry) => entry.track_id === primaryTrack?.track_id)?.timed_lines ?? [];
  const audioHash = primaryBuffer ? await sha256Hex(primaryBuffer) : null;
  const inventoryText = components
    .map((component) => `${component.path}:${component.sha256}:${component.size}`)
    .sort()
    .join('\n');
  const inventoryHash = await sha256Hex(new TextEncoder().encode(inventoryText));

  const authenticity = {
    method: 'sha256-component-inventory',
    hash: inventoryHash,
    legacy_primary_audio_hash: audioHash,
    signed: false,
    release_id: release.release_id,
    components: components.map(({ component_id, path, sha256, size }) => ({ component_id, path, sha256, size })),
  };
  zip.file('authenticity.json', JSON.stringify(authenticity, null, 2));
  const technicalData = {
    packaged_at: now,
    packager: 'Noizes Studio v2.0.0',
    noizes_version: '1.0.0',
    track_count: tracks.length,
    component_count: components.length,
    package_source: 'normalized_release_project',
  };
  zip.file('technical.json', JSON.stringify(technicalData, null, 2));

  const manifest = {
    noizes_version: '1.0.0',
    package_type: 'music_release',
    release: {
      ...stripFiles(release),
      track_count: tracks.length,
      disc_count: Math.max(1, ...tracks.map((track) => Number(track.disc_number) || 1)),
      total_duration_ms: trackRecords.reduce((sum, track) => sum + (track.duration_ms || 0), 0),
    },
    tracks: trackRecords.map((track) => ({
      track_id: track.track_id,
      disc_number: track.disc_number,
      track_number: track.track_number,
      position: track.position,
      title: track.title,
      primary_artist: track.primary_artist,
      featured_artists: track.featured_artists,
      primary_audio_component: track.primary_audio_component,
      duration_ms: track.duration_ms,
      explicit: track.explicit,
      bonus: track.bonus,
      hidden: track.hidden,
    })),
    components,
    experience: { entry: 'experience.html', schema: '3.0.0', template },
    edition: { path: 'edition.json', edition_id: project.edition.edition_id, applies_to: 'release' },
    authenticity: { path: 'authenticity.json', method: authenticity.method },
    rights: { path: 'rights.json' },
    archive: { path: 'archive.json', schema: '1.0.0' },
    history: { path: 'history.json', scope: 'release_copy' },
    created_at: now,
    // Read-only compatibility projection for v1 viewers and current Exchange.
    artist: release.primary_artist,
    title: release.title,
    release_id: releaseId,
    year: release.year,
    genre: release.genre.join(', '),
    location: release.location,
    description: release.description,
  };
  const archiveData = buildReleaseArchive({
    release: manifest.release,
    tracks: trackRecords,
    components,
    notes: notes.map(({ id, title, path, mime }) => ({ id, title, path, src: path, mime })),
    credits: creditsData,
    rights: publicRights,
    edition: editionData,
    authenticity,
    technical: technicalData,
    resources: resourcesData,
    games: play.games || [],
  });
  const historyData = buildReleaseHistory({
    release: manifest.release,
    edition: editionData,
    provenance: provenanceData,
    tracks: trackRecords,
    packaged_at: now,
  });
  zip.file('archive.json', JSON.stringify(archiveData, null, 2));
  zip.file('history.json', JSON.stringify(historyData, null, 2));
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('README-OFFLINE.txt', [
    'NOIZES .nz OFFLINE PACKAGE',
    '',
    'Recommended: open the intact .nz file in the Noizes /open viewer. It validates component checksums and creates temporary Blob URLs without uploading your files.',
    '',
    'Extracted-folder fallback:',
    '1. Extract the complete archive without renaming or moving internal files.',
    '2. Open experience.html from the extracted root.',
    '3. Keep release/, tracks/, and every JSON record beside experience.html.',
    '',
    'Browsers may restrict file:// audio, PDF, or cross-file access. If that happens, use the Noizes viewer or serve the extracted folder from any local static file server.',
    '',
    'The experience references packaged masters by relative paths. Large audio, video, PDFs, and stems are intentionally not duplicated as data URIs inside experience.html.',
  ].join('\n'));

  const legacyIdentity = {
    artist: release.primary_artist,
    title: release.title,
    release_id: releaseId,
    year: release.year,
    genre: release.genre.join(', '),
    location: release.location,
    description: release.description,
  };
  const playbackTracks = trackRecords.map((track) => {
    const primaryComponent = componentById.get(track.primary_audio_component);
    const artworkComponent = componentById.get(track.artwork_ref);

    // Alternate takes — acapella, instrumental, live — so a listener can
    // change source without losing their place. Matched on version_id, which
    // writeComponent stamps onto the component when the file is written;
    // going via the asset id would depend on an alias that may not hold.
    const versions = components
      .filter((component) => component.track_id === track.track_id && component.version_id)
      .map((component) => {
        const version = (track.audio_versions ?? [])
          .find((entry) => entry.version_id === component.version_id);
        return {
          version_id: component.version_id,
          role: version?.role || 'alternate',
          title: version?.title || 'Alternate version',
          is_primary: Boolean(version?.is_primary),
          src: component.path,
          duration_ms: component.duration_ms || 0,
        };
      })
      // The primary leads, so the switcher opens on the take people expect.
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

    return {
      track_id: track.track_id,
      position: track.position,
      disc_number: track.disc_number,
      track_number: track.track_number,
      title: track.title,
      subtitle: track.subtitle,
      primary_artist: track.primary_artist,
      featured_artists: track.featured_artists,
      hidden: track.hidden,
      bonus: track.bonus,
      src: primaryComponent?.path || '',
      cover_src: artworkComponent?.path || '',
      duration_ms: track.duration_ms || 0,
      lyrics: track.lyrics,
      // Only worth shipping when there is a genuine choice to make.
      versions: versions.length > 1 ? versions : [],
    };
  });
  if (!playbackTracks.length) {
    const continuous = components.find((component) => component.scope === 'release' && component.role === 'continuous_master');
    if (continuous) playbackTracks.push({
      track_id: `${release.release_id}-continuous`,
      position: 1,
      disc_number: 1,
      track_number: 1,
      title: release.title,
      subtitle: 'Continuous master',
      primary_artist: release.primary_artist,
      featured_artists: [],
      hidden: false,
      bonus: false,
      src: continuous.path,
      cover_src: '',
      duration_ms: continuous.duration_ms || 0,
      lyrics: { timed_lines: [], instrumental: true },
    });
  }
  const crossfadeOverride = project.journey.transitions.find((transition) => transition.type === 'crossfade' && transition.duration_ms && !transition.from_track_id && !transition.to_track_id);
  const releasePlayback = {
    release: {
      release_id: release.release_id,
      release_type: release.release_type,
      title: release.title,
      primary_artist: release.primary_artist,
      track_count: tracks.length,
      disc_count: manifest.release.disc_count,
    },
    tracks: playbackTracks,
    playback: normalizePlaybackSettings({
      mode: project.journey.playback_mode || 'sequential',
      crossfade_ms: Number(crossfadeOverride?.duration_ms) || 1500,
      ...project.journey.navigation,
    }),
  };
  const experienceHTML = buildExperienceHTML({
    identity: legacyIdentity,
    edition: fixedEdition,
    rights: releaseRights,
    audioBase64: legacyCall && primaryBuffer ? arrayBufferToBase64(primaryBuffer) : '',
    audioMime: primaryAudioAsset?.mime || primaryAudioAsset?.file?.type || '',
    coverBase64: coverBuffer ? arrayBufferToBase64(coverBuffer) : '',
    coverMime: coverAsset?.mime || coverAsset?.file?.type || '',
    lyrics: primaryLyrics,
    template,
    play,
    guide: project.journey.legacy_guide,
    extras,
    notes,
    releasePlayback,
    journey: runtimeJourney,
    archive: archiveData,
    history: historyData,
  });
  zip.file('experience.html', experienceHTML);
  onProgress({ percent: 82, stage: 'Building offline experience' });

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }, (metadata) => {
    onProgress({ percent: 82 + Math.round((metadata.percent / 100) * 18), stage: 'Compressing package' });
  });
  const filename = `${safeFilename(release.title || 'untitled').toLowerCase()}_ultra-v2_noizes.nz`;

  if (input.download !== false && typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  onProgress({ percent: 100, stage: 'Package ready' });
  return {
    filename,
    blob,
    audioFile: primaryAudioAsset?.file ?? null,
    coverFile: coverAsset?.file ?? null,
    audioHash,
    manifest,
    project,
    sizeReport: { ...sizeReport, actual_archive_bytes: blob.size },
  };
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.byteLength; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
