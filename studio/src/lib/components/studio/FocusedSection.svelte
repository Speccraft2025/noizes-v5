<script>
  import { createEventDispatcher, onMount, tick } from 'svelte';

  export let stepLabel = '';
  export let sectionLabel = '';
  export let sectionNumber = 1;
  export let totalSections = 3;
  export let heading = '';
  export let subtext = '';
  export let continueLabel = 'Continue';
  export let showBack = true;
  export let showContinue = true;
  export let continueDisabled = false;
  export let wide = false;
  export let visible = true;

  const dispatch = createEventDispatcher();
  let sectionEl;
  let entered = false;

  onMount(async () => {
    await tick();
    requestAnimationFrame(() => {
      entered = true;
    });
  });

  function handleContinue() {
    if (!continueDisabled) dispatch('continue');
  }

  function handleBack() {
    dispatch('back');
  }

  function handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      const tag = event.target?.tagName?.toLowerCase();
      const isMultiline = tag === 'textarea';
      const isButton = tag === 'button';
      const isSelect = tag === 'select';
      if (!isMultiline && !isButton && !isSelect && showContinue && !continueDisabled) {
        event.preventDefault();
        handleContinue();
      }
    }
  }
</script>

<div
  bind:this={sectionEl}
  class="focused-section"
  class:focused-section-wide={wide}
  class:focused-section-entered={entered}
  class:focused-section-hidden={!visible}
  on:keydown={handleKeydown}
  role="group"
  aria-label="{stepLabel} — {sectionLabel}"
>
  <div class="section-context">
    <span class="section-context-step">{stepLabel.toUpperCase()}</span>
    <span class="section-context-sep">·</span>
    <span class="section-context-pos">SECTION {sectionNumber} OF {totalSections}</span>
  </div>

  <h2 class="section-heading">{heading}</h2>
  {#if subtext}
    <p class="section-subtext">{subtext}</p>
  {/if}

  <div class="section-fields">
    <slot />
  </div>

  {#if showContinue || showBack}
    <div class="section-actions">
      {#if showContinue}
        <button
          type="button"
          class="section-continue"
          disabled={continueDisabled}
          on:click={handleContinue}
        >
          {continueLabel}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <span class="section-enter-hint">Press Enter</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .focused-section {
    width: 100%;
    max-width: 620px;
    margin: 0 auto;
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.28s var(--ease-out), transform 0.28s var(--ease-out);
  }

  .focused-section-wide {
    max-width: 800px;
  }

  .focused-section-entered {
    opacity: 1;
    transform: translateY(0);
  }

  .focused-section-hidden {
    display: none;
  }

  .section-context {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  .section-context-step {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--spectral-violet);
  }

  .section-context-sep {
    font-size: 0.65rem;
    color: var(--ink-muted);
  }

  .section-context-pos {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
  }

  .section-heading {
    font-size: clamp(1.5rem, 3vw, 2rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #fff;
    line-height: 1.2;
    margin: 0 0 8px;
  }

  .section-subtext {
    font-size: 0.95rem;
    color: var(--ink-secondary);
    line-height: 1.5;
    margin: 0 0 32px;
  }

  .section-fields {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 40px;
  }

  .section-continue {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 32px;
    background: var(--spectral-violet);
    color: #fff;
    font-weight: 700;
    font-size: 0.9rem;
    letter-spacing: 0.01em;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
    box-shadow: 0 0 32px rgba(123, 92, 240, 0.25);
  }

  .section-continue:hover:not(:disabled) {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 4px 40px rgba(123, 92, 240, 0.35);
  }

  .section-continue:active:not(:disabled) {
    transform: translateY(0);
  }

  .section-continue:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .section-enter-hint {
    font-size: 0.78rem;
    color: var(--ink-muted);
  }

  @media (max-width: 768px) {
    .focused-section {
      max-width: 100%;
    }

    .section-heading {
      font-size: 1.4rem;
    }

    .section-subtext {
      font-size: 0.88rem;
      margin-bottom: 24px;
    }

    .section-actions {
      margin-top: 32px;
    }

    .section-continue {
      width: 100%;
      justify-content: center;
      padding: 16px 24px;
    }

    .section-enter-hint {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .focused-section {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }
</style>
