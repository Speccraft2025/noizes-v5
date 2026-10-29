<script>
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { embeddedExperiencePath } from '#lib/domain/experience-preview.js';

  export let release;
  export let contents = [];
  export let sections = [];
  export let packageSize = 0;
  export let available = true;

  const dispatch = createEventDispatcher();
  const INTERVAL = 10000;
  const GLYPHS = {
    opening: '◐', tracklist: '≡', lyrics: '¶', story: '❞', gallery: '▦',
    notes: '✎', video: '▶', play: '◇', guide: '➔', credits: '★',
  };
  const CONTENT_ICONS = {
    audio: '♫', versions: '⟐', stems: '◫', artwork: '▣',
    video: '▶', notes: '✎', lyrics: '¶', metadata: '◈', authenticity: '⊕',
  };

  let current = 0;
  let timer;
  let paused = false;

  $: previewUrl = embeddedExperiencePath(release);

  $: slides = [
    { label: 'Live experience', key: 'preview' },
    { label: 'What you get', key: 'contents' },
    { label: 'How to explore', key: 'sections' },
  ];

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let index = 0;
    let size = value;
    while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
    return `${size >= 10 || index === 0 ? Math.round(size) : size.toFixed(1)} ${units[index]}`;
  }

  function resetTimer() {
    clearInterval(timer);
    if (!paused) timer = setInterval(() => goTo((current + 1) % slides.length), INTERVAL);
  }

  function goTo(index) {
    current = index;
    resetTimer();
  }

  function pause() {
    paused = true;
    clearInterval(timer);
  }

  function resume() {
    paused = false;
    resetTimer();
  }

  onMount(resetTimer);
  onDestroy(() => clearInterval(timer));
</script>

<section
  aria-label="Release showcase"
  class="showcase"
  on:pointerenter={pause}
  on:pointerleave={resume}
