<script>
  import { onMount, onDestroy } from 'svelte';

  export let intensity = 1;
  export let interactive = true;

  let element;
  let mouseX = 0.5;
  let mouseY = 0.5;
  let frame;

  function handlePointerMove(event) {
    if (!interactive || !element) return;
    const rect = element.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) / rect.width;
    mouseY = (event.clientY - rect.top) / rect.height;
  }

  function handlePointerLeave() {
    mouseX = 0.5;
    mouseY = 0.5;
  }

  let currentX = 0.5;
  let currentY = 0.5;

  function animate() {
    currentX += (mouseX - currentX) * 0.08;
    currentY += (mouseY - currentY) * 0.08;
    if (element) {
      element.style.setProperty('--foil-x', currentX.toFixed(3));
      element.style.setProperty('--foil-y', currentY.toFixed(3));
    }
    frame = requestAnimationFrame(animate);
  }

  onMount(() => {
    animate();
  });

  onDestroy(() => {
    cancelAnimationFrame(frame);
  });
</script>

<div
  bind:this={element}
  class="iridescent-foil"
  style="--foil-intensity: {intensity};"
  on:pointermove={handlePointerMove}
  on:pointerleave={handlePointerLeave}
  role="presentation"
>
  <div class="foil-layer" aria-hidden="true"></div>
  <div class="foil-content">
    <slot />
  </div>
</div>

<style>
  .iridescent-foil {
    --foil-x: 0.5;
    --foil-y: 0.5;
    --foil-intensity: 1;
    position: relative;
    overflow: hidden;
    border-radius: inherit;
  }

  .foil-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: inherit;
    opacity: calc(0.15 * var(--foil-intensity));
    mix-blend-mode: screen;
    background:
      radial-gradient(
        ellipse at calc(var(--foil-x) * 100%) calc(var(--foil-y) * 100%),
        rgba(255, 220, 255, 0.5) 0%,
        transparent 50%
      ),
      linear-gradient(
        calc(var(--foil-x) * 360deg),
        #ff6b6b 0%,
        #ffd93d 14%,
        #6bff6b 28%,
        #6bd4ff 42%,
        #b66bff 57%,
        #ff6bb5 71%,
        #ff6b6b 85%,
        #ffd93d 100%
      );
    background-size: 100% 100%, 200% 200%;
    background-position:
      center,
      calc(var(--foil-x) * 100%) calc(var(--foil-y) * 100%);
    transition: opacity 0.3s ease;
    animation: foilShimmer 8s ease infinite;
  }

  .foil-layer::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: repeating-linear-gradient(
      calc(45deg + var(--foil-x) * 20deg),
      transparent 0,
      rgba(255, 255, 255, 0.03) 1px,
      transparent 2px,
      transparent 4px
    );
  }

  .foil-content {
    position: relative;
    z-index: 1;
  }

  @keyframes foilShimmer {
    0%, 100% { background-position: center, 0% 50%; }
    50% { background-position: center, 100% 50%; }
  }

  .iridescent-foil:hover .foil-layer {
    opacity: calc(0.25 * var(--foil-intensity));
  }

  @media (prefers-reduced-motion: reduce) {
    .foil-layer {
      animation: none;
      transition: none;
    }
  }
</style>
