<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';

  export let contents = [];
  export let sections = [];
  export let packageSize = 0;
  export let available = true;

  const dispatch = createEventDispatcher();

  let current = 0;
  let timer;
  let paused = false;
  let direction = 1;

  const INTERVAL = 6000;

  const GLYPHS = {
    opening: '◐', tracklist: '≡', lyrics: '¶', story: '❞', gallery: '▦',
    notes: '✎', video: '▶', play: '◇', guide: '➔', credits: '★',
  };

  const CONTENT_ICONS = {
    audio: '♫', versions: '⟐', stems: '◫', artwork: '▣',
    video: '▶', notes: '✎', lyrics: '¶', metadata: '◈', authenticity: '⊕',
  };

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let index = 0;
    let size = value;
    while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
    return `${size >= 10 || index === 0 ? Math.round(size) : size.toFixed(1)} ${units[index]}`;
  }

  function goTo(index) {
    direction = index > current ? 1 : -1;
    current = index;
    resetTimer();
  }

  function next() {
    direction = 1;
    current = (current + 1) % 3;
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
  <!-- Slide track -->
  <div class="track" style="--slide: {current}; --dir: {direction};">

    <!-- Slide 1: The Experience -->
    <div class="slide" class:active={current === 0} aria-hidden={current !== 0}>
      <video
        class="slide-video"
        src="/videos/showcase/experience-demo.webm"
        autoplay
        loop
        muted
        playsinline
        aria-hidden="true"
      ></video>
      <div class="slide-inner">
        <div class="slide-header">
          <span class="slide-label">The Experience</span>
          <h2 class="slide-title">See how it comes alive</h2>
          <p class="slide-desc">
            Your browser becomes the player. Every section unfolds from the package itself — no app, no account, no connection needed.
          </p>
        </div>

        <div class="experience-grid">
          {#each sections as section (section.key)}
            <button
              type="button"
              class="experience-card"
              disabled={!available}
              on:click={() => dispatch('open', section.anchor)}
            >
              <span class="card-glyph" aria-hidden="true">{GLYPHS[section.key] ?? '·'}</span>
              <span class="card-label">
                {section.label}
                {#if section.count}
                  <span class="card-count">{section.count}</span>
                {/if}
              </span>
              <span class="card-blurb">{section.blurb}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- Slide 2: How to Explore -->
    <div class="slide" class:active={current === 1} aria-hidden={current !== 1}>
      <video
        class="slide-video"
        src="/videos/showcase/how-to-explore.webm"
        autoplay
        loop
        muted
        playsinline
        aria-hidden="true"
      ></video>
      <div class="slide-inner">
        <div class="slide-header">
          <span class="slide-label">How to explore</span>
          <h2 class="slide-title">Your .NZ file, unpacked</h2>
          <p class="slide-desc">
            One file. Everything inside. Here's how it works once it's yours.
          </p>
        </div>

        <div class="steps-grid">
          <div class="step-card">
            <div class="step-number">1</div>
            <div class="step-body">
              <h3 class="step-name">Acquire</h3>
              <p class="step-detail">Get your copy from this page. It's a single .nz file — the entire release, packaged.</p>
            </div>
          </div>
          <div class="step-connector" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="step-card">
            <div class="step-number">2</div>
            <div class="step-body">
              <h3 class="step-name">Open</h3>
              <p class="step-detail">Drop it into any browser. The experience boots from the file — nothing loads from the internet.</p>
            </div>
          </div>
          <div class="step-connector" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="step-card">
            <div class="step-number">3</div>
            <div class="step-body">
              <h3 class="step-name">Explore</h3>
              <p class="step-detail">Play tracks, read lyrics, browse artwork, check credits. It's all there, offline forever.</p>
            </div>
          </div>
        </div>

        <div class="format-badges">
          <span class="format-badge">
            <span class="badge-dot" aria-hidden="true"></span>
            Offline-first
          </span>
          <span class="format-badge">
            <span class="badge-dot" aria-hidden="true"></span>
            No account needed
          </span>
          <span class="format-badge">
            <span class="badge-dot" aria-hidden="true"></span>
            Yours to keep
          </span>
        </div>
      </div>
    </div>

    <!-- Slide 3: What's Inside -->
    <div class="slide" class:active={current === 2} aria-hidden={current !== 2}>
      <video
        class="slide-video"
        src="/videos/showcase/whats-inside.webm"
        autoplay
        loop
        muted
        playsinline
        aria-hidden="true"
      ></video>
      <div class="slide-inner">
        <div class="slide-header">
          <div class="slide-header-row">
            <div>
              <span class="slide-label">What's inside</span>
              <h2 class="slide-title">The complete package</h2>
            </div>
            {#if packageSize}
              <span class="package-size">{formatBytes(packageSize)} · one file</span>
            {/if}
          </div>
          <p class="slide-desc">
            Everything listed here is in the .nz file. Nothing is assumed — if it's on this list, the package contains it.
          </p>
        </div>

        <div class="contents-grid">
          {#each contents as row (row.key)}
            <div class="content-card">
              <span class="content-icon" aria-hidden="true">{CONTENT_ICONS[row.key] ?? '·'}</span>
              <div class="content-body">
                <span class="content-label">{row.label}</span>
                <span class="content-detail">{row.detail}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- Navigation -->
  <nav class="showcase-nav" aria-label="Showcase slides">
    <div class="nav-dots">
      {#each [0, 1, 2] as i}
        <button
          type="button"
          class="nav-dot"
          class:active={current === i}
          aria-label="Slide {i + 1}"
          aria-current={current === i ? 'step' : undefined}
          on:click={() => goTo(i)}
        >
          <span class="dot-fill" style={current === i ? `animation-duration: ${INTERVAL}ms;` : ''}></span>
        </button>
      {/each}
    </div>
    <span class="nav-label">
      {#if current === 0}The Experience{:else if current === 1}How to explore{:else}What's inside{/if}
    </span>
  </nav>
</section>

<style>
  .showcase {
    position: relative;
    overflow: hidden;
    border-radius: 1.25rem;
    border: 1px solid var(--border-dim);
    background: rgba(255, 255, 255, 0.02);
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
    padding: 2rem 1.5rem 2.5rem;
    opacity: 0.3;
    transition: opacity 0.6s ease;
    overflow: hidden;
  }
  .slide.active { opacity: 1; }

  .slide-video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.25;
    pointer-events: none;
  }
  .slide.active .slide-video { opacity: 0.45; }

  @media (min-width: 640px) {
    .slide { padding: 2.5rem 2.5rem 3rem; }
  }

  .slide-inner {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .slide-header { display: flex; flex-direction: column; gap: 0.5rem; }
  .slide-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .slide-label {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--spectral-violet);
  }

  .slide-title {
    font-size: 1.5rem;
    font-weight: 900;
    color: #fff;
    letter-spacing: -0.01em;
    line-height: 1.2;
    margin: 0;
  }

  .slide-desc {
    font-size: 0.8125rem;
    line-height: 1.6;
    color: var(--ink-muted);
    max-width: 38rem;
    margin: 0;
  }

  .package-size {
    font-size: 0.6875rem;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: var(--ink-muted);
    white-space: nowrap;
    margin-top: 1.25rem;
  }

  /* --- Slide 1: Experience grid --- */
  .experience-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.625rem;
  }
  @media (min-width: 768px) {
    .experience-grid { grid-template-columns: repeat(3, 1fr); }
  }

  .experience-card {
    all: unset;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.875rem 1rem;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-dim);
    transition: all 0.25s ease;
  }
  .experience-card:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--border-hover);
    transform: translateY(-1px);
  }
  .experience-card:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .card-glyph {
    font-size: 1.125rem;
    color: var(--spectral-violet);
  }
  .card-label {
    font-size: 0.8125rem;
    font-weight: 700;
    color: #fff;
  }
  .card-count {
    font-weight: 400;
    color: var(--ink-muted);
    margin-left: 0.25rem;
  }
  .card-blurb {
    font-size: 0.6875rem;
    line-height: 1.4;
    color: var(--ink-muted);
  }

  /* --- Slide 2: Steps --- */
  .steps-grid {
    display: flex;
    flex-direction: column;
    gap: 0;
    align-items: stretch;
  }
  @media (min-width: 640px) {
    .steps-grid {
      flex-direction: row;
      align-items: flex-start;
      gap: 0;
    }
  }

  .step-card {
    flex: 1;
    display: flex;
    gap: 0.875rem;
    padding: 1.125rem 1rem;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-dim);
  }

  .step-connector {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0;
    color: rgba(255, 255, 255, 0.12);
  }
  .step-connector svg {
    width: 1.25rem;
    height: 1.25rem;
    transform: rotate(90deg);
  }
  @media (min-width: 640px) {
    .step-connector { padding: 0 0.375rem; }
    .step-connector svg { transform: rotate(0deg); }
  }

  .step-number {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--gradient-spectral);
    font-size: 0.75rem;
    font-weight: 800;
    color: #fff;
    flex-shrink: 0;
  }

  .step-body { display: flex; flex-direction: column; gap: 0.25rem; }
  .step-name { font-size: 0.875rem; font-weight: 700; color: #fff; margin: 0; }
  .step-detail { font-size: 0.75rem; line-height: 1.5; color: var(--ink-muted); margin: 0; }

  .format-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
  }

  .format-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--ink-secondary);
    padding: 0.375rem 0.75rem;
    border-radius: 99px;
    border: 1px solid var(--border-dim);
    background: rgba(255, 255, 255, 0.02);
  }

  .badge-dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    background: var(--spectral-violet);
  }

  /* --- Slide 3: Contents grid --- */
  .contents-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  @media (min-width: 480px) {
    .contents-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .content-card {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-dim);
  }

  .content-icon {
    font-size: 1rem;
    color: var(--spectral-violet);
    margin-top: 0.0625rem;
    flex-shrink: 0;
  }

  .content-body { display: flex; flex-direction: column; gap: 0.125rem; }
  .content-label { font-size: 0.8125rem; font-weight: 700; color: #fff; }
  .content-detail { font-size: 0.6875rem; line-height: 1.4; color: var(--ink-muted); }

  /* --- Navigation --- */
  .showcase-nav {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0 1.5rem 1.5rem;
  }
  @media (min-width: 640px) {
    .showcase-nav { padding: 0 2.5rem 2rem; }
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
    background: rgba(255, 255, 255, 0.1);
    overflow: hidden;
    transition: width 0.4s var(--ease-out);
  }
  .nav-dot.active { width: 3rem; }
  .nav-dot:hover { background: rgba(255, 255, 255, 0.15); }

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
    color: var(--ink-muted);
    letter-spacing: 0.04em;
  }
</style>
