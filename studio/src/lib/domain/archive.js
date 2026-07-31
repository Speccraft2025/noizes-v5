const clean = (value) => String(value ?? '').trim();

export const ARCHIVE_SECTIONS = Object.freeze([
  'overview', 'tracklist', 'artwork', 'booklet', 'images', 'video', 'notes',
  'credits', 'rights', 'edition', 'authenticity', 'technical', 'package_contents',
  'online_resources', 'games',
]);

const AUDIO_ROLE_GROUPS = Object.freeze({
  primary_master: 'Primary audio',
  alternate: 'Alternate recordings',
  instrumental: 'Alternate recordings',
  acapella: 'Alternate recordings',
  demo: 'Alternate recordings',
  live: 'Alternate recordings',
  radio_edit: 'Alternate recordings',
  extended: 'Alternate recordings',
  commentary: 'Related audio',
  bonus_audio: 'Related audio',
  stem: 'Stems',
  continuous_master: 'Continuous release master',
});

function componentSummary(component = {}) {
  return {
    component_id: component.component_id,
    scope: component.scope,
    track_id: component.track_id || '',
    version_id: component.version_id || '',
    type: component.type || '',
    role: component.role || '',
    title: component.title || component.filename || component.role || '',
    path: component.path || '',
    mime: component.mime || '',
    size: Number(component.size) || 0,
    sha256: component.sha256 || '',
    duration_ms: Number(component.duration_ms) || 0,
  };
}

export function buildReleaseArchive(input = {}) {
  const release = input.release || {};
  const components = (input.components || []).map(componentSummary);
  const componentById = new Map(components.map((component) => [component.component_id, component]));
  const tracks = (input.tracks || []).filter((track) => track.appears_in_archive !== false).map((track) => {
    const trackComponents = components.filter((component) => component.track_id === track.track_id);
    const versions = (track.audio_versions || []).map((version) => {
      const component = componentById.get(version.audio_component || version.audio_asset_id);
      return {
        version_id: version.version_id,
        role: version.role,
        group: AUDIO_ROLE_GROUPS[version.role] || 'Other audio',
        title: version.title || AUDIO_ROLE_GROUPS[version.role] || version.role,
        is_primary: Boolean(version.is_primary),
        notes: version.notes || '',
        component: component || null,
      };
    });
    return {
      track_id: track.track_id,
      disc_number: Number(track.disc_number) || 1,
      track_number: Number(track.track_number) || 1,
      title: track.title || '',
      subtitle: track.subtitle || '',
      primary_artist: track.primary_artist || '',
      featured_artists: track.featured_artists || [],
      producers: track.producers || [],
      writers: track.writers || [],
      isrc: track.isrc || '',
      explicit: Boolean(track.explicit),
      bonus: Boolean(track.bonus),
      hidden: Boolean(track.hidden),
      description: track.description || '',
      primary_audio: componentById.get(track.primary_audio_component) || null,
      audio_versions: versions,
      lyrics: track.lyrics || {},
      artwork: trackComponents.filter((component) => component.type === 'image' && ['track_artwork', 'artwork'].includes(component.role)),
      images: trackComponents.filter((component) => component.type === 'image' && !['track_artwork', 'artwork'].includes(component.role)),
      video: trackComponents.filter((component) => component.type === 'video'),
      documents: trackComponents.filter((component) => ['document', 'pdf'].includes(component.type)),
      credits: track.credits || { producers: track.producers || [], writers: track.writers || [] },
      rights: track.rights || {},
      technical: track.technical || {},
    };
  });

  const releaseComponents = components.filter((component) => component.scope === 'release');
  return {
    schema_version: 1,
    sections: ARCHIVE_SECTIONS,
    overview: {
      ...release,
      track_count: Number(release.track_count) || tracks.length,
      disc_count: Number(release.disc_count) || Math.max(1, ...tracks.map((track) => track.disc_number)),
    },
    tracklist: tracks.map((track) => ({
      track_id: track.track_id,
      disc_number: track.disc_number,
      track_number: track.track_number,
      title: track.title,
      primary_artist: track.primary_artist,
      featured_artists: track.featured_artists,
      explicit: track.explicit,
      bonus: track.bonus,
      hidden: track.hidden,
    })),
    tracks,
    release_assets: {
      artwork: releaseComponents.filter((component) => component.type === 'image' && ['main_cover', 'back_cover', 'booklet_artwork', 'typography'].includes(component.role)),
      images: releaseComponents.filter((component) => component.type === 'image' && !['main_cover', 'back_cover', 'booklet_artwork', 'typography'].includes(component.role)),
      video: releaseComponents.filter((component) => component.type === 'video'),
      documents: releaseComponents.filter((component) => ['document', 'pdf'].includes(component.type)),
      continuous_masters: releaseComponents.filter((component) => component.type === 'audio' && component.role === 'continuous_master'),
      other_audio: releaseComponents.filter((component) => component.type === 'audio' && component.role !== 'continuous_master'),
    },
    notes: input.notes || [],
    credits: input.credits || {},
    rights: input.rights || {},
    edition: input.edition || {},
    authenticity: input.authenticity || {},
    technical: input.technical || {},
    package_contents: components,
    online_resources: input.resources || { groups: [] },
    games: input.games || [],
  };
}

export function buildReleaseHistory(input = {}) {
  const release = input.release || {};
  const edition = input.edition || {};
  const provenance = input.provenance || {};
  const events = Array.isArray(provenance.events) ? provenance.events : [];
  return {
    schema_version: 1,
    scope: 'release_copy',
    release: {
      release_id: release.release_id || '',
      title: release.title || '',
      primary_artist: release.primary_artist || '',
      release_type: release.release_type || 'single',
    },
    edition: {
      edition_id: edition.edition_id || '',
      edition_name: edition.edition_name || 'First Edition',
      edition_size: edition.edition_size || null,
      applies_to: 'release',
    },
    copy: {
      copy_id: provenance.copy_id || null,
      copy_number: provenance.copy_number ?? null,
      current_identity: provenance.copy_id
        ? `Copy ${provenance.copy_number || provenance.copy_id}`
        : 'Copy identity assigned on acquisition',
    },
    ownership_history: events.filter((event) => ['created', 'acquired', 'transferred', 'verified', 'note'].includes(event.kind)),
    rights_history: Array.isArray(input.rights_history) ? input.rights_history : [],
    track_creation_history: (input.tracks || []).map((track) => ({
      track_id: track.track_id,
      title: track.title || '',
      events: Array.isArray(track.creation_history) ? track.creation_history : [],
      scope: 'informational_work_history',
    })),
    collector_note: {
      storage: 'local_to_this_offline_viewer',
      body: clean(input.collector_note),
    },
    offline_snapshot: {
      packaged_at: input.packaged_at || '',
      provenance_event_count: events.length,
      latest_event: events.at(-1) || null,
    },
    ownership_policy: 'Ownership and transfer provenance applies to the complete authenticated release copy. Tracks do not have independent ownership chains.',
  };
}
