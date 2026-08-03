import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { REQUIRED_SCHEMA, isDriftError, schemaProbes, summarizeSchemaCheck } from './required-schema.js';

/**
 * The multi-track migration shipped in code and was never applied. Nothing in
 * the repo, the database, or CI could say so, and a swallowed query error
 * rendered the result as an empty catalogue for three days.
 *
 * The manifest here is the fix, and a hand-written manifest rots — so the
 * first test below derives the truth from the source instead of trusting it.
 */

const ROUTES = fileURLToPath(new URL('../../routes', import.meta.url));

/** Every table the app actually queries, read out of the source. */
function tablesQueriedInSource(dir) {
  const found = new Set();
  for (const entry of readdirSync(dir)) {
    const path = `${dir}/${entry}`;
    if (statSync(path).isDirectory()) {
      for (const table of tablesQueriedInSource(path)) found.add(table);
    } else if (/\.(js|svelte)$/.test(entry)) {
      for (const [, table] of readFileSync(path, 'utf8').matchAll(/\.from\('([a-z_]+)'\)/g)) {
        found.add(table);
      }
    }
  }
  return found;
}

describe('the manifest stays honest', () => {
  it('covers every table the application queries', () => {
    // If someone adds `.from('new_table')` without listing it here, the drift
    // check would happily pass while the page 500s. This is that guard.
    const queried = tablesQueriedInSource(ROUTES);
    const declared = new Set(Object.keys(REQUIRED_SCHEMA));

    const undeclared = [...queried].filter((table) => !declared.has(table))
      // 'nope' is a deliberate not-a-table string used in a test fixture.
      .filter((table) => table !== 'nope');

    expect(undeclared, 'tables queried but absent from REQUIRED_SCHEMA').toEqual([]);
  });

  it('names a migration for every entry, so a failure is actionable', () => {
    for (const [table, spec] of Object.entries(REQUIRED_SCHEMA)) {
      expect(spec.migration, `${table} has no migration`).toBeTruthy();
      expect(spec.migration).toMatch(/\.sql$/);
    }
  });

  it('points at migrations that exist on disk', () => {
    const backend = fileURLToPath(new URL('../../../../backend', import.meta.url));
    const files = new Set(readdirSync(backend));
    for (const [table, spec] of Object.entries(REQUIRED_SCHEMA)) {
      expect(files.has(spec.migration), `${table} → ${spec.migration} not in backend/`).toBe(true);
    }
  });

  it('probes the columns whose absence emptied the Exchange', () => {
    const targets = schemaProbes().map((probe) => probe.target);
    for (const column of ['releases.release_type', 'releases.track_count', 'releases.genres']) {
      expect(targets, `${column} must be probed`).toContain(column);
    }
    expect(targets).toContain('tracks');
    expect(targets).toContain('audio_versions');
    expect(targets).toContain('audio_assets');
  });
});

describe('isDriftError', () => {
  it('recognises the codes drift actually produces', () => {
    // Observed live: PGRST200 from the embedded tracks join, 42703 from
    // releases.release_type, PGRST205 from the missing tables.
    for (const code of ['42703', '42P01', 'PGRST200', 'PGRST201', 'PGRST204', 'PGRST205']) {
      expect(isDriftError({ code }), code).toBe(true);
    }
  });

  it('does not mistake an outage for drift', () => {
    // Reporting "apply this migration" during a network blip sends someone to
    // run SQL against a database that was fine.
    for (const code of ['NETWORK', 'HTTP_401', '08006', undefined]) {
      expect(isDriftError({ code }), String(code)).toBe(false);
    }
    expect(isDriftError(null)).toBe(false);
  });
});

describe('summarizeSchemaCheck', () => {
  const ok = (target) => ({ target, migration: 'm.sql', error: null });

  it('passes when everything is present', () => {
    const verdict = summarizeSchemaCheck([ok('releases'), ok('tracks')]);
    expect(verdict.ok).toBe(true);
    expect(verdict.summary).toMatch(/2 objects checked/);
  });

  it('fails and names the migration to run', () => {
    const verdict = summarizeSchemaCheck([
      ok('releases'),
      { target: 'tracks', migration: 'multi-track-phase-1-2026-07-31.sql', error: { code: 'PGRST205' } },
    ]);
    expect(verdict.ok).toBe(false);
    expect(verdict.migrations).toEqual(['multi-track-phase-1-2026-07-31.sql']);
    expect(verdict.summary).toContain('multi-track-phase-1-2026-07-31.sql');
  });

  it('lists each missing migration once, however many objects are absent', () => {
    const verdict = summarizeSchemaCheck([
      { target: 'tracks', migration: 'multi.sql', error: { code: 'PGRST205' } },
      { target: 'audio_versions', migration: 'multi.sql', error: { code: 'PGRST205' } },
      { target: 'audio_assets', migration: 'multi.sql', error: { code: 'PGRST205' } },
    ]);
    expect(verdict.migrations).toEqual(['multi.sql']);
    expect(verdict.missing).toHaveLength(3);
  });

  it('separates "cannot verify" from "is missing"', () => {
    // An unreachable database must not be reported as drift; the remedy is
    // completely different.
    const verdict = summarizeSchemaCheck([
      ok('releases'),
      { target: 'tracks', migration: 'm.sql', error: { code: 'NETWORK', message: 'timeout' } },
    ]);
    expect(verdict.ok).toBe(false);
    expect(verdict.missing).toHaveLength(0);
    expect(verdict.errored).toHaveLength(1);
    expect(verdict.summary).toMatch(/could not verify/i);
  });
});
