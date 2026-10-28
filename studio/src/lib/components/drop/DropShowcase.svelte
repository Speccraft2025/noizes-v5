<script>
  import { onMount, onDestroy } from 'svelte';

  export let contents = [];
  export let sections = [];
  export let packageSize = 0;
  export let available = true;

  let current = 0;
  let timer;
  let paused = false;
  let direction = 1;

  const INTERVAL = 10000;

  const slides = [
    { src: '/videos/showcase/experience-demo.webm', label: 'The Experience' },
    { src: '/videos/showcase/how-to-explore.webm', label: 'How to explore' },
    { src: '/videos/showcase/whats-inside.webm', label: 'What\'s inside' },
  ];

  function goTo(index) {
    direction = index > current ? 1 : -1;
    current = index;
    resetTimer();
  }

  function next() {
    direction = 1;
    current = (current + 1) % slides.length;
  }

  function resetTimer() {
    clearInterval(timer);
    if (!paused) timer = setInterval(next, INTERVAL);
  }

  function onPointerEnter() { paused = true; clearInterval(timer); }
  function onPointerLeave() { paused = false; resetTimer(); }

  onMount(() => { timer = setInterval(next, INTERVAL); });
  onDestroy(() => clearInterval(timer));
</script>

<section
  aria-label="Release showcase"
  class="showcase"
  on:pointerenter={onPointerEnter}
  on:pointerleave={onPointerLeave}
>
  <div class="track" style="--slide: {current};">
    {#each slides as slide, i (slide.src)}
      <div class="slide" class:active={current === i} aria-hidden={current !== i}>
        <video
          src={slide.src}
          autoplay
          loop
          muted
          playsinline
        ></video>
      </div>
    {/each}
  </div>

  <nav class="showcase-nav" aria-label="Showcase slides">
    <div class="nav-dots">
      {#each slides as slide, i (slide.src)}
        <button
          type="button"
          class="nav-dot"
          class:active={current === i}
          aria-label={slide.label}
          aria-current={current === i ? 'step' : undefined}
          on:click={() => goTo(i)}
        >
          <span class="dot-fill" style={current === i ? `animation-duration: ${INTERVAL}ms;` : ''}></span>
        </button>
      {/each}
    </div>
    <span class="nav-label">{slides[current].label}</span>
  </nav>
</section>

<style>
  .showcase {
    position: relative;
    overflow: hidden;
    border-radius: 1.25rem;
    border: 1px solid var(--border-dim);
    background: var(--bg-deep, #030303);
  }

  .track {
    display: flex;
    width: 300%;
    transform: translateX(calc(var(--slide) * -33.3333%));
    transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .slide {
    position: relative;
    width: 33.3333%;
    flex-shrink: 0;
    aspect-ratio: 16 / 9;
    opacity: 0.3;
    transition: opacity 0.6s ease;
  }
  .slide.active { opacity: 1; }

  .slide video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .showcase-nav {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1.25rem 1.5rem;
    background: linear-gradient(to top, rgba(3, 3, 3, 0.7), transparent);
  }
  @media (min-width: 640px) {
    .showcase-nav { padding: 1.5rem 2rem; }
  }

  .nav-dots {
    display: flex;
    gap: 0.375rem;
  }

  .nav-dot {
    all: unset;
    cursor: pointer;
    position: relative;
    width: 2rem;
    height: 0.1875rem;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.2);
    overflow: hidden;
    transition: width 0.4s var(--ease-out);
  }
  .nav-dot.active { width: 3rem; }
  .nav-dot:hover { background: rgba(255, 255, 255, 0.3); }

  .dot-fill {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--spectral-violet);
    transform-origin: left;
    transform: scaleX(0);
  }
  .nav-dot.active .dot-fill {
    animation: dot-progress linear forwards;
  }

  @keyframes dot-progress {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }

  .nav-label {
    font-size: 0.6875rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    letter-spacing: 0.04em;
  }
</style>