>
  <div class="track" style="--slide: {current};">
    <article class="slide preview-slide" aria-hidden={current !== 0} inert={current !== 0}>
      {#if available && previewUrl}
        <!-- This is the actual package experience. The child route verifies the
             .nz then runs its own opaque sandbox, exactly like /experience. -->
        <iframe
          src={previewUrl}
          title={`Preview ${release.title} by ${release.artist_name}`}
          allow="autoplay"
          class="experience-preview"
        ></iframe>
      {:else}
        <div class="unavailable-preview">
          <span>◐</span>
          <p>Live preview unavailable</p>
        </div>
      {/if}
    </article>

    <article class="slide info-slide" aria-hidden={current !== 1}>
      <div class="slide-copy">
        <span class="eyebrow">Inside the package</span>
        <h2>Everything in this release</h2>
        {#if packageSize}<span class="package-size">{formatBytes(packageSize)} · one .nz file</span>{/if}
      </div>
      <dl class="contents-grid">
        {#each contents as item (item.key)}
          <div class="content-card">
            <dt><span aria-hidden="true">{CONTENT_ICONS[item.key] ?? '·'}</span>{item.label}</dt>
            <dd>{item.detail}</dd>
          </div>
        {/each}
      </dl>
    </article>

    <article class="slide info-slide" aria-hidden={current !== 2}>
      <div class="slide-copy">
        <span class="eyebrow">Explore the release</span>
        <h2>Open any chapter</h2>
        <p>Each route below comes directly from this package’s experience.</p>
      </div>
      <div class="section-grid">
        {#each sections as section (section.key)}
          <button
            type="button"
            class="section-card"
            disabled={!available}
            on:click={() => dispatch('open', section.anchor)}
          >
            <span class="section-glyph" aria-hidden="true">{GLYPHS[section.key] ?? '·'}</span>
            <span class="section-label">{section.label}</span>
            <span class="section-blurb">{section.blurb}</span>
          </button>
        {/each}
      </div>
    </article>
  </div>

  <nav class="showcase-nav" aria-label="Showcase slides">
    <div class="nav-dots">
      {#each slides as slide, i (slide.key)}
        <button
          type="button"
          class="nav-dot"
          class:active={current === i}
          aria-label={slide.label}
          aria-current={current === i ? 'step' : undefined}
          on:click={() => goTo(i)}
        ><span class="dot-fill" style={current === i ? `animation-duration: ${INTERVAL}ms;` : ''}></span></button>
      {/each}
    </div>
    <span class="nav-label">{slides[current].label}</span>
  </nav>
</section>

<style>
  .showcase { position: relative; overflow: hidden; border-radius: 1.25rem; border: 1px solid var(--border-dim); background: var(--bg-deep, #030303); }
  .track { display: flex; width: 300%; min-height: 28rem; transform: translateX(calc(var(--slide) * -33.3333%)); transition: transform .7s cubic-bezier(.16,1,.3,1); }
  .slide { position: relative; width: 33.3333%; flex-shrink: 0; min-height: 28rem; }
  .preview-slide { aspect-ratio: 16 / 9; min-height: 0; background: #030303; }
  .experience-preview { display: block; width: 100%; height: 100%; border: 0; background: #030303; }
  .unavailable-preview { height: 100%; display: grid; place-content: center; gap: .75rem; text-align: center; color: var(--ink-muted); font-size: .875rem; }
  .unavailable-preview span { color: var(--spectral-violet); font-size: 2rem; }
  .info-slide { padding: 2rem 1.5rem 4.5rem; }
  .slide-copy { display: flex; align-items: baseline; gap: .75rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
  .eyebrow { color: var(--spectral-violet); font-size: .6875rem; letter-spacing: .12em; text-transform: uppercase; font-weight: 700; }
  h2 { margin: 0; color: white; font-size: clamp(1.375rem, 3vw, 2rem); letter-spacing: -.04em; }
  .slide-copy p, .package-size { width: 100%; margin: 0; color: var(--ink-muted); font-size: .8125rem; }
  .contents-grid, .section-grid { display: grid; gap: .625rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .content-card, .section-card { min-height: 6rem; border: 1px solid var(--border-dim); border-radius: .875rem; background: rgba(255,255,255,.03); padding: 1rem; text-align: left; }
  .content-card dt { color: white; font-weight: 700; font-size: .8125rem; }
  .content-card dt span { color: var(--spectral-violet); margin-right: .5rem; }
  .content-card dd { color: var(--ink-muted); font-size: .75rem; margin: .5rem 0 0; line-height: 1.35; }
  .section-card { cursor: pointer; color: inherit; transition: border-color .2s ease, background .2s ease; }
  .section-card:hover { border-color: rgba(123,92,240,.7); background: rgba(123,92,240,.1); }
  .section-card:disabled { opacity: .45; cursor: not-allowed; }
  .section-glyph { color: var(--spectral-violet); display: block; font-size: 1.2rem; margin-bottom: .4rem; }
  .section-label { display: block; color: white; font-size: .8125rem; font-weight: 700; }
  .section-blurb { display: block; margin-top: .35rem; color: var(--ink-muted); font-size: .75rem; line-height: 1.35; }
  .showcase-nav { position: absolute; z-index: 2; bottom: 0; left: 0; right: 0; display: flex; align-items: center; gap: .875rem; padding: 1.25rem 1.5rem; background: linear-gradient(to top, rgba(3,3,3,.88), transparent); }
  .nav-dots { display: flex; gap: .375rem; }
  .nav-dot { all: unset; cursor: pointer; position: relative; width: 2rem; height: .1875rem; border-radius: 99px; background: rgba(255,255,255,.25); overflow: hidden; transition: width .4s var(--ease-out); }
  .nav-dot.active { width: 3rem; }.nav-dot:hover { background: rgba(255,255,255,.45); }
  .dot-fill { position: absolute; inset: 0; border-radius: inherit; background: var(--spectral-violet); transform-origin: left; transform: scaleX(0); }
  .nav-dot.active .dot-fill { animation: dot-progress linear forwards; }
  @keyframes dot-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  .nav-label { font-size: .6875rem; font-weight: 600; color: rgba(255,255,255,.78); letter-spacing: .04em; }
  @media (min-width: 640px) { .track, .slide { min-height: 31rem; }.preview-slide { min-height: 0; }.info-slide { padding: 2.5rem 2.5rem 5rem; }.showcase-nav { padding: 1.5rem 2rem; }.contents-grid, .section-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 480px) { .track, .slide { min-height: 33rem; }.preview-slide { min-height: 0; }.contents-grid, .section-grid { grid-template-columns: 1fr; }.content-card, .section-card { min-height: auto; } }
</style>
