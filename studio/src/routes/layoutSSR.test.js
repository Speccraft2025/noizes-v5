import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync(new URL('./+layout.svelte', import.meta.url), 'utf8');

describe('root layout server rendering', () => {
  it('uses SvelteKit page state without legacy store auto-subscription', () => {
    // `$app/stores` no longer exists in SvelteKit 3, while `$page` tries to
    // subscribe to the rune-only `$app/state` value and crashes SSR.
    expect(layout).toContain("import { page } from '$app/state'");
    expect(layout).not.toContain("from '$app/stores'");
    expect(layout).toContain('page.url.pathname');
    expect(layout).not.toContain('$page.url.pathname');
  });
});
