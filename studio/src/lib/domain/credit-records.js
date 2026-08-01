import { stableUuid } from './release.js';

const clean = (value) => String(value ?? '').trim();
const nameKey = (value) => clean(value).toLocaleLowerCase();

function unique(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

export function createCreditRecord(input = {}, options = {}) {
  const releaseId = clean(options.releaseId) || 'unassigned-release';
  const name = clean(input.name);
  const role = clean(input.role) || 'Contributor';
  const seed = input.source_key || `${role}:${name}:${options.index ?? 0}`;
  return {
    credit_id: clean(input.credit_id) || stableUuid(`${releaseId}:credit:${seed}`),
    name,
    role,
    email: clean(input.email).toLocaleLowerCase(),
    track_ids: unique(input.track_ids),
    source: clean(input.source) || 'manual',
    source_key: clean(input.source_key),
    invite_status: clean(input.invite_status) || 'not_invited',
    invited_at: clean(input.invited_at),
    collaborator_user_id: clean(input.collaborator_user_id),
  };
}

/**
 * Builds one suggested record per featured artist. Track-level feature fields
 * are linked immediately; release-level features remain release-wide until a
 * creator explicitly matches them to songs in the credit editor.
 */
export function featuredCreditSuggestions(project = {}) {
  const suggestions = new Map();
  const releaseFeatures = project.release?.featured_artists || [];

  for (const artist of releaseFeatures) {
    const name = clean(artist);
    if (!name) continue;
    suggestions.set(nameKey(name), { name, track_ids: [] });
  }

  for (const track of project.tracks || []) {
    for (const artist of track.featured_artists || []) {
      const name = clean(artist);
      if (!name) continue;
      const key = nameKey(name);
      const current = suggestions.get(key) || { name, track_ids: [] };
      current.track_ids = unique([...current.track_ids, track.track_id]);
      suggestions.set(key, current);
    }
  }

  return [...suggestions.values()].map((suggestion) => createCreditRecord({
    ...suggestion,
    role: 'Featured Artist',
    source: 'featured_artist',
    source_key: `featured_artist:${nameKey(suggestion.name)}`,
  }, { releaseId: project.release?.release_id }));
}

/** Adds missing featured-artist records without overwriting creator edits. */
export function mergeFeaturedCreditRecords(project = {}) {
  const releaseRights = project.rights?.release_rights || {};
  const existing = Array.isArray(releaseRights.credit_records)
    ? releaseRights.credit_records.map((record, index) => createCreditRecord(record, {
        releaseId: project.release?.release_id,
        index,
      }))
    : [];
  let changed = !Array.isArray(releaseRights.credit_records);

  for (const suggestion of featuredCreditSuggestions(project)) {
    const matchIndex = existing.findIndex((record) =>
      record.source_key === suggestion.source_key
      || (nameKey(record.name) === nameKey(suggestion.name) && nameKey(record.role) === nameKey(suggestion.role))
    );
    if (matchIndex < 0) {
      existing.push(suggestion);
      changed = true;
      continue;
    }
    const match = existing[matchIndex];
    const trackIds = unique([...match.track_ids, ...suggestion.track_ids]);
    if (trackIds.length !== match.track_ids.length) {
      existing[matchIndex] = { ...match, track_ids: trackIds };
      changed = true;
    }
  }

  if (!changed) return project;
  return {
    ...project,
    rights: {
      ...project.rights,
      release_rights: { ...releaseRights, credit_records: existing },
    },
  };
}

export function creditRecordsForTrack(project = {}, trackId) {
  return (project.rights?.release_rights?.credit_records || [])
    .filter((record) => record.track_ids?.includes(trackId));
}
