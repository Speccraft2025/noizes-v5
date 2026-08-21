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

  it('previews exactly the two experience systems a creator can choose', () => {
    expect(page).toContain("$template === 'ultra-v2'");
    expect(page).toContain("$template === 'transcendence-v1'");
    // Archived templates must stay unreachable.
    expect(page).not.toContain("$template === 'codex'");
    expect(page).not.toContain("$template === 'transmission'");
    expect(page).not.toContain("$template === 'monument'");
  });

  it('keeps the system selector inside the Experience step rather than adding a ninth', () => {
    const experienceStep = readFileSync(new URL('../../../lib/components/StepExperience.svelte', import.meta.url), 'utf8');
    expect(page).toContain('<StepExperience />');
    expect(experienceStep).toContain('CANONICAL_TEMPLATE');
    expect(experienceStep).toContain('TRANSCENDENCE_V2_TEMPLATE');
    // ULTRA's own authoring is unchanged: the Guide editor still renders under it.
    expect(experienceStep).toContain('<StepGuide />');
  });

  it('does not persist measured artefacts into the draft', () => {
    // Terrain and analysis are derived from the audio. A draft that carried them
    // would be megabytes and could go stale against a re-uploaded master.
    expect(page).toContain('draftableTranscendence(get(transcendence))');
    expect(page).toContain('terrain: null, analysis: null');
  });
});
