/**
 * What the application needs the database to look like.
 *
 * This exists because "has the migration been applied?" was, for three days,
 * answerable only by querying for a column and seeing whether it errored. The
 * multi-track migration shipped in code at 23:21 and was never run; the
 * Exchange showed an empty catalogue and nothing anywhere disagreed.
 *
 * Kept as data, and free of `$env` imports, so it can be checked from a CLI,
 * a health endpoint, or a test without dragging the app in with it.
 */

/**
 * Tables the app cannot function without, each with the columns that a
 * migration is known to have added. Listing columns matters: a table can
 * exist while a later migration that widened it has not run, which is exactly
 * how `releases` looked while `release_type` was missing.
 */
export const REQUIRED_SCHEMA = {
  releases: {
    migration: 'supabase_schema.sql',
    columns: [
      // Added by multi-track-phase-1. Their absence emptied the Exchange.
      'release_type', 'track_count', 'disc_count', 'total_duration_ms',
      'featured_artists', 'compilation_artists', 'explicit', 'package_size',
      'genres', 'catalogue_number',
    ],
  },
  acquisitions: { migration: 'supabase_schema.sql', columns: [] },
  profiles: { migration: 'supabase_schema.sql', columns: [] },
  invites: { migration: 'supabase_schema.sql', columns: [] },
  waitlist: { migration: 'supabase_schema.sql', columns: [] },
  offers: { migration: 'provenance-resale-2026-07-26.sql', columns: [] },
  payment_intents: { migration: 'provenance-resale-2026-07-26.sql', columns: [] },
  provenance_events: { migration: 'provenance-resale-2026-07-26.sql', columns: [] },
  collector_notes: { migration: 'provenance-resale-2026-07-26.sql', columns: [] },
  creator_signing_keys: { migration: 'supabase_schema.sql', columns: [] },
  registry_signing_key: { migration: 'supabase_schema.sql', columns: [] },
  kyc_submissions: { migration: 'kyc-artist-fields-2026-07-20.sql', columns: [] },

  // The normalized multi-track foundation.
  tracks: { migration: 'multi-track-phase-1-2026-07-31.sql', columns: [] },
  audio_versions: { migration: 'multi-track-phase-1-2026-07-31.sql', columns: [] },
  audio_assets: { migration: 'multi-track-phase-1-2026-07-31.sql', columns: [] },
};

/** Postgres / PostgREST codes meaning "the schema is not what we expect". */
const DRIFT_CODES = new Set(['42703', '42P01', 'PGRST200', 'PGRST201', 'PGRST204', 'PGRST205']);

export function isDriftError(error) {
  return Boolean(error) && DRIFT_CODES.has(error.code);
}

/**
 * Turn probe results into a verdict.
 *
 * @param {Array<{target: string, migration: string, error: object|null}>} results
 * @returns {{ok: boolean, missing: Array, migrations: string[], summary: string}}
 */
export function summarizeSchemaCheck(results) {
  const missing = results.filter((result) => isDriftError(result.error));
  // A non-drift error (network, auth) is not proof of drift and must not be
  // reported as such — but it is still a failure, so it is surfaced apart.
  const errored = results.filter((result) => result.error && !isDriftError(result.error));

  const migrations = [...new Set(missing.map((item) => item.migration))].sort();

  let summary;
  if (missing.length) {
    summary = `${missing.length} missing object${missing.length === 1 ? '' : 's'}. `
      + `Apply: ${migrations.join(', ')}`;
  } else if (errored.length) {
    summary = `Could not verify the schema: ${errored.length} probe${errored.length === 1 ? '' : 's'} failed.`;
  } else {
    summary = `Schema matches: ${results.length} objects checked.`;
  }

  return { ok: missing.length === 0 && errored.length === 0, missing, errored, migrations, summary };
}

/** Every table/column pair the checker should probe, flattened. */
export function schemaProbes() {
  const probes = [];
  for (const [table, spec] of Object.entries(REQUIRED_SCHEMA)) {
    probes.push({ table, select: 'count', target: table, migration: spec.migration });
    for (const column of spec.columns) {
      probes.push({ table, select: column, target: `${table}.${column}`, migration: 'multi-track-phase-1-2026-07-31.sql' });
    }
  }
  return probes;
}
