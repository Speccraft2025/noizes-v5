<script>
  import { createEventDispatcher } from 'svelte';

  export let label = 'Hold to confirm';
  export let confirmLabel = 'Confirmed';
  export let duration = 1500;
  export let variant = 'danger';
  export let disabled = false;

  const dispatch = createEventDispatcher();

  let progress = 0;
  let holding = false;
  let confirmed = false;
  let startTime = 0;
  let frame;

  function start() {
    if (disabled || confirmed) return;
    holding = true;
    startTime = performance.now();
    tick();
  }

  function tick() {
    if (!holding) return;
    const elapsed = performance.now() - startTime;
    progress = Math.min(elapsed / duration, 1);
    if (progress >= 1) {
      confirmed = true;
      holding = false;
      dispatch('confirm');
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    holding = false;
    cancelAnimationFrame(frame);
    if (!confirmed) progress = 0;
  }

  function reset() {
    confirmed = false;
    progress = 0;
  }
</script>

<svelte:window on:pointerup={stop} on:pointercancel={stop} />

<button
  type="button"
  class="hold-btn hold-{variant}"
  class:holding
  class:confirmed
  {disabled}
  on:pointerdown={start}
  style="--progress: {progress}"
  aria-label={confirmed ? confirmLabel : label}
>
  <span class="hold-track" aria-hidden="true"></span>
  <span class="hold-fill" aria-hidden="true"></span>
  <span class="hold-label">
    {#if confirmed}
      <span class="hold-check" aria-hidden="true">✓</span>
      {confirmLabel}
    {:else if holding}
      Keep holding…
    {:else}
      {label}
    {/if}
  </span>
</button>

<style>
  .hold-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 16px 32px;
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    overflow: hidden;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
                opacity 0.3s;
  }

  .hold-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .hold-btn.holding {
    transform: scale(0.98);
  }

  .hold-btn.confirmed {
    transform: scale(1);
  }

  .hold-track {
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }

  .hold-fill {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    transform-origin: left;
    transform: scaleX(var(--progress));
    transition: transform 0.05s linear;
  }

  .hold-label {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .hold-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 0.7rem;
    animation: checkPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* Danger variant */
  .hold-danger .hold-track {
    background: rgba(240, 75, 75, 0.15);
  }
  .hold-danger .hold-fill {
    background: linear-gradient(135deg, #F04B4B, #D03030);
  }
  .hold-danger .hold-label { color: #F08A9D; }
  .hold-danger.holding .hold-label { color: #fff; }
  .hold-danger.confirmed { background: #2a8a2a; }
  .hold-danger.confirmed .hold-fill { background: #2a8a2a; transform: scaleX(1); }
  .hold-danger.confirmed .hold-label { color: #fff; }
  .hold-danger .hold-check { background: rgba(255,255,255,0.2); color: #fff; }

  /* Spectral variant */
  .hold-spectral .hold-track {
    background: rgba(123, 92, 240, 0.1);
  }
  .hold-spectral .hold-fill {
    background: linear-gradient(135deg, #7B5CF0, #4B6BF0);
  }
  .hold-spectral .hold-label { color: var(--ink-secondary, rgba(255,255,255,0.7)); }
  .hold-spectral.holding .hold-label { color: #fff; }
  .hold-spectral.confirmed { background: rgba(123, 92, 240, 0.2); }
  .hold-spectral.confirmed .hold-fill { background: linear-gradient(135deg, #7B5CF0, #4B6BF0); transform: scaleX(1); }
  .hold-spectral.confirmed .hold-label { color: #fff; }
  .hold-spectral .hold-check { background: rgba(255,255,255,0.2); color: #fff; }

  @keyframes checkPop {
    from { transform: scale(0); }
    to { transform: scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .hold-btn, .hold-fill, .hold-check { transition: none; animation: none; }
  }
</style>
