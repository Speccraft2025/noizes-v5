<script>
  import { createEventDispatcher } from 'svelte';
  import StudioDock from './StudioDock.svelte';
  import SaveStatus from './SaveStatus.svelte';
  import { currentStep, currentStepIndex, currentSectionIndex, STEPS, sectionCompletion, getStepCompletion, navigateToSection } from '#lib/stores/studio-nav.js';

  export let draftStatus = 'saved';
  export let draftSavedAt = '';

  const dispatch = createEventDispatcher();

  function handleSaveExit() {
    dispatch('save-exit');
  }
</script>

<div class="studio-shell">
  <header class="studio-header">
    <div class="studio-header-inner">
      <div class="studio-header-left">
        <a href="/" class="studio-brand">
          <img src="/logo-wordmark.png" alt="NOIZES" class="studio-brand-logo" />
          <span class="studio-brand-divider"></span>
          <span class="studio-brand-label">STUDIO</span>
        </a>
      </div>
      <div class="studio-header-right">
        <SaveStatus status={draftStatus} savedAt={draftSavedAt} />
        <span class="studio-header-sep">|</span>
        <button type="button" class="studio-header-action" on:click={handleSaveExit}>
          Save & exit
        </button>
      </div>
    </div>
  </header>

  <div class="studio-body">
    <div class="studio-step-heading">
      <h1 class="studio-step-title">{$currentStep.label}</h1>
      <div class="studio-step-underline"></div>
    </div>

    <div class="studio-content">
      <slot />
    </div>
  </div>

  <StudioDock
    steps={STEPS}
    currentStepIndex={$currentStepIndex}
    currentSectionIndex={$currentSectionIndex}
    completionMap={$sectionCompletion}
    on:navigate={(e) => navigateToSection(e.detail.stepIndex, e.detail.sectionIndex ?? 0)}
  />
</div>

<style>
  .studio-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--bg-deep);
  }

  .studio-header {
    position: sticky;
    top: 0;
    z-index: 40;
    background: rgba(3, 3, 3, 0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border-dim);
  }

  .studio-header-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 24px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .studio-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
  }

  .studio-brand-logo {
    height: 24px;
    width: auto;
  }

  .studio-brand-divider {
    width: 1px;
    height: 20px;
    background: var(--border-dim);
  }

  .studio-brand-label {
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    color: var(--ink-muted);
  }

  .studio-header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .studio-header-sep {
    color: var(--border-dim);
    font-size: 0.85rem;
  }

  .studio-header-action {
    background: none;
    border: none;
    color: var(--ink-secondary);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    padding: 6px 0;
    transition: color 0.2s;
  }

  .studio-header-action:hover {
    color: #fff;
  }

  .studio-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding-bottom: 120px;
  }

  .studio-step-heading {
    padding: 48px 48px 0;
    max-width: 720px;
  }

  .studio-step-title {
    font-size: 2rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: #fff;
    margin: 0;
    line-height: 1.15;
  }

  .studio-step-underline {
    width: 40px;
    height: 3px;
    background: var(--spectral-violet);
    margin-top: 12px;
    border-radius: 2px;
  }

  .studio-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 24px 0;
  }

  @media (max-width: 768px) {
    .studio-header-inner {
      padding: 0 16px;
      height: 48px;
    }

    .studio-brand-logo {
      height: 20px;
    }

    .studio-brand-label {
      font-size: 0.7rem;
    }

    .studio-step-heading {
      padding: 32px 24px 0;
    }

    .studio-step-title {
      font-size: 1.6rem;
    }

    .studio-content {
      padding: 24px 16px 0;
    }
  }

  @media (max-width: 480px) {
    .studio-header-sep {
      display: none;
    }

    .studio-step-heading {
      padding: 24px 16px 0;
    }
  }
</style>
