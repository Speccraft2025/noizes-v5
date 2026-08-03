import { describe, expect, it } from 'vitest';
import { describeLoadError, firstLoadError } from './load-errors.js';

/**
 * The Exchange used to destructure `{ data }` and drop `{ error }`, so a
 * failed query rendered as "No releases yet" — the page confidently told
 * buyers the catalogue was empty while every release sat safely in the
 * database, unreadable because a migration had not been deployed.
 *
 * These pin the two properties that matter: a failure is never silent, and
 * the raw database error never reaches the browser.
 */

describe('describeLoadError', () => {
  it('says nothing when nothing went wrong', () => {
    expect(describeLoadError(null)).toBeNull();
    expect(describeLoadError(undefined)).toBeNull();
  });

  it('recognises a schema that is behind the application', () => {
    // 42703 is what Postgres returns for releases.release_type not existing —
    // the exact failure that emptied the Exchange.
    const described = describeLoadError({ code: '42703', message: 'column releases.release_type does not exist' });
    expect(described.kind).toBe('schema');
    expect(described.message).toMatch(/migration/i);
  });

  it('treats a missing table and a stale PostgREST cache the same way', () => {
    for (const code of ['42P01', 'PGRST200', 'PGRST201', 'PGRST204', 'PGRST205']) {
      expect(describeLoadError({ code }).kind, code).toBe('schema');
    }
  });

  it('classifies the two errors the live Exchange actually produced', () => {
    // Captured from the dev server with the migration unapplied. The first was
    // initially misread as a generic outage: PostgREST reports an unresolvable
    // embedded join as a missing *relationship*, not a missing table.
    const observed = [
      { code: 'PGRST200', message: "Could not find a relationship between 'releases' and 'tracks' in the schema cache" },
      { code: '42703', message: 'column releases_1.release_type does not exist' },
    ];
    for (const error of observed) {
      expect(describeLoadError(error).kind, error.code).toBe('schema');
      expect(describeLoadError(error).message).toMatch(/migration/i);
    }
  });

  it('still reports failures it cannot classify', () => {
    // The whole point: an unknown code must never fall through to silence.
    const described = describeLoadError({ code: '08006', message: 'connection failure' });
    expect(described).not.toBeNull();
    expect(described.kind).toBe('unavailable');
  });

  it('distinguishes an unreadable shelf from an empty one, in words', () => {
    expect(describeLoadError({ code: '42703' }).message).toMatch(/safe/i);
    expect(describeLoadError({ code: '08006' }).message).toMatch(/not an empty shelf/i);
  });

  it('names what could not be read', () => {
    expect(describeLoadError({ code: '42703' }, { subject: 'collection' }).message)
      .toContain('collection');
  });

  it('never forwards the raw database error to the browser', () => {
    // Error details name columns and constraints; these pages are public.
    const raw = {
      code: '42703',
      message: 'column releases.release_type does not exist',
      details: 'table public.releases has columns id, title',
      hint: 'Perhaps you meant to reference the column "releases.release_date".',
    };
    const serialized = JSON.stringify(describeLoadError(raw));

    expect(serialized).not.toContain('release_type');
    expect(serialized).not.toContain(raw.details);
    expect(serialized).not.toContain(raw.hint);
    expect(Object.keys(describeLoadError(raw)).sort()).toEqual(['kind', 'message']);
  });
});

describe('firstLoadError', () => {
  it('reports the first failure so one break cannot hide behind a success', () => {
    expect(firstLoadError([null, { code: '42703' }]).kind).toBe('schema');
  });

  it('prefers the earlier error when several queries fail', () => {
    // The primary listing is passed first; its failure is the one to surface.
    expect(firstLoadError([{ code: '08006' }, { code: '42703' }]).kind).toBe('unavailable');
  });

  it('is null when every query succeeded', () => {
    expect(firstLoadError([null, undefined])).toBeNull();
  });
});
