import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');
const extras = readFileSync(new URL('../../../lib/components/StepExtras.svelte', import.meta.url), 'utf8');
const navigation = readFileSync(new URL('../../../lib/stores/studio-nav.js', import.meta.url), 'utf8');

describe('Studio workflow contract', () => {
  it('has the seven focused product steps in order', () => {
    const labels = [...navigation.matchAll(/id: '[^']+',\s+number: \d+,\s+label: '([^']+)'/g)].map((match) => match[1]);
    expect(labels).toEqual(['Identity', 'Assets', 'Lyrics', 'Extras', 'Experience', 'Edition', 'Rights & export']);
  });

  it('does not expose Theme or Games as standalone steps', () => {
    expect(navigation).not.toMatch(/label: 'Theme'/);
    expect(navigation).not.toMatch(/label: 'Games'/);
    expect(extras).toContain("import StepPlay from './StepPlay.svelte'");
  });

  it('previews exactly the two experience systems a creator can choose', () => {
    const experienceStep = readFileSync(new URL('../../../lib/components/StepExperience.svelte', import.meta.url), 'utf8');
    expect(experienceStep).toContain("CANONICAL_TEMPLATE");
    expect(experienceStep).toContain("TRANSCENDENCE_V2_TEMPLATE");
    // Archived templates must stay unreachable.
    expect(experienceStep).not.toContain("$template === 'codex'");
    expect(experienceStep).not.toContain("$template === 'transmission'");
    expect(experienceStep).not.toContain("$template === 'monument'");
  });

  it('keeps the system selector inside the Experience step rather than adding a ninth', () => {
    const experienceStep = readFileSync(new URL('../../../lib/components/StepExperience.svelte', import.meta.url), 'utf8');
    expect(page).toContain("import('#lib/components/StepExperience.svelte')");
    expect(page).toContain('<svelte:component this={StepExperience}');
    expect(experienceStep).toContain('CANONICAL_TEMPLATE');
    expect(experienceStep).toContain('TRANSCENDENCE_V2_TEMPLATE');
    expect(experienceStep).toContain('Lyric typography');
    expect(experienceStep).toContain('LYRIC_FONT_PRESETS');
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
