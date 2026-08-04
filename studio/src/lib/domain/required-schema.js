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

const MULTI_TRACK = 'multi-track-phase-1-2026-07-31.sql';
const DROP_PAGES = 'drop-pages-2026-08-03.sql';

/**
 * Tables the app cannot function without, each with the columns that a
 * migration is known to have added. Listing columns matters: a table can
 * exist while a later migration that widened it has not run, which is exactly
 * how `releases` looked while `release_type` was missing.
 *
 * Each column names its OWN migration. A table now accumulates columns from
 * several scripts, and reporting "apply the multi-track migration" for a
 * missing Drop Page column would send someone to run SQL that cannot fix it.
 */
export const REQUIRED_SCHEMA = {
  releases: {
    migration: 'supabase_schema.sql',
    columns: [
      // Added by multi-track-phase-1. Their absence emptied the Exchange.
      ['release_type', MULTI_TRACK], ['track_count', MULTI_TRACK],
      ['disc_count', MULTI_TRACK], ['total_duration_ms', MULTI_TRACK],
      ['featured_artists', MULTI_TRACK], ['compilation_artists', MULTI_TRACK],
      ['explicit', MULTI_TRACK], ['package_size', MULTI_TRACK],
      ['genres', MULTI_TRACK], ['catalogue_number', MULTI_TRACK],
      // Added by drop-pages. Their absence breaks every shared Drop Page link
      // and empties the Exchange, which now filters on visibility.
      ['slug', DROP_PAGES], ['artist_slug', DROP_PAGES], ['visibility', DROP_PAGES],
      ['published_at', DROP_PAGES], ['allow_public_download', DROP_PAGES],
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

  // Drop Pages: routing, package version history, authenticity index, links
  // and aggregate counters.
  release_slugs: { migration: DROP_PAGES, columns: [] },
  release_packages: { migration: DROP_PAGES, columns: [] },
  release_authenticity: { migration: DROP_PAGES, columns: [] },
  release_links: { migration: DROP_PAGES, columns: [] },
  drop_analytics: { migration: DROP_PAGES, columns: [] },
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
    for (const [column, migration] of spec.columns) {
      probes.push({ table, select: column, target: `${table}.${column}`, migration });
    }
  }
  return probes;
}
