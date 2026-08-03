<script>
  /**
   * The guide, in the app.
   *
   * Answers the three questions a creator actually has: what is this step for,
   * what does it need from me, and what is still standing between me and a
   * finished object.
   *
   * The third one is the point. Studio already refuses to compile a broken
   * release, but the Export button just went grey. This reads the same checks
   * that gate export and says which step fixes each one, with a button that
   * takes you there.
   *
   * It arrives as a modal shortly after the page settles — early enough to
   * orient someone opening Studio for the first time, late enough that it is
   * not competing with the page painting. Dismiss it and it retreats to a
   * launcher in the corner that carries a count of what is still outstanding,
   * so the information stays visible without the dialog staying in the way.
   */
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { portal } from '$lib/utils/portal.js';
  import HelpModal from './HelpModal.svelte';
  import { PREFLIGHT, PRIMER, STEP_IDS, stepHelp } from '$lib/help/content.js';
  import { blockerSummary, resolveBlockers } from '$lib/help/blockers.js';

  export let step = 1;
  export let validation = { errors: [], warnings: [] };
  export let editionIssues = [];
  export let identity = {};
  export let hasMainCover = false;
  /** Creator has seen the primer before; don't re-explain the format. */
  export let seenPrimer = false;
  /** Milliseconds after mount before the guide appears. */
  export let autoOpenDelay = 450;

  /** Remembers the creator's choice to stop it opening by itself. */
  const AUTO_KEY = 'noizes.studio.coach.autoopen';

  const dispatch = createEventDispatcher();

  let open = false;
  let autoOpen = true;
  let timer;

  $: help = stepHelp(step);
  $: state = resolveBlockers({
    validation,
    editionErrors: editionIssues,
    identity,
    hasMainCover,
  });
  $: hereNow = state.byStep.get(step) ?? [];
  $: elsewhere = state.blockers.filter((item) => item.step !== step);
  $: isPublish = step === STEP_IDS.PUBLISH;
  $: showPrimer = step === STEP_IDS.IDENTITY && !seenPrimer;
  // On Publish the whole list is the subject, everywhere else only what is
  // fixable right here — a badge you cannot act on is just noise.
  $: badge = isPublish ? state.blockers.length : hereNow.length;

  onMount(() => {
    try {
      autoOpen = localStorage.getItem(AUTO_KEY) !== 'off';
    } catch {
      autoOpen = true;              // private browsing; not worth failing over
    }
    if (autoOpen) timer = setTimeout(() => (open = true), autoOpenDelay);
  });

  onDestroy(() => clearTimeout(timer));

  function setAutoOpen(value) {
    autoOpen = value;
    try {
      localStorage.setItem(AUTO_KEY, value ? 'on' : 'off');
    } catch {
      /* preference is a convenience, not a requirement */
    }
  }

  function go(target) {
    open = false;                   // get out of the way of the step we sent them to
    dispatch('navigate', { step: target });
  }
</script>

