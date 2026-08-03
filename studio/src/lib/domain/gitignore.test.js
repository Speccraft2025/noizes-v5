import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * The repository's ignore rules, tested.
 *
 * Two failures motivate this. A plain `git add` on a newly dropped-in
 * subproject once staged 980 files and 95 MB of Gradle output, because the
 * ignore file named none of the four apps in here. And while fixing that, a
 * blanket `build/` rule was nearly added — which would have silently dropped
 * noizes-gallery-pwa/build/sites-vite-plugin.ts, a source file its
 * vite.config imports, from the index.
 *
 * So both directions need pinning: junk must be caught, and nothing tracked
 * may become invisible.
 */

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url));

const git = (args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

/** True when git would ignore this path. */
function isIgnored(path) {
  try {
    execFileSync('git', ['check-ignore', '-q', '--no-index', path], { cwd: ROOT });
    return true;
  } catch {
    return false;
  }
}

describe('ignore rules do not hide real work', () => {
  it('leaves every tracked file visible', () => {
    // The single most important property. A rule that shadows a tracked file
    // produces confusing, hard-to-diagnose behaviour for everyone afterwards.
    const tracked = git(['ls-files']).split('\n').filter(Boolean);
    expect(tracked.length).toBeGreaterThan(100);

    const shadowed = tracked.filter(isIgnored);
    expect(shadowed, 'tracked files matched by an ignore rule').toEqual([]);
  });

  it('keeps build directories that are actually source', () => {
    // build/ is output in most projects and source in this one. It is the
    // exact trap a blanket rule sets.
    expect(isIgnored('noizes-gallery-pwa/build/sites-vite-plugin.ts')).toBe(false);
  });

  it('keeps .env.example while ignoring real .env files', () => {
    expect(isIgnored('studio/.env.example')).toBe(false);
    expect(isIgnored('beatsunlimited-app/.env.example')).toBe(false);
    expect(isIgnored('studio/.env')).toBe(true);
    expect(isIgnored('studio/.env.local')).toBe(true);
  });
});

describe('ignore rules catch generated output', () => {
  it('ignores dependencies and build output in every existing subproject', () => {
    const cases = [
      'studio/node_modules/x.js',
      'beatsunlimited-app/node_modules/x.js',
      'noizes-gallery-pwa/node_modules/x.js',
      'noizes-gallery-pwa/dist/server/index.js',
      'noizes-gallery-pwa/.vinext/state.json',
      'noizes-gallery-pwa/.wrangler/tmp/x',
      'noizes-gallery-android/.gradle/8.14.3/checksums/x.bin',
      'noizes-gallery-android/.kotlin/errors/e.log',
      'noizes-gallery-android/app/build/outputs/apk/debug/app-debug.apk',
    ];
    for (const path of cases) {
      expect(isIgnored(path), `${path} should be ignored`).toBe(true);
    }
  });

  it('covers a subproject that does not exist yet', () => {
    // The point of the unanchored patterns: the fifth app is covered before
    // anyone remembers to add a rule for it.
    for (const path of [
      'some-future-app/node_modules/a.js',
      'some-future-app/dist/bundle.js',
      'some-future-app/coverage/lcov.info',
      'some-future-app/.next/build-manifest.json',
      'some-future-app/target/debug/binary',
    ]) {
      expect(isIgnored(path), `${path} should be ignored`).toBe(true);
    }
  });

  it('ignores the machine-local files that differ per developer', () => {
    expect(isIgnored('noizes-gallery-android/local.properties')).toBe(true);
    expect(isIgnored('studio/.DS_Store')).toBe(true);
  });
});
