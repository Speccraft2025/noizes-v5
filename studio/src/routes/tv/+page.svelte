<script>
  import { onMount, onDestroy } from 'svelte';

  export let data;
  $: releases = data.releases ?? [];

  const colors = ['#7B5CF0', '#4B6BF0', '#F04BD8', '#7B5CF0', '#4B6BF0', '#F04BD8'];

  let selected = null;
  let focusedIndex = 0;
  let gridEl;
  let clock = '';
  let clockTimer;

  function updateClock() {
    const now = new Date();
    clock = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatType(value) {
    return String(value || 'release').replaceAll('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  function duration(ms) {
    const m = Math.floor((Number(ms) || 0) / 60000);
    const s = Math.floor(((Number(ms) || 0) % 60000) / 1000);
    return m ? `${m}:${String(s).padStart(2, '0')}` : '';
  }

  function totalDuration(ms) {
    const minutes = Math.round((Number(ms) || 0) / 60000);
    return minutes ? `${minutes} min` : '';
  }

  function experienceHref(release) {
    return release.artist_slug && release.slug
      ? `/experience/${release.artist_slug}/${release.slug}`
      : null;
  }

  function dropHref(release) {
    return release.artist_slug && release.slug
      ? `/drop/${release.artist_slug}/${release.slug}`
      : null;
  }

  function selectRelease(release) {
    selected = release;
  }

  function closeDetail() {
    selected = null;
    requestAnimationFrame(() => {
      const cards = gridEl?.querySelectorAll('.tv-card');
      cards?.[focusedIndex]?.focus();
    });
  }

  function handleKeydown(e) {
    if (selected) {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack') {
        e.preventDefault();
        closeDetail();
      }
      return;
    }

    const cols = getColumns();
    const total = releases.length;
    if (!total) return;

    let next = focusedIndex;

    if (e.key === 'ArrowRight') next = Math.min(focusedIndex + 1, total - 1);
    else if (e.key === 'ArrowLeft') next = Math.max(focusedIndex - 1, 0);
    else if (e.key === 'ArrowDown') next = Math.min(focusedIndex + cols, total - 1);
    else if (e.key === 'ArrowUp') next = Math.max(focusedIndex - cols, 0);
    else return;

    e.preventDefault();
    focusedIndex = next;
    const cards = gridEl?.querySelectorAll('.tv-card');
    cards?.[focusedIndex]?.focus();
  }

  function getColumns() {
    if (!gridEl) return 4;
    const style = getComputedStyle(gridEl);
    const cols = style.getPropertyValue('grid-template-columns').split(' ').length;
    return cols || 4;
  }

  onMount(() => {
    updateClock();
    clockTimer = setInterval(updateClock, 30000);
    document.addEventListener('keydown', handleKeydown);
    requestAnimationFrame(() => {
      gridEl?.querySelector('.tv-card')?.focus();
    });
  });

  onDestroy(() => {
    clearInterval(clockTimer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', handleKeydown);
    }
  });
</script>

<svelte:head>
  <title>Noizes TV</title>
  <meta name="viewport" content="width=1920" />
</svelte:head>

<div class="tv-shell">
  <!-- Top bar -->
  <header class="tv-header">
    <div class="tv-logo">
      <span class="tv-logo-n">N</span>
      <span class="tv-logo-text">NOIZES</span>
    </div>
    <div class="tv-header-right">
      <span class="tv-clock">{clock}</span>
    </div>
  </header>

  {#if releases.length === 0}
    <div class="tv-empty">
      <p class="tv-empty-title">No releases yet</p>
      <p class="tv-empty-sub">The first releases are being compiled.</p>
    </div>
  {:else}
    <!-- Gallery grid -->
    <div class="tv-grid" bind:this={gridEl}>
      {#each releases as release, i}
        {@const color = colors[i % colors.length]}
        <button
          class="tv-card"
          style="--card-accent: {color};"
          on:click={() => { focusedIndex = i; selectRelease(release); }}
          tabindex={i === 0 ? 0 : -1}
        >
          <div class="tv-card-art">
            {#if release.cover_url}
              <img src={release.cover_url} alt="" loading="lazy" />
            {:else}
              <div class="tv-card-initial" style="color: {color};">
                {release.artist_name[0]}
              </div>
            {/if}
          </div>
          <div class="tv-card-info">
            <p class="tv-card-artist" style="color: {color};">{release.artist_name}</p>
            <p class="tv-card-title">{release.title}</p>
            <p class="tv-card-meta">
              {formatType(release.release_type)} · {release.track_count || 1} track{release.track_count === 1 ? '' : 's'}
            </p>
          </div>
        </button>
      {/each}
    </div>
  {/if}

  <!-- Detail overlay -->
  {#if selected}
    {@const color = colors[releases.indexOf(selected) % colors.length]}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="tv-overlay" on:click={closeDetail}>
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="tv-detail" on:click|stopPropagation>
        <div class="tv-detail-art">
          {#if selected.cover_url}
            <img src={selected.cover_url} alt="{selected.title} artwork" />
          {:else}
            <div class="tv-detail-initial" style="color: {color};">
              {selected.artist_name[0]}
            </div>
          {/if}
        </div>

        <div class="tv-detail-body">
          <p class="tv-detail-artist" style="color: {color};">{selected.artist_name}</p>
          <h2 class="tv-detail-title">{selected.title}</h2>
          <p class="tv-detail-meta">
            {formatType(selected.release_type)}
            {#if selected.genre} · {selected.genre}{/if}
            {#if selected.year} · {selected.year}{/if}
            {#if totalDuration(selected.total_duration_ms)} · {totalDuration(selected.total_duration_ms)}{/if}
          </p>
          <p class="tv-detail-edition">
            {selected.edition_name || selected.edition_type || 'Standard'}
            {#if selected.edition_size} · {selected.edition_size - (selected.acquired_count ?? 0)}/{selected.edition_size} remaining{/if}
          </p>

          {#if selected.tracks?.length}
            <div class="tv-tracklist">
              {#each selected.tracks as track, ti}
                <div class="tv-track">
                  <span class="tv-track-num" style="color: {color};">{String(ti + 1).padStart(2, '0')}</span>
                  <span class="tv-track-title">{track.title}</span>
                  {#if track.featured_artists?.length}
                    <span class="tv-track-feat">ft. {track.featured_artists.join(', ')}</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <div class="tv-detail-actions">
            {#if experienceHref(selected)}
              <a href={experienceHref(selected)} class="tv-btn-primary">
                Open Experience
              </a>
            {/if}
            {#if dropHref(selected)}
              <a href={dropHref(selected)} class="tv-btn-secondary">
                View Drop
              </a>
            {/if}
            <button class="tv-btn-secondary" on:click={closeDetail}>Back</button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Navigation hint -->
  <footer class="tv-footer">
    <span class="tv-hint">Use arrow keys to navigate · Press Enter to select · Press Back to return</span>
  </footer>
</div>

<style>
  :global(body) {
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .tv-shell {
    position: fixed;
    inset: 0;
    background: #030303;
    display: flex;
    flex-direction: column;
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  /* Header */
  .tv-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 28px 48px 20px;
    flex-shrink: 0;
  }

  .tv-logo {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .tv-logo-n {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: linear-gradient(135deg, #7B5CF0, #4B6BF0);
    color: #fff;
    font-size: 24px;
    font-weight: 900;
    letter-spacing: -0.02em;
  }

  .tv-logo-text {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 0.2em;
    color: rgba(255, 255, 255, 0.7);
  }

  .tv-header-right {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .tv-clock {
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    font-variant-numeric: tabular-nums;
  }

  /* Grid */
  .tv-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
    padding: 8px 48px 20px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
  }
  .tv-grid::-webkit-scrollbar { display: none; }

  @media (min-width: 1600px) {
    .tv-grid { grid-template-columns: repeat(5, 1fr); }
  }
  @media (max-width: 1200px) {
    .tv-grid { grid-template-columns: repeat(3, 1fr); }
  }

  /* Card */
  .tv-card {
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid transparent;
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    outline: none;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
                border-color 0.25s ease,
                box-shadow 0.25s ease;
    text-align: left;
    padding: 0;
    color: inherit;
    font: inherit;
  }

  .tv-card:focus-visible,
  .tv-card:focus {
    transform: scale(1.05);
    border-color: var(--card-accent);
    box-shadow:
      0 0 0 3px rgba(123, 92, 240, 0.3),
      0 20px 60px rgba(0, 0, 0, 0.5);
    z-index: 10;
  }

  .tv-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .tv-card-art {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    background: #0a0a0a;
    overflow: hidden;
  }

  .tv-card-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .tv-card-initial {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 72px;
    font-weight: 900;
    opacity: 0.15;
  }

  .tv-card-info {
    padding: 16px 18px 18px;
  }

  .tv-card-artist {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin: 0 0 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tv-card-title {
    font-size: 18px;
    font-weight: 900;
    color: #f5f5f7;
    margin: 0 0 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  .tv-card-meta {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    margin: 0;
  }

  /* Empty state */
  .tv-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }
  .tv-empty-title {
    font-size: 28px;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.5);
  }
  .tv-empty-sub {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.3);
  }

  /* Detail overlay */
  .tv-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .tv-detail {
    display: flex;
    gap: 48px;
    max-width: 1200px;
    width: 90%;
    max-height: 80vh;
  }

  .tv-detail-art {
    flex-shrink: 0;
    width: 420px;
    height: 420px;
    border-radius: 16px;
    overflow: hidden;
    background: #0a0a0a;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .tv-detail-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .tv-detail-initial {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 120px;
    font-weight: 900;
    opacity: 0.15;
  }

  .tv-detail-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .tv-detail-artist {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin: 0 0 8px;
  }

  .tv-detail-title {
    font-size: 42px;
    font-weight: 900;
    color: #f5f5f7;
    margin: 0 0 12px;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }

  .tv-detail-meta {
    font-size: 15px;
    color: rgba(255, 255, 255, 0.5);
    margin: 0 0 4px;
  }

  .tv-detail-edition {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.35);
    margin: 0 0 28px;
  }

  /* Tracklist */
  .tv-tracklist {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 32px;
    max-height: 220px;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .tv-tracklist::-webkit-scrollbar { display: none; }

  .tv-track {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 14px;
    border-radius: 8px;
    transition: background 0.15s;
  }
  .tv-track:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .tv-track-num {
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    width: 24px;
  }

  .tv-track-title {
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tv-track-feat {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.35);
    flex-shrink: 0;
  }

  /* Action buttons */
  .tv-detail-actions {
    display: flex;
    gap: 14px;
  }

  .tv-btn-primary {
    display: inline-flex;
    align-items: center;
    padding: 14px 32px;
    background: linear-gradient(135deg, #7B5CF0, #4B6BF0);
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    border: none;
    border-radius: 99px;
    cursor: pointer;
    text-decoration: none;
    transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 0 24px rgba(123, 92, 240, 0.35);
  }
  .tv-btn-primary:focus-visible,
  .tv-btn-primary:focus {
    outline: 3px solid rgba(123, 92, 240, 0.6);
    outline-offset: 3px;
    transform: scale(1.03);
  }

  .tv-btn-secondary {
    display: inline-flex;
    align-items: center;
    padding: 14px 28px;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    font-size: 15px;
    font-weight: 600;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 99px;
    cursor: pointer;
    text-decoration: none;
    transition: border-color 0.2s, color 0.2s, transform 0.2s;
  }
  .tv-btn-secondary:focus-visible,
  .tv-btn-secondary:focus {
    border-color: rgba(123, 92, 240, 0.6);
    color: #fff;
    outline: none;
    transform: scale(1.03);
  }

  /* Footer hint */
  .tv-footer {
    flex-shrink: 0;
    padding: 12px 48px 20px;
    text-align: center;
  }

  .tv-hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.2);
    letter-spacing: 0.05em;
  }
</style>
