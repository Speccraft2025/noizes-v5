<script>
  import { createEventDispatcher } from 'svelte';
  import { getStepCompletion } from '#lib/stores/studio-nav.js';

  export let steps = [];
  export let currentStepIndex = 0;
  export let currentSectionIndex = 0;
  export let completionMap = {};

  const dispatch = createEventDispatcher();

  $: currentStepObj = steps[currentStepIndex];
  $: sectionCount = currentStepObj?.sections?.length ?? 0;
  $: sectionCompletionForStep = currentStepObj ? getStepCompletion(completionMap, currentStepObj) : { total: 0, complete: 0 };
  $: nextStepLabel = currentStepIndex < steps.length - 1 ? steps[currentStepIndex + 1].label : null;

  function handleNav(stepIndex) {
    dispatch('navigate', { stepIndex, sectionIndex: 0 });
  }

  function stepState(step, index) {
    if (index === currentStepIndex) return 'current';
    const completion = getStepCompletion(completionMap, step);
    if (completion.needsAttention) return 'attention';
    if (completion.allComplete) return 'complete';
    if (completion.complete > 0) return 'in-progress';
    return 'pending';
  }
</script>

<nav class="dock" aria-label="Studio steps">
  <div class="dock-inner">
    <div class="dock-left">
      {#if currentStepIndex > 0}
        <button
          type="button"
          class="dock-back"
          on:click={() => handleNav(currentStepIndex - 1)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Back
        </button>
      {/if}
    </div>

    <div class="dock-center">
      <div class="dock-steps">
        {#each steps as step, index}
          {@const state = stepState(step, index)}
          <button
            type="button"
            class="dock-step"
            class:dock-step-current={state === 'current'}
            class:dock-step-complete={state === 'complete'}
            class:dock-step-attention={state === 'attention'}
            class:dock-step-progress={state === 'in-progress'}
            aria-label="{step.label}{state === 'current' ? ' (current)' : ''}"
            aria-current={state === 'current' ? 'step' : undefined}
            on:click={() => handleNav(index)}
          >
            <span class="dock-step-number">
              {#if state === 'complete'}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {:else}
                {step.number}
              {/if}
            </span>
            <span class="dock-step-label">{step.label}</span>
          </button>
        {/each}
      </div>

      <div class="dock-section-progress">
        <span class="dock-section-context">
          {currentStepObj?.label} · Section {currentSectionIndex + 1} of {sectionCount}
        </span>
        <div class="dock-section-dots">
          {#each Array(sectionCount) as _, i}
            <span
              class="dock-section-dot"
              class:dock-section-dot-active={i <= currentSectionIndex}
              class:dock-section-dot-current={i === currentSectionIndex}
            ></span>
          {/each}
        </div>
      </div>
    </div>

    <div class="dock-right">
      {#if nextStepLabel}
        <span class="dock-next-hint">Up next: {nextStepLabel} →</span>
      {/if}
    </div>
  </div>
</nav>

<style>
  .dock {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 45;
    background: rgba(5, 5, 5, 0.94);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-top: 1px solid var(--border-dim);
    padding-bottom: env(safe-area-inset-bottom, 0);
  }

  .dock-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 12px 24px 14px;
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .dock-left {
    flex: 0 0 auto;
    min-width: 80px;
  }

  .dock-back {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: var(--ink-muted);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 8px;
    transition: color 0.2s, background 0.2s;
  }

  .dock-back:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.04);
  }

  .dock-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .dock-steps {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .dock-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 8px;
    transition: background 0.2s;
    min-width: 0;
  }

  .dock-step:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .dock-step-number {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 800;
    color: var(--ink-muted);
    background: rgba(255, 255, 255, 0.06);
    border: 2px solid transparent;
    transition: all 0.3s var(--ease-out);
  }

  .dock-step-current .dock-step-number {
    background: var(--spectral-violet);
    color: #fff;
    border-color: var(--spectral-violet);
    box-shadow: 0 0 0 3px rgba(123, 92, 240, 0.25);
  }

  .dock-step-complete .dock-step-number {
    background: rgba(123, 92, 240, 0.15);
    color: var(--spectral-violet);
    border-color: rgba(123, 92, 240, 0.3);
  }

  .dock-step-attention .dock-step-number {
    border-color: #F08A9D;
    color: #F08A9D;
    background: rgba(240, 138, 157, 0.08);
  }

  .dock-step-progress .dock-step-number {
    border-color: rgba(123, 92, 240, 0.4);
    color: var(--spectral-violet);
    background: rgba(123, 92, 240, 0.08);
  }

  .dock-step-label {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--ink-muted);
    white-space: nowrap;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.2s;
  }

  .dock-step-current .dock-step-label {
    color: #fff;
  }

  .dock-step-complete .dock-step-label {
    color: var(--ink-tertiary);
  }

  .dock-section-progress {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .dock-section-context {
    font-size: 0.7rem;
    color: var(--ink-muted);
    white-space: nowrap;
  }

  .dock-section-dots {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .dock-section-dot {
    width: 24px;
    height: 3px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.1);
    transition: all 0.4s var(--ease-out);
  }

  .dock-section-dot-active {
    background: var(--spectral-violet);
  }

  .dock-section-dot-current {
    background: #fff;
  }

  .dock-right {
    flex: 0 0 auto;
    min-width: 80px;
    text-align: right;
  }

  .dock-next-hint {
    font-size: 0.7rem;
    color: var(--ink-muted);
    white-space: nowrap;
  }

  /* Responsive: tablet */
  @media (max-width: 900px) {
    .dock-step-label {
      display: none;
    }

    .dock-next-hint {
      display: none;
    }

    .dock-inner {
      padding: 10px 16px 12px;
    }
  }

  /* Responsive: mobile */
  @media (max-width: 600px) {
    .dock-left {
      display: none;
    }

    .dock-right {
      display: none;
    }

    .dock-inner {
      padding: 8px 12px 10px;
      justify-content: center;
    }

    .dock-step-number {
      width: 28px;
      height: 28px;
      font-size: 0.7rem;
    }

    .dock-step {
      padding: 2px 4px;
    }

    .dock-steps {
      gap: 2px;
    }

    .dock-section-context {
      font-size: 0.6rem;
    }

    .dock-section-dot {
      width: 16px;
      height: 2px;
    }
  }
</style>
