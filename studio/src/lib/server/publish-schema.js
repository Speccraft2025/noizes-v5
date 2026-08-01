export const PUBLISH_SCHEMA_MIGRATION = 'backend/multi-track-phase-1-2026-07-31.sql';

const REQUIRED_QUERIES = Object.freeze([
  ['releases', 'id,release_type,catalogue_number,release_metadata'],
  ['tracks', 'id,release_id'],
  ['audio_versions', 'id,release_id'],
  ['audio_assets', 'id,release_id'],
]);

// Publishing must not begin uploading a release if the normalized schema is
// absent. Otherwise Storage succeeds first and the creator sees a misleading
// half-published state only when the final database insert fails.
export async function findPublishSchemaError(sb) {
  const results = await Promise.all(REQUIRED_QUERIES.map(async ([table, columns]) => {
    const { error } = await sb.from(table).select(columns).limit(1);
    return error ? { table, error } : null;
  }));
  return results.find(Boolean) || null;
}

export function publishSchemaMessage(failure) {
  const detail = failure?.error?.message ? ` Supabase reported: ${failure.error.message}` : '';
  return `Publishing is temporarily unavailable because the normalized release database migration has not been applied. Deploy ${PUBLISH_SCHEMA_MIGRATION}, then retry; your Studio draft is safe.${detail}`;
}
