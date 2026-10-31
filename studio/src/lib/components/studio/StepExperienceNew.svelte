<script>
  import FocusedSection from './FocusedSection.svelte';
  import { template, transcendence, play } from '#lib/stores/package.js';
  import { currentSection, STEPS, markSectionState, nextSection, prevSection } from '#lib/stores/studio-nav.js';

  const step = STEPS[4];
  const sections = step.sections;

  function handleContinue() {
    markSectionState(step.id, $currentSection.id, 'complete');
    nextSection();
  }
  function handleBack() { prevSection(); }

  $: sectionId = $currentSection?.id;
</script>

{#if sectionId === 'select-experience'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[0].label}
    sectionNumber={1}
    totalSections={sections.length}
    heading={sections[0].heading}
    subtext={sections[0].subtext}
    on:continue={handleContinue}
    on:back={handleBack}
  >
    <div class="experience-note">
      The Experience step loads dynamically. This section will show the template chooser and configuration once the full Experience module is loaded by the orchestrator.
    </div>

    <div class="template-cards">
      <button type="button" class="template-card" class:template-card-active={$template === 'ultra-v2'} on:click={() => $template = 'ultra-v2'}>
        <span class="template-card-icon">◎</span>
        <span class="template-card-name">Ultra V2</span>
        <span class="template-card-desc">Standard immersive presentation</span>
      </button>
      <button type="button" class="template-card" class:template-card-active={$template === 'transcendence'} on:click={() => $template = 'transcendence'}>
        <span class="template-card-icon">▲</span>
        <span class="template-card-name">Transcendence</span>
        <span class="template-card-desc">3D terrain-based experience</span>
      </button>
    </div>
  </FocusedSection>
{/if}

{#if sectionId === 'customize'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[1].label}
    sectionNumber={2}
    totalSections={sections.length}
    heading={sections[1].heading}
    subtext={sections[1].subtext}
    on:continue={handleContinue}
    on:back={handleBack}
  >
    <div class="experience-note">
      Template-specific customisation options appear here. The full StepExperience component is lazy-loaded by the orchestrator and rendered within this section.
    </div>
    <div class="placeholder-slot" id="experience-customize-slot">
      <slot name="experience-customize" />
    </div>
  </FocusedSection>
{/if}

{#if sectionId === 'preview'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[2].label}
    sectionNumber={3}
    totalSections={sections.length}
    heading={sections[2].heading}
    subtext={sections[2].subtext}
    continueLabel="Continue to Edition"
    on:continue={handleContinue}
    on:back={handleBack}
  >
    <div class="experience-note">
      Preview of the selected experience template appears here once built. The lazy-loaded Experience component provides its own preview rendering.
    </div>
    <div class="placeholder-slot" id="experience-preview-slot">
      <slot name="experience-preview" />
    </div>
  </FocusedSection>
{/if}

<style>
  .experience-note {
    padding: 16px 20px; border-radius: 12px; font-size: 0.82rem; color: var(--ink-muted);
    background: rgba(255,255,255,0.02); border: 1px solid var(--border-dim);
  }

  .template-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  .template-card {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 28px 20px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-dim);
    border-radius: 14px; cursor: pointer; transition: all 0.2s; text-align: center;
  }
  .template-card:hover { border-color: var(--border-hover); }
  .template-card-active { border-color: var(--spectral-violet); background: rgba(123,92,240,0.06); }
  .template-card-icon { font-size: 1.6rem; color: var(--spectral-violet); }
  .template-card-name { font-size: 0.92rem; font-weight: 800; color: #fff; }
  .template-card-desc { font-size: 0.75rem; color: var(--ink-muted); }

  .placeholder-slot { min-height: 120px; }

  @media (max-width: 600px) {
    .template-cards { grid-template-columns: 1fr; }
  }
</style>
