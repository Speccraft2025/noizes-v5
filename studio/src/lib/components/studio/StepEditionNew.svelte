<script>
  import FocusedSection from './FocusedSection.svelte';
  import StudioField from './StudioField.svelte';
  import { edition, CURRENCIES } from '#lib/stores/package.js';
  import { editionErrors } from '#lib/utils/project.js';
  import { currentSection, STEPS, markSectionState, nextSection, prevSection } from '#lib/stores/studio-nav.js';

  const step = STEPS[5];
  const sections = step.sections;

  $: errors = editionErrors($edition);

  function handleContinue() {
    markSectionState(step.id, $currentSection.id, 'complete');
    nextSection();
  }
  function handleBack() { prevSection(); }

  $: sectionId = $currentSection?.id;
</script>

{#if sectionId === 'edition-identity'}
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
    <StudioField label="Public edition name">
      <input type="text" bind:value={$edition.edition_name} placeholder="e.g. Inaugural Pressing" />
    </StudioField>

    <StudioField label="Edition description" optional hint="What makes this pressing meaningful?">
      <textarea rows="3" bind:value={$edition.edition_description} placeholder="What makes this pressing meaningful?"></textarea>
    </StudioField>
  </FocusedSection>
{/if}

{#if sectionId === 'supply-pricing'}
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
    <StudioField label="Fixed supply" hint="Supply is permanent after publication. Copies are numbered deterministically.">
      <input type="number" min="1" step="1" bind:value={$edition.edition_size} placeholder="e.g. 100" />
    </StudioField>

    <div class="price-row">
      <div class="price-amount">
        <StudioField label="Price">
          <input type="number" min="0.01" step="0.01" bind:value={$edition.price} placeholder="0.00" />
        </StudioField>
      </div>
      <div class="price-currency">
        <StudioField label="Currency">
          <select bind:value={$edition.currency}>
            {#each CURRENCIES as c}<option value={c}>{c}</option>{/each}
          </select>
        </StudioField>
      </div>
    </div>

    <div class="toggle-row">
      <label class="toggle-control" for="transferable">
        <input id="transferable" type="checkbox" bind:checked={$edition.transferable} class="sr-only" />
        <span class="toggle-track" class:toggle-track-on={$edition.transferable}>
          <span class="toggle-thumb" class:toggle-thumb-on={$edition.transferable}></span>
        </span>
      </label>
      <label for="transferable" class="toggle-label">Transferable ownership</label>
    </div>
  </FocusedSection>
{/if}

{#if sectionId === 'review-edition'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[2].label}
    sectionNumber={3}
    totalSections={sections.length}
    heading={sections[2].heading}
    subtext={sections[2].subtext}
    continueLabel="Continue to Rights"
    on:continue={handleContinue}
    on:back={handleBack}
  >
    <div class="edition-review">
      <div class="edition-review-row">
        <span class="edition-review-label">Edition</span>
        <span class="edition-review-value">{$edition.edition_name || 'Unnamed'}</span>
      </div>
      <div class="edition-review-row">
        <span class="edition-review-label">Supply</span>
        <span class="edition-review-value">{$edition.edition_size || '—'} copies</span>
      </div>
      <div class="edition-review-row">
        <span class="edition-review-label">Price</span>
        <span class="edition-review-value">{$edition.price || '—'} {$edition.currency}</span>
      </div>
      <div class="edition-review-row">
        <span class="edition-review-label">Transferable</span>
        <span class="edition-review-value">{$edition.transferable ? 'Yes' : 'No'}</span>
      </div>
    </div>

    {#if errors.length}
      <div class="edition-errors">
        {#each errors as error}<p>• {error}</p>{/each}
      </div>
    {/if}
  </FocusedSection>
{/if}

<style>
  .price-row { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
  .price-amount { grid-column: 1; }
  .price-currency { grid-column: 2; }

  .toggle-row { display: flex; align-items: center; gap: 12px; }
  .toggle-control { position: relative; cursor: pointer; flex-shrink: 0; }
  .toggle-track {
    display: flex; align-items: center; width: 40px; height: 22px;
    border-radius: 11px; background: rgba(255,255,255,0.1); padding: 2px; transition: background 0.2s;
  }
  .toggle-track-on { background: var(--spectral-violet); }
  .toggle-thumb {
    width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.2s;
  }
  .toggle-thumb-on { transform: translateX(18px); }
  .toggle-label { font-size: 0.88rem; font-weight: 700; color: #fff; cursor: pointer; }

  .edition-review { display: flex; flex-direction: column; gap: 2px; }
  .edition-review-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; background: rgba(255,255,255,0.02); border-radius: 10px;
  }
  .edition-review-label { font-size: 0.85rem; font-weight: 600; color: #fff; }
  .edition-review-value { font-size: 0.85rem; color: var(--ink-secondary); }

  .edition-errors {
    padding: 14px 18px; border-radius: 12px; font-size: 0.82rem;
    background: rgba(240,75,107,0.08); border: 1px solid rgba(240,75,107,0.2); color: #F08A9D;
  }
  .edition-errors p { margin: 4px 0; }

  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }

  @media (max-width: 600px) {
    .price-row { grid-template-columns: 1fr; }
    .price-amount, .price-currency { grid-column: 1; }
  }
</style>
