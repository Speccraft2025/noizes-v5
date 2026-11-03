<script>
  import { createEventDispatcher } from 'svelte';
  import StudioDock from './StudioDock.svelte';
  import SaveStatus from './SaveStatus.svelte';
  import { currentStep, currentStepIndex, currentSectionIndex, STEPS, sectionCompletion, getStepCompletion, navigateToSection } from '#lib/stores/studio-nav.js';
  import { releaseProject } from '#lib/stores/package.js';

  export let draftStatus = 'saved';
  export let draftSavedAt = '';

  const dispatch = createEventDispatcher();

  function handleSaveExit() {
    dispatch('save-exit');
  }

  $: release = $releaseProject.release;
  $: completedSteps = STEPS.filter((step) => getStepCompletion($sectionCompletion, step).allComplete).length;
  $: readiness = Math.round((completedSteps / STEPS.length) * 100);
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
    <div class="studio-workspace">
      <aside class="studio-rail" aria-label="Release steps">
        <p class="rail-kicker">Build your release</p>
        <ol class="step-list">
          {#each STEPS as step, stepIndex}
            {@const completion = getStepCompletion($sectionCompletion, step)}
            <li>
              <button
                type="button"
                class:current={stepIndex === $currentStepIndex}
                class:complete={completion.allComplete}
                class:attention={completion.needsAttention}
                on:click={() => navigateToSection(stepIndex, 0)}
              >
                <span class="rail-number">{completion.allComplete ? '✓' : step.number}</span>
                <span>{step.label}</span>
              </button>
            </li>
          {/each}
        </ol>
      </aside>

      <section class="studio-main">
        <div class="studio-step-heading">
          <p class="step-context">{$currentStepIndex < 5 ? 'Make the release' : $currentStepIndex === 5 ? 'Shape the edition' : 'Prove & publish'}</p>
          <h1 class="studio-step-title">{$currentStep.label}</h1>
          <div class="studio-step-underline"></div>
        </div>

        <div class="studio-content">
          <slot />
        </div>
      </section>

      <aside class="release-overview" aria-label="Release overview">
        <p class="overview-kicker">Release overview</p>
        <div class="release-card">
          <div class="cover-placeholder" aria-hidden="true">{release.title ? release.title.slice(0, 1) : 'N'}</div>
          <div>
            <strong>{release.title || 'Untitled release'}</strong>
            <span>{release.primary_artist || 'Artist name pending'}</span>
          </div>
        </div>
        <div class="readiness">
          <div><span>Publish readiness</span><strong>{readiness}%</strong></div>
          <div class="readiness-bar"><span style={`width: ${readiness}%`}></span></div>
          <p>{completedSteps} of {STEPS.length} stages complete</p>
        </div>
        <p class="overview-note">Required details are checked as you work, so publishing is a confirmation—not a surprise audit.</p>
      </aside>
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

  .studio-workspace {
    width: min(1440px, 100%);
    margin: 0 auto;
    display: grid;
    grid-template-columns: 190px minmax(0, 1fr) 250px;
    gap: clamp(24px, 3.2vw, 52px);
    padding: 38px 48px 0;
  }

  .studio-rail, .release-overview {
    align-self: start;
    position: sticky;
    top: 82px;
  }

  .rail-kicker, .overview-kicker, .step-context {
    margin: 0 0 13px;
    color: var(--ink-muted);
    font-size: .66rem;
    font-weight: 700;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .step-list { margin: 0; padding: 0; list-style: none; }
  .step-list li + li { margin-top: 4px; }
  .step-list button {
    width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 7px;
    color: var(--ink-muted); border: 0; border-radius: 8px; background: transparent;
    text-align: left; font: inherit; font-size: .8rem; cursor: pointer;
  }
  .step-list button:hover, .step-list button.current { background: rgba(123, 92, 240, .1); color: #fff; }
  .rail-number { width: 20px; height: 20px; display: grid; place-items: center; border: 1px solid var(--border-dim); border-radius: 50%; font-size: .63rem; }
  .step-list button.current .rail-number { border-color: var(--spectral-violet); color: #c6b9ff; }
  .step-list button.complete .rail-number { border-color: rgba(123, 92, 240, .5); color: #b9a9ff; }
  .step-list button.attention .rail-number { border-color: #e4b769; color: #f1c979; }

  .studio-main { min-width: 0; }
  .studio-step-heading {
    padding: 10px 0 0;
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
    padding: 32px 0 0;
  }

  .release-overview { padding: 16px; border: 1px solid var(--border-dim); border-radius: 12px; background: rgba(255,255,255,.025); }
  .release-card { display: flex; align-items: center; gap: 10px; padding-bottom: 16px; border-bottom: 1px solid var(--border-dim); }
  .cover-placeholder { width: 42px; height: 42px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 7px; background: linear-gradient(135deg, rgba(123,92,240,.75), rgba(75,107,240,.4)); color: #fff; font-weight: 800; }
  .release-card strong, .release-card span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .release-card strong { color: #fff; font-size: .78rem; }
  .release-card span { margin-top: 4px; color: var(--ink-muted); font-size: .72rem; }
  .readiness { padding: 16px 0; border-bottom: 1px solid var(--border-dim); }
  .readiness > div:first-child { display: flex; justify-content: space-between; color: var(--ink-secondary); font-size: .72rem; }
  .readiness strong { color: #fff; font-variant-numeric: tabular-nums; }
  .readiness-bar { height: 4px; margin-top: 9px; overflow: hidden; border-radius: 99px; background: rgba(255,255,255,.1); }
  .readiness-bar span { display: block; height: 100%; border-radius: inherit; background: var(--gradient-spectral); transition: width .25s var(--ease-out); }
  .readiness p, .overview-note { margin: 8px 0 0; color: var(--ink-muted); font-size: .69rem; line-height: 1.45; }
  .overview-note { padding-top: 13px; }

  @media (max-width: 768px) {
    .studio-workspace { display: block; padding: 24px 24px 0; }
    .studio-rail, .release-overview { position: static; }
    .studio-rail { margin-bottom: 20px; }
    .step-list { display: flex; overflow-x: auto; padding-bottom: 3px; }
    .step-list li { flex: 0 0 auto; }
    .step-list li + li { margin: 0; }
    .step-list button { width: auto; white-space: nowrap; }
    .release-overview { display: none; }
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

    .studio-step-heading { padding: 0; }

    .studio-step-title {
      font-size: 1.6rem;
    }

    .studio-content {
      padding: 24px 0 0;
    }
  }

  @media (max-width: 480px) {
    .studio-header-sep {
      display: none;
    }

    .studio-workspace { padding: 20px 16px 0; }
  }
</style>
