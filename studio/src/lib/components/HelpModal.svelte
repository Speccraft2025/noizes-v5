<script>
  /**
   * The dialog the guidance lives in.
   *
   * A modal takes the keyboard away from the page behind it, so it has to give
   * it back properly: focus moves in on open, Tab cycles inside rather than
   * escaping to the form underneath, Escape closes, and focus returns to
   * whatever opened it. Without that a keyboard user opening the guide would
   * be stranded tabbing through a form they cannot see.
   */
  import { createEventDispatcher, onDestroy, tick } from 'svelte';
  import { portal } from '$lib/utils/portal.js';

  export let open = false;
  export let title = '';
  export let subtitle = '';

  const dispatch = createEventDispatcher();
  const titleId = `helpmodal-title-${Math.random().toString(36).slice(2, 9)}`;

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), '
    + 'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let dialog;
  let wasOpen = false;
  let returnFocus = null;

  // Only react to the transition, not to every re-render while open.
  $: if (open !== wasOpen) {
    wasOpen = open;
    if (open) enter();
    else leave();
  }

  async function enter() {
    returnFocus = document.activeElement;
    await tick();
    const first = dialog?.querySelector(FOCUSABLE);
    (first ?? dialog)?.focus();
  }

  function leave() {
    // Put the keyboard back where the user left it.
    const target = returnFocus;
    returnFocus = null;
    if (target && document.contains(target)) target.focus?.();
  }

  export function close() {
    if (!open) return;
    open = false;
    dispatch('close');
  }

  function onKeydown(event) {
    if (!open) return;

    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }

    if (event.key !== 'Tab') return;

    const items = [...(dialog?.querySelectorAll(FOCUSABLE) ?? [])]
      .filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];

    // Wrap at both ends so focus never leaves the dialog.
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onDestroy(() => {
    if (open) leave();
  });
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <!-- The backdrop is a click target, but the dialog inside it is what
       receives focus, so the backdrop needs no role of its own. -->
  <div
    class="scrim"
    role="presentation"
    use:portal
    on:click={(event) => event.target === event.currentTarget && close()}
  >
    <div
      class="sheet"
      bind:this={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
    >
      <header class="sheet-head">
        <div>
          <h2 id={titleId}>{title}</h2>
          {#if subtitle}<p class="sheet-sub">{subtitle}</p>{/if}
        </div>
        <button type="button" class="sheet-close" on:click={close} aria-label="Close guide">×</button>
      </header>

      <div class="sheet-body">
        <slot />
      </div>

      {#if $$slots.footer}
        <footer class="sheet-foot">
          <slot name="footer" />
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.25rem;
    background: rgba(6, 5, 10, 0.72);
    backdrop-filter: blur(6px);
    animation: scrim-in 0.18s ease-out;
  }

  .sheet {
    width: min(38rem, 100%);
    max-height: min(84vh, 46rem);
    display: flex;
    flex-direction: column;
    border-radius: 1rem;
    border: 1px solid rgba(123, 92, 240, 0.28);
    background: #0d0b13;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
    animation: sheet-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .sheet:focus { outline: none; }

  .sheet-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.15rem 1.25rem 0.9rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .sheet-head h2 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    color: #fff;
  }
  .sheet-sub {
    margin: 0.2rem 0 0;
    font-size: 0.78rem;
    color: var(--ink-secondary, #c9c9d1);
  }

  .sheet-close {
    flex: none;
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 50%;
    border: 0;
    background: rgba(255, 255, 255, 0.06);
    color: var(--ink-muted, #8b8b93);
    font-size: 1.15rem;
    line-height: 1;
    cursor: pointer;
  }
  .sheet-close:hover { color: #fff; background: rgba(255, 255, 255, 0.12); }
  .sheet-close:focus-visible { outline: 2px solid #7b5cf0; outline-offset: 2px; }

  .sheet-body {
    padding: 1.1rem 1.25rem 1.25rem;
    overflow-y: auto;
  }

  .sheet-foot {
    padding: 0.85rem 1.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  @keyframes scrim-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sheet-in {
    from { opacity: 0; transform: translateY(10px) scale(0.985); }
    to   { opacity: 1; transform: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .scrim, .sheet { animation: none; }
  }
</style>
