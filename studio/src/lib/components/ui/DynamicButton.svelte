<script>
  import { createEventDispatcher } from 'svelte';

  export let states = [];
  export let current = 0;
  export let disabled = false;

  const dispatch = createEventDispatcher();

  let pressed = false;
  let transitioning = false;

  $: state = states[current] || { label: '', icon: '' };
  $: prevState = current > 0 ? states[current - 1] : null;

  function handleClick() {
    if (disabled || transitioning) return;
    transitioning = true;
    setTimeout(() => { transitioning = false; }, 300);
    dispatch('click', { current, state });
  }
</script>

<svelte:window on:pointerup={() => { pressed = false; }} />

<button
  type="button"
  class="dynamic-btn"
  class:pressed
  class:transitioning
  {disabled}
  on:click={handleClick}
  on:pointerdown={() => { if (!disabled) pressed = true; }}
>
  {#key current}
    <span class="dynamic-label" class:enter={transitioning}>
      {#if state.icon}
        <span class="dynamic-icon" aria-hidden="true">{state.icon}</span>
      {/if}
      {state.label}
    </span>
  {/key}
</button>

<style>
  .dynamic-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 28px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--ink-secondary, rgba(255, 255, 255, 0.7));
    font-weight: 700;
    font-size: 0.85rem;
    letter-spacing: 0.02em;
    border-radius: 99px;
    border: 1px solid var(--border-dim, rgba(255, 255, 255, 0.08));
    cursor: pointer;
    overflow: hidden;
    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .dynamic-btn:hover:not(:disabled) {
    border-color: var(--border-hover, rgba(255, 255, 255, 0.15));
    color: #fff;
    background: rgba(255, 255, 255, 0.06);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  .dynamic-btn.pressed {
    transform: scale(0.96);
    box-shadow: none;
  }

  .dynamic-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .dynamic-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }

  .dynamic-label.enter {
    animation: labelSwap 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dynamic-icon {
    font-size: 1.1em;
    line-height: 1;
  }

  @keyframes labelSwap {
    0% {
      opacity: 0;
      transform: translateY(8px) scale(0.95);
      filter: blur(2px);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
      filter: blur(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dynamic-btn { transition: none; }
    .dynamic-label.enter { animation: none; }
  }
</style>
