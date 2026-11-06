import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync(new URL('./+layout.svelte', import.meta.url), 'utf8');

describe('root layout server rendering', () => {
  it('uses the legacy page store with legacy `$page` syntax', () => {
    // `$page` auto-subscription only works with the store exported by
    // `$app/stores`; `$app/state` is a rune-only value and crashes SSR.
    expect(layout).toContain("import { page } from '$app/stores'");
    expect(layout).not.toContain("from '$app/state'");
    expect(layout).toContain('$page.url.pathname');
  });
});
