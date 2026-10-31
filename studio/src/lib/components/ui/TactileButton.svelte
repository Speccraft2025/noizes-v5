<script>
  import { createEventDispatcher } from 'svelte';

  export let variant = 'spectral';
  export let size = 'md';
  export let disabled = false;
  export let href = '';
  export let type = 'button';

  const dispatch = createEventDispatcher();

  let pressed = false;

  function handlePointerDown() {
    if (disabled) return;
    pressed = true;
  }

  function handlePointerUp() {
    pressed = false;
  }

  function handleClick(event) {
    if (disabled) return;
    dispatch('click', event);
  }

  const sizes = {
    sm: 'text-xs px-4 py-2',
    md: 'text-sm px-6 py-3',
    lg: 'text-base px-8 py-4',
  };
</script>

<svelte:window on:pointerup={handlePointerUp} />

{#if href && !disabled}
  <a
    {href}
    class="tactile-btn tactile-{variant} {sizes[size] || sizes.md}"
    class:pressed
    on:click={handleClick}
    on:pointerdown={handlePointerDown}
  >
    <span class="tactile-face"><slot /></span>
  </a>
{:else}
  <button
    {type}
    {disabled}
    class="tactile-btn tactile-{variant} {sizes[size] || sizes.md}"
    class:pressed
    on:click={handleClick}
    on:pointerdown={handlePointerDown}
  >
    <span class="tactile-face"><slot /></span>
  </button>
{/if}

<style>
  .tactile-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: 700;
    letter-spacing: 0.01em;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    background: transparent;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    text-decoration: none;
    outline: none;
    transition: filter 0.2s;
  }

  .tactile-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tactile-face {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    border-radius: inherit;
    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1),
                box-shadow 0.15s ease;
    will-change: transform;
  }

  /* Spectral variant */
  .tactile-spectral .tactile-face {
    background: linear-gradient(135deg, #7B5CF0 0%, #4B6BF0 100%);
    color: #fff;
    box-shadow:
      0 4px 0 0 #5A3DC0,
      0 6px 16px rgba(123, 92, 240, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    transform: translateY(0);
  }

  .tactile-spectral.pressed .tactile-face {
    transform: translateY(3px);
    box-shadow:
      0 1px 0 0 #5A3DC0,
      0 2px 8px rgba(123, 92, 240, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .tactile-spectral:not(:disabled):hover .tactile-face {
    box-shadow:
      0 5px 0 0 #5A3DC0,
      0 8px 24px rgba(123, 92, 240, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }

  .tactile-spectral:not(:disabled):active .tactile-face,
  .tactile-spectral.pressed .tactile-face {
    transform: translateY(3px);
    box-shadow:
      0 1px 0 0 #5A3DC0,
      0 2px 8px rgba(123, 92, 240, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  /* Ghost variant */
  .tactile-ghost .tactile-face {
    background: rgba(255, 255, 255, 0.04);
    color: var(--ink-secondary, rgba(255, 255, 255, 0.7));
    border: 1px solid var(--border-dim, rgba(255, 255, 255, 0.08));
    box-shadow:
      0 3px 0 0 rgba(255, 255, 255, 0.03),
      0 4px 12px rgba(0, 0, 0, 0.2);
    transform: translateY(0);
  }

  .tactile-ghost:not(:disabled):hover .tactile-face {
    border-color: var(--border-hover, rgba(255, 255, 255, 0.15));
    color: #fff;
    box-shadow:
      0 4px 0 0 rgba(255, 255, 255, 0.04),
      0 6px 16px rgba(0, 0, 0, 0.3);
    transform: translateY(-1px);
  }

  .tactile-ghost:not(:disabled):active .tactile-face,
  .tactile-ghost.pressed .tactile-face {
    transform: translateY(2px);
    box-shadow:
      0 1px 0 0 rgba(255, 255, 255, 0.02),
      0 2px 6px rgba(0, 0, 0, 0.15);
  }

  /* Danger variant */
  .tactile-danger .tactile-face {
    background: linear-gradient(135deg, #F04B4B 0%, #D03030 100%);
    color: #fff;
    box-shadow:
      0 4px 0 0 #A02020,
      0 6px 16px rgba(240, 75, 75, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
    transform: translateY(0);
  }

  .tactile-danger:not(:disabled):hover .tactile-face {
    box-shadow:
      0 5px 0 0 #A02020,
      0 8px 24px rgba(240, 75, 75, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
  }

  .tactile-danger:not(:disabled):active .tactile-face,
  .tactile-danger.pressed .tactile-face {
    transform: translateY(3px);
    box-shadow:
      0 1px 0 0 #A02020,
      0 2px 8px rgba(240, 75, 75, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  /* Sizing applied to the face */
  .tactile-btn.text-xs .tactile-face { padding: 8px 16px; font-size: 0.75rem; }
  .tactile-btn.text-sm .tactile-face { padding: 12px 24px; font-size: 0.875rem; }
  .tactile-btn.text-base .tactile-face { padding: 16px 32px; font-size: 1rem; }

  @media (prefers-reduced-motion: reduce) {
    .tactile-face {
      transition: none;
    }
  }
</style>
