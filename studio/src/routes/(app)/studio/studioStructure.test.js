import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');
const extras = readFileSync(new URL('../../../lib/components/StepExtras.svelte', import.meta.url), 'utf8');

describe('Studio workflow contract', () => {
  it('has exactly the eight multi-track product steps in order', () => {
    const labels = [...page.matchAll(/\{ id: \d+, label: '([^']+)'/g)].map((match) => match[1]);
    expect(labels).toEqual(['Identity', 'Tracklist', 'Assets', 'Lyrics', 'Extras', 'Experience', 'Edition', 'Publish']);
  });

  it('does not expose Theme or Games as standalone steps', () => {
    expect(page).not.toMatch(/label: 'Theme'/);
    expect(page).not.toMatch(/label: 'Games'/);
    expect(extras).toContain("import StepPlay from './StepPlay.svelte'");
  });

  it('renders only the canonical ultra-v2 preview branch', () => {
    expect(page).toContain("$template === 'ultra-v2'");
    expect(page).not.toContain("$template === 'codex'");
    expect(page).not.toContain("$template === 'transmission'");
  });
});
