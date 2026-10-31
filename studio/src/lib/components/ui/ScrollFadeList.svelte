<script>
  import { onMount, onDestroy } from 'svelte';

  export let direction = 'horizontal';
  export let fadeSize = 32;

  let container;
  let showStart = false;
  let showEnd = false;
  let observer;

  function check() {
    if (!container) return;
    if (direction === 'horizontal') {
      showStart = container.scrollLeft > 2;
      showEnd = container.scrollLeft < container.scrollWidth - container.clientWidth - 2;
    } else {
      showStart = container.scrollTop > 2;
      showEnd = container.scrollTop < container.scrollHeight - container.clientHeight - 2;
    }
  }

  onMount(() => {
    check();
    observer = new ResizeObserver(check);
    observer.observe(container);
  });

  onDestroy(() => {
    observer?.disconnect();
  });
</script>

<div
  class="scroll-fade"
  class:horizontal={direction === 'horizontal'}
  class:vertical={direction !== 'horizontal'}
  class:fade-start={showStart}
  class:fade-end={showEnd}
  style="--fade-size: {fadeSize}px;"
>
  <div
    bind:this={container}
    class="scroll-inner"
    on:scroll={check}
  >
    <slot />
  </div>
</div>

<style>
  .scroll-fade {
    position: relative;
    overflow: hidden;
  }

  .scroll-inner {
    overflow: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .scroll-inner::-webkit-scrollbar {
    display: none;
  }

  .horizontal .scroll-inner {
    overflow-x: auto;
    overflow-y: hidden;
    display: flex;
    gap: inherit;
  }

  .vertical .scroll-inner {
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* Fade masks */
  .scroll-fade::before,
  .scroll-fade::after {
    content: '';
    position: absolute;
    z-index: 2;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.25s ease;
  }

  /* Horizontal fades */
  .horizontal::before,
  .horizontal::after {
    top: 0;
    bottom: 0;
    width: var(--fade-size);
  }

  .horizontal::before {
    left: 0;
    background: linear-gradient(to right, var(--bg-deep, #030303), transparent);
  }

  .horizontal::after {
    right: 0;
    background: linear-gradient(to left, var(--bg-deep, #030303), transparent);
  }

  /* Vertical fades */
  .vertical::before,
  .vertical::after {
    left: 0;
    right: 0;
    height: var(--fade-size);
  }

  .vertical::before {
    top: 0;
    background: linear-gradient(to bottom, var(--bg-deep, #030303), transparent);
  }

  .vertical::after {
    bottom: 0;
    background: linear-gradient(to top, var(--bg-deep, #030303), transparent);
  }

  /* Show/hide */
  .fade-start::before { opacity: 1; }
  .fade-end::after { opacity: 1; }

  @media (prefers-reduced-motion: reduce) {
    .scroll-fade::before,
    .scroll-fade::after {
      transition: none;
    }
  }
</style>
