/**
 * Turning a failed query into something a page can say out loud.
 *
 * Supabase returns `{ data, error }`. Destructuring only `data` and falling
 * back to `[]` is a very easy mistake to make and a very quiet one to live
 * with: the page renders its empty state and tells the reader there is
 * nothing here, when in fact the records exist and the read failed. The
 * Exchange did exactly this — buyers saw "No releases yet" while every
 * published release sat safely in the database.
 *
 * Kept free of `$env` imports so it stays testable and usable from any route.
 */

/**
 * Postgres and PostgREST codes that mean the database does not have the shape
 * the query expects — in practice, a migration that has not been deployed.
 */
const SCHEMA_CODES = new Set([
  '42703',    // undefined_column
  '42P01',    // undefined_table
  // PostgREST reports an unresolvable embedded join as a missing relationship
  // rather than a missing table. The Exchange hit exactly this: `tracks` had
  // not been created, so `releases(... tracks(...))` failed with PGRST200
  // while the resale query failed with 42703 for the same missing migration.
  'PGRST200', // could not find a relationship (missing foreign key)
  'PGRST201', // ambiguous relationship between tables
  'PGRST204', // column not found in schema cache
  'PGRST205', // table not found in schema cache
]);

/**
 * @param {{code?: string, message?: string} | null | undefined} error
 * @param {{ subject?: string }} [options] what could not be read, for the copy
 * @returns {{kind: 'schema'|'unavailable', message: string} | null}
 */
export function describeLoadError(error, { subject = 'catalogue' } = {}) {
  if (!error) return null;

  if (SCHEMA_CODES.has(error.code)) {
    return {
      kind: 'schema',
      message: `The ${subject} could not be read because the database is behind the application. `
        + 'Your records are safe — this page cannot see them until the pending migration is deployed.',
    };
  }

  // Anything unrecognised still gets reported. Silence is the bug being fixed
  // here, so an unknown code must never fall through to "nothing found".
  return {
    kind: 'unavailable',
    message: `The ${subject} could not be loaded just now. `
      + 'This is a fault on our side, not an empty shelf.',
  };
}

/**
 * Report the first failure among several queries, so one broken read cannot
 * hide behind another that happened to succeed.
 */
export function firstLoadError(errors, options) {
  return describeLoadError(errors.find(Boolean), options);
}