{#if help}
  <!-- The launcher. Always reachable, never in front of the form. -->
  <button
    type="button"
    class="coach-launch"
    class:has-items={badge > 0}
    aria-label="Open the guide for this step"
    use:portal
    on:click={() => (open = true)}
  >
    <span class="coach-launch-mark" aria-hidden="true">?</span>
    <span class="coach-launch-text">Guide</span>
    {#if badge > 0}
      <span class="coach-badge">{badge}</span>
    {/if}
  </button>

  <HelpModal
    bind:open
    title={help.label}
    subtitle={`Step ${step} of 8 · ${help.settles}`}
  >
    {#if showPrimer}
      <div class="coach-primer">
        <strong>{PRIMER.title}</strong>
        <p>{PRIMER.body}</p>
      </div>
    {/if}

    {#if help.required.length}
      <div class="coach-block">
        <p class="coach-label">Needed here</p>
        <ul class="coach-required">
          {#each help.required as item}
            <li>{item}</li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="coach-advice">
      <strong>{help.advice.title}</strong>
      <p>{help.advice.body}</p>
    </div>

    <!-- What is outstanding, and where it is fixed. -->
    {#if hereNow.length && !isPublish}
      <div class="coach-block">
        <p class="coach-label">Outstanding on this step</p>
        <ul class="coach-issues">
          {#each hereNow as item}
            <li><span>{item.message}</span></li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if isPublish}
      <div class="coach-block">
        <p class="coach-label">Before you publish</p>
        {#if state.ready}
          <p class="coach-ready">Everything checks out. Preview the object, play it, then compile.</p>
        {:else}
          <p class="coach-summary">{blockerSummary(state)}</p>
          <ul class="coach-issues">
            {#each state.blockers as item}
              <li>
                <span>{item.message}</span>
                <button type="button" class="coach-jump" on:click={() => go(item.step)}>
                  Fix in {item.stepLabel} →
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        <ul class="coach-preflight">
          {#each PREFLIGHT as item}
            <li>{item}</li>
          {/each}
        </ul>
      </div>
    {:else if elsewhere.length}
      <p class="coach-elsewhere">
        {elsewhere.length} item{elsewhere.length === 1 ? '' : 's'} outstanding on other steps.
        <button type="button" class="coach-jump" on:click={() => go(elsewhere[0].step)}>
          Go to {elsewhere[0].stepLabel} →
        </button>
      </p>
    {/if}

    {#if state.warnings.length && isPublish}
      <p class="coach-warnings">
        {state.warnings.length} suggestion{state.warnings.length === 1 ? '' : 's'} — advice, not blockers.
      </p>
    {/if}

    <svelte:fragment slot="footer">
      <label class="coach-auto">
        <input
          type="checkbox"
          checked={!autoOpen}
          on:change={(event) => setAutoOpen(!event.currentTarget.checked)}
        />
        <span>Don't open this automatically. I'll use the Guide button.</span>
      </label>
    </svelte:fragment>
  </HelpModal>
{/if}

<style>
  .coach-launch {
    position: fixed;
    right: 1.25rem;
    bottom: 1.25rem;
    z-index: 40;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.55rem 0.85rem 0.55rem 0.6rem;
    border-radius: 999px;
    border: 1px solid rgba(123, 92, 240, 0.35);
    background: rgba(18, 15, 26, 0.94);
    backdrop-filter: blur(10px);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
    color: var(--ink-secondary, #c9c9d1);
    font-size: 0.76rem;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, transform 0.15s;
  }
  .coach-launch:hover { color: #fff; border-color: #7b5cf0; transform: translateY(-1px); }
  .coach-launch:focus-visible { outline: 2px solid #7b5cf0; outline-offset: 3px; }

  .coach-launch-mark {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(123, 92, 240, 0.22);
    color: #b6a2ff;
    font-size: 0.7rem;
  }
  .coach-launch-text { font-weight: 500; }

  .coach-badge {
    min-width: 1.1rem;
    height: 1.1rem;
    padding: 0 0.3rem;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: #f0c98a;
    color: #2a1d08;
    font-size: 0.64rem;
    font-weight: 700;
  }

  .coach-block { margin-top: 1.1rem; }
  .coach-block:first-child { margin-top: 0; }
  .coach-label {
    margin: 0 0 0.4rem;
    font-size: 0.6rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ink-muted, #8b8b93);
  }

  .coach-required { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .coach-required li {
    font-size: 0.7rem;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--ink-secondary, #c9c9d1);
  }

  .coach-primer, .coach-advice {
    margin-top: 1.1rem;
    padding: 0.7rem 0.8rem;
    border-radius: 0.55rem;
    background: rgba(255, 255, 255, 0.03);
    border-left: 2px solid rgba(123, 92, 240, 0.6);
  }
  .coach-primer:first-child { margin-top: 0; }
  .coach-primer strong, .coach-advice strong {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: #fff;
    margin-bottom: 0.25rem;
  }
  .coach-primer p, .coach-advice p {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.6;
    color: var(--ink-secondary, #c9c9d1);
  }

  .coach-issues { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.4rem; }
  .coach-issues li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: 0.74rem;
    color: #f0c98a;
    padding: 0.4rem 0.55rem;
    border-radius: 0.4rem;
    background: rgba(240, 201, 138, 0.07);
    border: 1px solid rgba(240, 201, 138, 0.16);
  }

  .coach-jump {
    flex: none;
    background: transparent;
    border: 0;
    padding: 0;
    font-size: 0.68rem;
    color: #7b5cf0;
    cursor: pointer;
    white-space: nowrap;
  }
  .coach-jump:hover { text-decoration: underline; }
  .coach-jump:focus-visible { outline: 2px solid #7b5cf0; outline-offset: 2px; border-radius: 2px; }

  .coach-summary, .coach-elsewhere, .coach-warnings, .coach-ready {
    font-size: 0.74rem;
    color: var(--ink-secondary, #c9c9d1);
  }
  .coach-elsewhere { margin: 1.1rem 0 0; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .coach-summary { margin: 0 0 0.55rem; }
  .coach-ready { margin: 0; color: #9fe3b0; }
  .coach-warnings { margin: 0.7rem 0 0; color: var(--ink-muted, #8b8b93); }

  .coach-preflight {
    margin: 0.85rem 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.28rem;
  }
  .coach-preflight li {
    font-size: 0.72rem;
    color: var(--ink-secondary, #c9c9d1);
    padding-left: 1.1rem;
    position: relative;
  }
  .coach-preflight li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.42em;
    width: 0.62rem;
    height: 0.62rem;
    border-radius: 0.15rem;
    border: 1px solid rgba(255, 255, 255, 0.22);
  }

  .coach-auto {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.72rem;
    color: var(--ink-muted, #8b8b93);
    cursor: pointer;
  }
  .coach-auto input { accent-color: #7b5cf0; cursor: pointer; }

  @media (prefers-reduced-motion: reduce) {
    .coach-launch { transition: none; }
  }
</style>
