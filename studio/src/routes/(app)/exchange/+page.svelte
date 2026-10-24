<script>
  import { goto, replaceState } from '$app/navigation';
  import { navigating, page as pageStore } from '$app/stores';
  import { onDestroy, onMount, tick } from 'svelte';
  import { appreciationPressedState, setAppreciationOptimistically } from '$lib/domain/appreciation.js';

  export let data;

  let searchValue = data.query ?? '';
  let appreciated = {};
  let feedback = {};
  let pending = {};
  let artworkFailed = {};
  let appreciationCounts = {};
  let drawerOpen = false;
  let marketLoading = false;
  let marketLoaded = false;
  let marketError = '';
  let listings = [];
  let marketPanel;
  let marketCloseButton;
  let handleButton;
  let searchTimer;
  let feedbackTimers = {};
  let analyticsTimer;
  let impressionTimer;
  let analyticsQueue = [];
  let impressionQueue = new Set();
  let viewedListings = new Set();
  let recordedImpressions = new Set();
  let returnFocusElement = null;
  let priorBodyOverflow = '';
  let priorHeaderInert = false;
  let isNavigatingExchange = false;

  $: items = data.items ?? [];
  $: isNavigatingExchange = Boolean($navigating?.to?.url?.pathname === '/exchange');
  $: if (data.query !== undefined && !isNavigatingExchange && data.query !== searchValue) searchValue = data.query ?? '';

  $: if (data.items) {
    const next = { ...appreciated };
    for (const item of data.items) {
      if (!(item.id in next)) next[item.id] = data.appreciatedReleaseIds?.includes(item.id) ?? false;
    }
    appreciated = next;
  }

  $: if (data.items) {
    const next = { ...appreciationCounts };
    for (const item of data.items) {
      if (!(item.id in next)) next[item.id] = item.appreciation_count;
    }
    appreciationCounts = next;
  }

  // Keep reactive updates explicit for Svelte's legacy component mode.
  function setAppreciated(id, value) { appreciated = { ...appreciated, [id]: value }; }
  function setFeedback(id, value) { feedback = { ...feedback, [id]: value }; }
  function setPending(id, value) { pending = { ...pending, [id]: value }; }
  function setCount(id, value) { appreciationCounts = { ...appreciationCounts, [id]: value }; }

  function flashFeedback(id, message, kind = 'success') {
    setFeedback(id, { message, kind });
    clearTimeout(feedbackTimers[id]);
    feedbackTimers[id] = setTimeout(() => setFeedback(id, null), kind === 'error' ? 6000 : 2800);
  }

  async function appreciate(item) {
    const previous = Boolean(appreciated[item.id]);
    if (!data.signedIn) {
      flashFeedback(item.id, 'Sign in to appreciate this release.', 'signin');
      return;
    }
    if (pending[item.id]) return;

    setPending(item.id, true);
    const result = await setAppreciationOptimistically({
      current: previous,
      onState: (value) => setAppreciated(item.id, value),
      send: async (desired) => {
        const response = await fetch('/exchange/appreciations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ release_id: item.id, appreciated: desired }),
        });
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) throw new Error('Sign in to appreciate this release.');
        if (!response.ok) throw new Error(body.message || 'Appreciation could not be saved. Please try again.');
        if (Number.isFinite(body.appreciation_count)) setCount(item.id, body.appreciation_count);
        trackAnalytics(desired ? 'appreciation_added' : 'appreciation_removed', item.id);
        flashFeedback(item.id, body.message || (desired ? 'Appreciation recorded' : 'Appreciation removed'));
        return body.appreciated;
      },
    });

    if (!result.ok) {
      const message = result.error?.message || 'Appreciation could not be saved. Please try again.';
      flashFeedback(item.id, message, message.toLowerCase().includes('sign in') ? 'signin' : 'error');
    }
    setPending(item.id, false);
  }

  function searchUrl(value, page = 1) {
    const next = currentPageUrl();
    const normalized = String(value ?? '').trim();
    if (normalized) next.searchParams.set('q', normalized);
    else next.searchParams.delete('q');
    if (page > 1) next.searchParams.set('page', String(page));
    else next.searchParams.delete('page');
    return `${next.pathname}${next.search}`;
  }

  function scheduleSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const normalized = searchValue.trim();
      if (normalized !== (data.query ?? '')) {
        trackAnalytics('search_performed');
        void goto(searchUrl(normalized), { replaceState: true, keepFocus: true, noScroll: true });
      }
    }, 320);
  }

  function submitSearch(event) {
    event.preventDefault();
    clearTimeout(searchTimer);
    trackAnalytics('search_performed');
    void goto(searchUrl(searchValue), { keepFocus: true, noScroll: true });
  }

  function clearSearch() {
    searchValue = '';
    clearTimeout(searchTimer);
    void goto(searchUrl(''), { keepFocus: true, noScroll: true });
  }

  function currentPageUrl() {
    return typeof window === 'undefined' ? new URL($pageStore.url) : new URL(window.location.href);
  }

  function getLoginUrl() {
    const url = currentPageUrl();
    return `/auth/login?next=${encodeURIComponent(url.pathname + url.search)}`;
  }

  function syncDrawerFromLocation() {
    const wantsOpen = new URL(window.location.href).searchParams.get('market') === 'open';
    if (wantsOpen !== drawerOpen) void setDrawer(wantsOpen, { updateUrl: false });
  }

  function trackAnalytics(event, releaseId = null) {
    analyticsQueue.push({ event, ...(releaseId ? { release_id: releaseId } : {}) });
    if (analyticsQueue.length >= 8) void flushAnalytics();
    else {
      clearTimeout(analyticsTimer);
      analyticsTimer = setTimeout(() => void flushAnalytics(), 1200);
    }
  }

  async function flushAnalytics() {
    if (!analyticsQueue.length) return;
    const batch = analyticsQueue.splice(0, 40);
    try {
      await fetch('/exchange/analytics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });
    } catch {
      // Analytics never blocks Exchange interactions.
    }
  }

  function persistImpression(id) {
    if (recordedImpressions.has(id)) return;
    recordedImpressions.add(id);
    impressionQueue.add(id);
    try {
      sessionStorage.setItem(`noizes.exchange.impressions.${data.rotationWindowId}`, JSON.stringify([...recordedImpressions]));
    } catch { /* Storage can be unavailable in private browsing. */ }
    if (impressionQueue.size >= 5) void flushImpressions();
    else {
      clearTimeout(impressionTimer);
      impressionTimer = setTimeout(() => void flushImpressions(), 1600);
    }
  }

  async function flushImpressions() {
    if (!impressionQueue.size) return;
    const ids = [...impressionQueue].slice(0, 20);
    ids.forEach((id) => impressionQueue.delete(id));
    try {
      await fetch('/exchange/impressions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ window_id: data.rotationWindowId, release_ids: ids }),
        keepalive: true,
      });
    } catch {
      // A missed impression is preferable to blocking or delaying discovery.
    }
  }

  function observeRelease(node, releaseId) {
    const key = `noizes.exchange.impressions.${data.rotationWindowId}`;
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || '[]');
      if (Array.isArray(saved)) saved.forEach((id) => recordedImpressions.add(id));
    } catch { /* Storage can be unavailable in private browsing. */ }

    let timer;
    const observer = new IntersectionObserver(([entry]) => {
      clearTimeout(timer);
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        timer = setTimeout(() => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) persistImpression(releaseId);
        }, 1000);
      }
    }, { threshold: [0, 0.5, 1] });
    observer.observe(node);
    return { destroy() { clearTimeout(timer); observer.disconnect(); } };
  }

  function observeMarketListing(node, releaseId) {
    let timer;
    const observer = new IntersectionObserver(([entry]) => {
      clearTimeout(timer);
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !viewedListings.has(releaseId)) {
        timer = setTimeout(() => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !viewedListings.has(releaseId)) {
            viewedListings.add(releaseId);
            trackAnalytics('collector_listing_viewed', releaseId);
          }
        }, 1000);
      }
    }, { threshold: [0, 0.5, 1] });
    observer.observe(node);
    return { destroy() { clearTimeout(timer); observer.disconnect(); } };
  }

  async function loadMarket() {
    if (marketLoading) return;
    marketLoading = true;
    marketError = '';
    try {
      const response = await fetch('/exchange/collector-market/listings', { headers: { accept: 'application/json' } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Collector Market could not be loaded just now.');
      listings = body.listings ?? [];
      marketLoaded = true;
      viewedListings = new Set();
    } catch (error) {
      marketError = error.message || 'Collector Market could not be loaded just now.';
    } finally {
      marketLoading = false;
    }
  }

  async function setDrawer(open, { updateUrl = true } = {}) {
    if (open === drawerOpen) {
      if (open && !marketLoaded && !marketLoading) void loadMarket();
      return;
    }

    if (open) {
      returnFocusElement = document.activeElement;
      priorBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const globalHeader = document.querySelector('header.sticky');
      priorHeaderInert = Boolean(globalHeader?.inert);
      if (globalHeader) globalHeader.inert = true;
      drawerOpen = true;
      trackAnalytics('collector_market_opened');
      await tick();
      marketCloseButton?.focus();
      void loadMarket();
    } else {
      drawerOpen = false;
      document.body.style.overflow = priorBodyOverflow;
      const globalHeader = document.querySelector('header.sticky');
      if (globalHeader) globalHeader.inert = priorHeaderInert;
      trackAnalytics('collector_market_closed');
      setTimeout(() => {
        if (returnFocusElement?.isConnected) returnFocusElement.focus();
        else handleButton?.focus();
      }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 30 : 370);
    }

    if (updateUrl) {
      const next = currentPageUrl();
      if (open) next.searchParams.set('market', 'open');
      else next.searchParams.delete('market');
      replaceState(`${next.pathname}${next.search}`, $pageStore.state);
    }
  }

  function handleWindowKeydown(event) {
    if (!drawerOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      void setDrawer(false);
      return;
    }
    if (event.key !== 'Tab' || !marketPanel) return;
    const focusable = [...marketPanel.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hasAttribute('inert') && element.offsetParent !== null);
    if (!focusable.length) {
      event.preventDefault();
      marketPanel.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function marketPrice(item) {
    if (item.asking_price == null) return 'Offers open';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency', currency: item.currency || 'KES', maximumFractionDigits: 0,
    }).format(Number(item.asking_price));
  }

  function copyLabel(item) {
    if (item.edition_number == null) return 'Copy number unavailable';
    const serial = String(item.edition_number).padStart(2, '0');
    return item.edition_size ? `Copy ${serial}/${item.edition_size}` : `Copy ${serial}`;
  }

  function pageHref(nextPage) {
    const next = currentPageUrl();
    if (nextPage > 1) next.searchParams.set('page', String(nextPage));
    else next.searchParams.delete('page');
    return `${next.pathname}${next.search}`;
  }

  onMount(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(`noizes.exchange.impressions.${data.rotationWindowId}`) || '[]');
      if (Array.isArray(saved)) saved.forEach((id) => recordedImpressions.add(id));
    } catch { /* Storage can be unavailable in private browsing. */ }
    trackAnalytics('exchange_viewed');
    const rotationKey = `noizes.exchange.rotation.${data.rotationWindowId}`;
    try {
      if (!sessionStorage.getItem(rotationKey)) {
        sessionStorage.setItem(rotationKey, '1');
        trackAnalytics('rotation_window_viewed');
      }
    } catch { trackAnalytics('rotation_window_viewed'); }
    if (data.openMarket) void setDrawer(true, { updateUrl: false });
    return () => {};
  });

  onDestroy(() => {
    clearTimeout(searchTimer);
    clearTimeout(analyticsTimer);
    clearTimeout(impressionTimer);
    Object.values(feedbackTimers).forEach(clearTimeout);
    void flushAnalytics();
    void flushImpressions();
    if (typeof document !== 'undefined' && drawerOpen) {
      document.body.style.overflow = priorBodyOverflow;
      const globalHeader = document.querySelector('header.sticky');
      if (globalHeader) globalHeader.inert = priorHeaderInert;
    }
  });
</script>

<svelte:head>
  <title>Noizes Exchange — Discover cultural objects</title>
  <meta name="description" content="Collect music as complete cultural objects on the Noizes Exchange." />
</svelte:head>

<svelte:window on:keydown={handleWindowKeydown} on:popstate={syncDrawerFromLocation} />

<main class="exchange-page" aria-hidden={drawerOpen ? 'true' : undefined} inert={drawerOpen}>
  <header class="exchange-heading">
    <div class="heading-copy">
      <h1>Exchange</h1>
      <p>Collect music as complete cultural objects.</p>
    </div>
    <form class="search" role="search" action="/exchange" on:submit={submitSearch}>
      <label class="sr-only" for="exchange-search">Search releases, artists and editions</label>
      <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.6" /><path d="m16 16 4.2 4.2" /></svg>
      <input
        id="exchange-search"
        name="q"
        bind:value={searchValue}
        on:input={scheduleSearch}
        placeholder="Search releases, artists and editions"
        autocomplete="off"
      />
      {#if searchValue}
        <button class="clear-search" type="button" aria-label="Clear search" on:click={clearSearch}>×</button>
      {/if}
    </form>
    <button
      bind:this={handleButton}
      class="market-handle"
      type="button"
      aria-label="Open Collector Market"
      aria-haspopup="dialog"
      aria-expanded={drawerOpen}
      on:click={() => setDrawer(true)}
    >
      <span>Collector Market</span>
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" /></svg>
    </button>
  </header>

  {#if data.loadError}
    <div class="notice" role="alert">
      <span>{data.loadError.message}</span>
      <a href={$pageStore.url.pathname + $pageStore.url.search}>Try again</a>
    </div>
  {:else}
    {#if data.rotationStale}
      <p class="stale-note" role="status">Showing the saved Exchange Rotation. Some new activity may take a moment to appear.</p>
    {/if}

    <section class="release-list" aria-label={data.query ? 'Search results' : 'Exchange releases'} aria-busy={isNavigatingExchange}>
      {#if isNavigatingExchange}
        {#each [1, 2, 3] as skeleton}
          <div class="release-row skeleton-row" aria-hidden="true">
            <div class="skeleton-vote"><i></i><b></b></div><div class="skeleton-art"></div>
            <div class="skeleton-copy"><i></i><i></i><i></i><b></b></div><div class="skeleton-action"></div>
          </div>
        {/each}
      {:else if items.length}
        {#each items as item (item.id)}
          <article class="release-row" use:observeRelease={item.id}>
            <div class="appreciation-column">
      <button
                class:appreciated={appreciated[item.id]}
                class:pending={pending[item.id]}
                class="appreciation-button"
                type="button"
                title="Appreciate this release"
                aria-label={appreciated[item.id] ? 'Remove appreciation' : 'Appreciate this release'}
                aria-describedby="appreciation-help"
                aria-pressed={appreciationPressedState(appreciated[item.id])}
                aria-busy={Boolean(pending[item.id])}
                disabled={Boolean(pending[item.id])}
                on:click={() => appreciate(item)}
              >
                <svg aria-hidden="true" viewBox="0 0 32 32">
                  <path d="M16 3.5 18.9 13l9.6 3-9.6 2.9-2.9 9.6-3-9.6-9.5-2.9 9.5-3L16 3.5Z" />
                  <path d="m25.2 3 .9 3.2 3.2.9-3.2.9-.9 3.2-.9-3.2-3.2-.9 3.2-.9.9-3.2Z" />
                </svg>
              </button>
              {#if item.appreciation_count !== null}
                <span class="appreciation-count" aria-hidden="true">{appreciationCounts[item.id] ?? item.appreciation_count}</span>
                <span class="sr-only">{appreciationCounts[item.id] ?? item.appreciation_count} appreciations</span>
                <span class="appreciation-label" aria-hidden="true">appreciations</span>
              {:else}
                <span class="count-unavailable">Count unavailable</span>
              {/if}
              {#if feedback[item.id]}
                <p class:feedback-error={feedback[item.id].kind === 'error'} class="row-feedback" role="status">
                  {#if feedback[item.id].kind === 'signin'}
                    <a href={getLoginUrl()}>Sign in to appreciate</a>
                  {:else}
                    {feedback[item.id].message}
                  {/if}
                </p>
              {/if}
            </div>

            <a class="cover-link" href={`/drop/${item.artist_slug}/${item.slug}`} on:click={() => { if (data.query) trackAnalytics('search_result_opened', item.id); trackAnalytics('release_explored', item.id); }} aria-label={`Explore ${item.title} by ${item.artist_name}`}>
              {#if item.cover_url && !artworkFailed[item.id]}
                <img
                  src={item.cover_url}
                  alt={`${item.title} artwork`}
                  width="154"
                  height="154"
                  loading="lazy"
                  decoding="async"
                  on:error={() => { artworkFailed = { ...artworkFailed, [item.id]: true }; }}
                />
              {:else}
                <span class="art-placeholder" aria-hidden="true">NOIZES</span>
              {/if}
            </a>

            <div class="release-copy">
              <h2><a href={`/drop/${item.artist_slug}/${item.slug}`} on:click={() => { if (data.query) trackAnalytics('search_result_opened', item.id); trackAnalytics('release_explored', item.id); }}>{item.title}</a></h2>
              <p class="artist-name">{item.artist_name}</p>
              <p class="description">{item.short_description}</p>
              <p class="edition-summary">{item.edition_summary}</p>
            </div>

            <a class="explore-link" href={`/drop/${item.artist_slug}/${item.slug}`} on:click={() => { if (data.query) trackAnalytics('search_result_opened', item.id); trackAnalytics('release_explored', item.id); }}>
              <span>Explore</span>
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>
            </a>
          </article>
        {/each}
      {:else if data.query}
        <div class="empty-state">
          <h2>No releases found</h2>
          <p>Try another release, artist or edition name.</p>
          <button type="button" on:click={clearSearch}>Clear search</button>
        </div>
      {:else}
        <div class="empty-state">
          <h2>No releases are available yet</h2>
          <p>Published public releases will appear here as complete cultural objects.</p>
        </div>
      {/if}
    </section>

    {#if !isNavigatingExchange && data.pages > 1}
      <nav class="pagination" aria-label="Exchange pages">
        {#if data.page > 1}<a href={pageHref(data.page - 1)} aria-label="Previous page">← Previous</a>{:else}<span></span>{/if}
        <span>Page {data.page} of {data.pages}</span>
        {#if data.page < data.pages}<a href={pageHref(data.page + 1)} aria-label="Next page">Next →</a>{:else}<span></span>{/if}
      </nav>
    {/if}
  {/if}

</main>

<button
  class:visible={drawerOpen}
  class="drawer-backdrop"
  type="button"
  aria-label="Close Collector Market"
  aria-hidden={!drawerOpen}
  disabled={!drawerOpen}
  tabindex={drawerOpen ? 0 : -1}
  on:click={() => setDrawer(false)}
></button>

<div
  bind:this={marketPanel}
  class:open={drawerOpen}
  class="market-drawer"
  role="dialog"
  aria-modal="true"
  aria-labelledby="collector-market-title"
  aria-hidden={!drawerOpen}
  inert={!drawerOpen}
  tabindex="-1"
>
  <div class="drawer-content">
    <header class="drawer-header">
      <div>
        <p class="drawer-kicker">Noizes Exchange</p>
        <h2 id="collector-market-title" tabindex="-1">Collector Market</h2>
        <p>Authenticated copies offered by their current custodians.</p>
      </div>
      <button bind:this={marketCloseButton} class="drawer-close" type="button" aria-label="Close Collector Market" on:click={() => setDrawer(false)}>
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </header>

    <div class="drawer-listings" aria-live="polite" aria-busy={marketLoading}>
      {#if marketLoading}
        <div class="market-skeleton-grid" aria-label="Loading Collector Market">
          {#each [1, 2, 3, 4] as skeleton}
            <div class="market-skeleton"><i></i><b></b><i></i><i></i></div>
          {/each}
        </div>
      {:else if marketError}
        <div class="drawer-empty drawer-error" role="alert">
          <p>{marketError}</p>
          <button type="button" on:click={loadMarket}>Try again</button>
        </div>
      {:else if listings.length}
        <div class="market-grid">
          {#each listings as item (item.id)}
            <article class="market-listing" use:observeMarketListing={item.release_id}>
              {#if item.cover_url}
                <img src={item.cover_url} alt={`${item.title} artwork`} width="280" height="280" loading="lazy" decoding="async" />
              {:else}
                <div class="market-art-placeholder" aria-hidden="true">NOIZES</div>
              {/if}
              <div class="listing-copy">
                <h3>{item.title}</h3>
                <p class="listing-artist">{item.artist_name}</p>
                <p class="copy-identity">{item.edition_name} <span>·</span> {copyLabel(item)}</p>
                <p class="listing-price">{marketPrice(item)}</p>
                <a href={item.href} on:click={() => trackAnalytics('collector_listing_viewed', item.release_id)}>
                  <span>View copy</span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>
                </a>
              </div>
            </article>
          {/each}
        </div>
      {:else}
        <div class="drawer-empty">
          <span class="empty-mark" aria-hidden="true">✧</span>
          <h3>No copies are listed right now</h3>
          <p>Check back as collectors offer authenticated copies from their editions.</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<span id="appreciation-help" class="sr-only">Appreciate this release. Activate again to remove your appreciation.</span>

<style>
  .exchange-page {
    position: relative;
    width: min(100%, 1640px);
    margin: 0 auto;
    padding: 26px clamp(50px, 6.1vw, 94px) 68px clamp(24px, 3.2vw, 54px);
    color: #f6f7fb;
  }

  .exchange-heading {
    display: grid;
    grid-template-columns: minmax(300px, 0.45fr) minmax(420px, 1fr);
    align-items: start;
    gap: clamp(28px, 4vw, 70px);
    margin-bottom: 14px;
  }

  .heading-copy h1 {
    margin: 0;
    color: #f7f7fa;
    font-size: clamp(2.7rem, 3.8vw, 3.25rem);
    font-weight: 850;
    line-height: 0.98;
    letter-spacing: -0.055em;
  }

  .heading-copy p {
    margin: 7px 0 0;
    color: #c9d8ee;
    font-size: clamp(0.98rem, 1.05vw, 1.05rem);
    letter-spacing: -0.01em;
  }

  .search {
    display: flex;
    align-items: center;
    min-width: 0;
    height: 58px;
    margin-top: 5px;
    padding: 0 16px;
    border: 1px solid #202839;
    border-radius: 10px;
    background: rgba(6, 10, 18, 0.84);
    color: #d8e4f4;
    transition: border-color 150ms ease, background-color 150ms ease;
  }

  .search:focus-within {
    border-color: rgba(123, 92, 240, 0.76);
    background: #070b14;
  }

  .search > svg {
    width: 22px;
    height: 22px;
    flex: 0 0 auto;
    fill: none;
    stroke: #e1e8f3;
    stroke-width: 1.7;
    margin-right: 14px;
  }

  .search input {
    flex: 1;
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: #f4f6fb;
    font: inherit;
    font-size: 0.96rem;
  }

  .search input::placeholder { color: #c2d1e9; opacity: 1; }
  .search input:focus-visible { outline: 0; }

  .clear-search {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    margin-left: 8px;
    border: 1px solid transparent;
    border-radius: 50%;
    background: transparent;
    color: #c9d5e7;
    font-size: 1.45rem;
    line-height: 1;
    cursor: pointer;
  }

  .clear-search:hover { border-color: var(--border-hover); color: white; }

  .release-list { border-top: 1px solid rgba(92, 113, 142, 0.27); }

  .release-row {
    position: relative;
    display: grid;
    grid-template-columns: 60px clamp(112px, 10vw, 154px) minmax(0, 1fr) 152px;
    align-items: center;
    gap: clamp(18px, 2.3vw, 32px);
    min-height: clamp(144px, 9.8vw, 150px);
    padding: 2px 0;
    border-bottom: 1px solid rgba(92, 113, 142, 0.25);
  }

  .appreciation-column {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    text-align: center;
  }

  .appreciation-button {
    display: grid;
    place-items: center;
    width: 56px;
    height: 48px;
    border: 1px solid #6f2cff;
    border-radius: 9px;
    background: rgba(45, 13, 112, 0.28);
    color: #b7caff;
    cursor: pointer;
    transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
  }

  .appreciation-button svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.8;
  }

  .appreciation-button:hover:not(:disabled),
  .appreciation-button:focus-visible {
    background: rgba(78, 29, 172, 0.52);
    border-color: #9a6aff;
    color: #edf1ff;
    transform: translateY(-1px);
  }

  .appreciation-button.appreciated {
    background: rgba(91, 32, 226, 0.35);
    border-color: #843cff;
    color: #a475ff;
  }

  .appreciation-button.appreciated svg path:first-child { fill: currentColor; }
  .appreciation-button.pending { animation: appreciation-pulse 680ms ease-in-out infinite alternate; }
  .appreciation-button:disabled { cursor: not-allowed; opacity: 0.68; }

  .appreciation-count {
    display: block;
    margin-top: 5px;
    color: #f4f5f9;
    font-size: 1.45rem;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .appreciation-label {
    color: #cbd9ee;
    font-size: 0.82rem;
    line-height: 1.15;
  }

  .count-unavailable {
    max-width: 64px;
    margin-top: 5px;
    color: #aab4c6;
    font-size: 0.66rem;
    line-height: 1.2;
  }

  .row-feedback {
    position: absolute;
    z-index: 1;
    width: max-content;
    max-width: 220px;
    margin: 0;
    padding: 6px 9px;
    border: 1px solid rgba(129, 101, 218, 0.38);
    border-radius: 7px;
    background: #11101a;
    color: #e3d9ff;
    font-size: 0.7rem;
    line-height: 1.35;
    transform: translateY(49px);
    text-align: left;
  }

  .row-feedback a { color: #c7aaff; text-decoration: underline; text-underline-offset: 2px; }
  .row-feedback.feedback-error { color: #ffd5d5; border-color: rgba(239, 95, 122, 0.5); }

  .cover-link {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    border: 1px solid rgba(126, 144, 170, 0.25);
    border-radius: 6px;
    background: #090d16;
  }

  .cover-link img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 260ms ease;
  }

  .cover-link:hover img { transform: scale(1.035); }

  .art-placeholder, .market-art-placeholder {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    background: radial-gradient(circle at 55% 42%, rgba(104, 63, 201, 0.26), transparent 42%), #0b101a;
    color: rgba(177, 144, 255, 0.76);
    font-size: clamp(0.85rem, 1.1vw, 1.05rem);
    font-weight: 900;
    letter-spacing: 0.09em;
  }

  .release-copy { min-width: 0; align-self: center; }
  .release-copy h2 { margin: 0; color: #f7f8fb; font-size: clamp(1.35rem, 1.9vw, 1.82rem); font-weight: 800; line-height: 1.05; letter-spacing: -0.035em; }
  .release-copy h2 a { color: inherit; text-decoration: none; }
  .release-copy h2 a:hover { color: #cbb8ff; }
  .artist-name { margin: 6px 0 0; color: #c3dcf5; font-size: 1rem; line-height: 1.2; }
  .description { max-width: 760px; margin: 4px 0 0; overflow: hidden; color: #bed0ec; font-size: 0.95rem; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }

  .edition-summary {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    margin: 8px 0 0;
    padding: 0 17px;
    border: 1px solid rgba(69, 90, 125, 0.24);
    border-radius: 11px;
    background: rgba(14, 21, 34, 0.82);
    color: #e2eafa;
    font-size: 0.76rem;
    line-height: 1.1;
  }

  .explore-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 39px;
    padding: 0 20px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: #4c0cf5;
    color: #fff;
    font-size: 0.9rem;
    font-weight: 600;
    text-align: center;
    text-decoration: none;
    transition: background 150ms ease, transform 150ms ease;
  }

  .explore-link svg, .market-listing a svg { width: 20px; height: 20px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .explore-link:hover { background: #672cff; transform: translateY(-1px); }

  .stale-note { margin: -5px 0 14px; color: #b9c5d7; font-size: 0.78rem; }
  .notice { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin: 26px 0; padding: 16px 18px; border: 1px solid rgba(200, 156, 73, 0.45); border-radius: 9px; background: rgba(36, 27, 13, 0.32); color: #f1dfba; }
  .notice a { flex: 0 0 auto; color: #d4bcff; text-decoration: underline; text-underline-offset: 3px; }

  .empty-state { display: grid; min-height: 230px; align-content: center; justify-items: center; padding: 36px 20px; border-bottom: 1px solid rgba(92, 113, 142, 0.25); text-align: center; }
  .empty-state h2 { margin: 0; color: #eff3fb; font-size: 1.35rem; letter-spacing: -0.025em; }
  .empty-state p { max-width: 440px; margin: 8px 0 0; color: #b3c0d3; font-size: 0.92rem; }
  .empty-state button { margin-top: 17px; padding: 8px 13px; border: 1px solid #51437c; border-radius: 7px; background: #151124; color: #e3d8ff; cursor: pointer; }

  .pagination { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; padding-top: 19px; color: #b9c7dd; font-size: 0.78rem; }
  .pagination a { width: fit-content; padding: 8px 11px; border: 1px solid var(--border-dim); border-radius: 7px; color: #e7eaf2; text-decoration: none; }
  .pagination a:last-child { justify-self: end; }
  .pagination > span:nth-child(2) { text-align: center; }

  .market-handle {
    position: fixed;
    z-index: 40;
    top: 68px;
    right: 0;
    display: flex;
    width: 57px;
    min-height: 204px;
    align-items: center;
    justify-content: center;
    gap: 13px;
    padding: 17px 9px;
    border: 1px solid rgba(112, 126, 156, 0.36);
    border-right: 0;
    border-radius: 28px 0 0 28px;
    background: rgba(12, 17, 30, 0.97);
    box-shadow: -8px 12px 34px rgba(0, 0, 0, 0.18);
    color: #eef1f7;
    cursor: pointer;
    transform: none;
    transition: background 170ms ease, border-color 170ms ease;
  }

  .market-handle::after { position: absolute; top: 0; right: 0; width: 5px; height: 100%; border-radius: 8px 0 0 8px; background: #6319ff; content: ''; }
  .market-handle > span { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 0.9rem; font-weight: 650; letter-spacing: 0.02em; }
  .market-handle svg { width: 18px; height: 18px; flex: 0 0 auto; fill: none; stroke: #e4e9f3; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .market-handle:hover, .market-handle:focus-visible { border-color: rgba(139, 108, 249, 0.8); background: #10172a; }

  .drawer-backdrop {
    position: fixed;
    z-index: 60;
    inset: 56px 0 0;
    border: 0;
    background: rgba(1, 3, 9, 0.68);
    opacity: 0;
    pointer-events: none;
    transition: opacity 260ms ease, visibility 0s linear 360ms;
    visibility: hidden;
    cursor: default;
  }

  .drawer-backdrop.visible { opacity: 1; pointer-events: auto; transition-delay: 0s; visibility: visible; }

  .market-drawer {
    position: fixed;
    z-index: 61;
    top: 56px;
    right: 0;
    display: flex;
    width: clamp(380px, 42vw, 680px);
    height: calc(100vh - 56px);
    height: calc(100dvh - 56px);
    flex-direction: column;
    overflow: hidden;
    border-left: 1px solid rgba(126, 141, 171, 0.22);
    background: #070a11;
    box-shadow: -20px 0 60px rgba(0, 0, 0, 0.4);
    color: #f3f5fa;
    transform: translate3d(100%, 0, 0);
    transition: transform 460ms cubic-bezier(0.22, 1, 0.36, 1), visibility 0s linear 460ms;
    visibility: hidden;
    outline: none;
  }

  .market-drawer.open { transform: translate3d(0, 0, 0); transition-delay: 0s; visibility: visible; }
  .market-drawer:not(.open) { transition-duration: 360ms, 0s; }
  .drawer-content { display: flex; min-height: 0; height: 100%; flex-direction: column; opacity: 0; transform: translate3d(10px, 0, 0); transition: opacity 280ms ease, transform 280ms cubic-bezier(0.22, 1, 0.36, 1); }
  .market-drawer.open .drawer-content { opacity: 1; transform: translate3d(0, 0, 0); transition-delay: 95ms; }

  .drawer-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: calc(27px + env(safe-area-inset-top)) 27px 22px; border-bottom: 1px solid rgba(91, 111, 143, 0.23); }
  .drawer-kicker { margin: 0 0 7px; color: #a887ff; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; }
  .drawer-header h2 { margin: 0; color: #f7f8fa; font-size: clamp(1.7rem, 2.7vw, 2.2rem); font-weight: 830; letter-spacing: -0.045em; line-height: 1; }
  .drawer-header p:last-child { margin: 8px 0 0; color: #b4c1d5; font-size: 0.84rem; line-height: 1.45; }
  .drawer-close { display: grid; width: 42px; height: 42px; flex: 0 0 auto; place-items: center; border: 1px solid rgba(137, 151, 177, 0.28); border-radius: 50%; background: rgba(255, 255, 255, 0.035); color: #e8edf6; cursor: pointer; }
  .drawer-close svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
  .drawer-close:hover { border-color: #8d6bff; background: rgba(109, 62, 228, 0.2); }

  .drawer-listings { min-height: 0; flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 21px 24px calc(24px + env(safe-area-inset-bottom)); }
  .market-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 17px; }
  .market-listing { min-width: 0; overflow: hidden; border: 1px solid rgba(109, 126, 155, 0.2); border-radius: 11px; background: #0d121c; }
  .market-listing > img, .market-art-placeholder { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; }
  .market-art-placeholder { font-size: 1.2rem; }
  .listing-copy { padding: 13px 13px 14px; }
  .listing-copy h3 { overflow: hidden; margin: 0; color: #f5f6f9; font-size: 1.02rem; font-weight: 760; line-height: 1.15; text-overflow: ellipsis; white-space: nowrap; }
  .listing-artist { overflow: hidden; margin: 4px 0 0; color: #bfd5ed; font-size: 0.78rem; text-overflow: ellipsis; white-space: nowrap; }
  .copy-identity { display: flex; gap: 5px; overflow: hidden; margin: 10px 0 0; color: #b6c3d6; font-size: 0.68rem; text-overflow: ellipsis; white-space: nowrap; }
  .copy-identity span { color: #8e9cb1; }
  .listing-price { min-height: 1.2em; margin: 7px 0 12px; color: #f0eaff; font-size: 0.9rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  .market-listing a { display: flex; min-height: 38px; align-items: center; justify-content: center; gap: 8px; border-radius: 7px; background: #4c0cf5; color: white; font-size: 0.78rem; font-weight: 650; text-decoration: none; }
  .market-listing a svg { width: 17px; height: 17px; }
  .market-listing a:hover { background: #672cff; }

  .drawer-empty { display: grid; min-height: 260px; align-content: center; justify-items: center; padding: 30px; color: #c0cad9; text-align: center; }
  .drawer-empty .empty-mark { color: #a981ff; font-size: 2.2rem; line-height: 1; }
  .drawer-empty h3 { margin: 13px 0 0; color: #f1f4f8; font-size: 1.14rem; }
  .drawer-empty p { max-width: 350px; margin: 7px 0 0; color: #abb8cb; font-size: 0.84rem; line-height: 1.5; }
  .drawer-empty button { margin-top: 15px; padding: 9px 14px; border: 1px solid #55428b; border-radius: 7px; background: #171125; color: #eee6ff; cursor: pointer; }
  .drawer-error { color: #f0cccc; }

  .market-skeleton-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 17px; }
  .market-skeleton { overflow: hidden; padding: 12px; border: 1px solid rgba(109, 126, 155, 0.18); border-radius: 11px; background: #0d121c; }
  .market-skeleton i, .market-skeleton b { display: block; border-radius: 5px; background: linear-gradient(90deg, #151c29 25%, #202a3d 50%, #151c29 75%); background-size: 200% 100%; animation: shimmer 1.4s ease infinite; }
  .market-skeleton i:first-child { aspect-ratio: 1; margin-bottom: 13px; }
  .market-skeleton b { width: 76%; height: 13px; margin: 7px 0; }
  .market-skeleton i:not(:first-child) { width: 62%; height: 9px; margin: 7px 0; }

  .skeleton-row { pointer-events: none; }
  .skeleton-vote, .skeleton-copy { display: grid; justify-items: center; gap: 8px; }
  .skeleton-vote i, .skeleton-art, .skeleton-copy i, .skeleton-copy b, .skeleton-action { display: block; border-radius: 7px; background: linear-gradient(90deg, #121a28 25%, #202b40 50%, #121a28 75%); background-size: 200% 100%; animation: shimmer 1.4s ease infinite; }
  .skeleton-vote i { width: 54px; height: 46px; }
  .skeleton-vote b { width: 42px; height: 13px; }
  .skeleton-art { width: 100%; aspect-ratio: 1; }
  .skeleton-copy { justify-items: start; width: 100%; }
  .skeleton-copy i:nth-child(1) { width: 45%; height: 18px; }
  .skeleton-copy i:nth-child(2) { width: 32%; height: 12px; }
  .skeleton-copy i:nth-child(3) { width: 68%; height: 11px; }
  .skeleton-copy b { width: 190px; max-width: 75%; height: 28px; }
  .skeleton-action { width: 100%; height: 38px; }

  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid #b494ff; outline-offset: 3px; }

  @keyframes shimmer { to { background-position: -200% 0; } }
  @keyframes appreciation-pulse { to { color: #f0e7ff; box-shadow: 0 0 18px rgba(123, 92, 240, 0.3); } }

  @media (max-width: 900px) {
    .exchange-heading { grid-template-columns: minmax(230px, 0.7fr) minmax(300px, 1fr); gap: 22px; }
    .release-row { grid-template-columns: 54px clamp(100px, 13vw, 126px) minmax(0, 1fr) 126px; gap: 17px; }
    .description { max-width: 500px; }
    .explore-link { gap: 6px; padding: 0 12px; }
  }

  @media (max-width: 700px) {
    .exchange-page { padding: 23px 15px 54px; }
    .exchange-heading { grid-template-columns: 1fr; gap: 18px; margin-bottom: 20px; }
    .search { margin-top: 0; }
    .heading-copy h1 { font-size: clamp(2.55rem, 10vw, 3.2rem); }
    .heading-copy p { margin-top: 6px; font-size: 0.96rem; }
    .search { height: 52px; }
    .search input { font-size: 0.87rem; }
    .release-list { padding-bottom: 68px; }
    .release-row { grid-template-columns: 43px 74px minmax(0, 1fr) 36px; gap: 10px; min-height: 112px; padding: 9px 0; }
    .appreciation-column { gap: 2px; }
    .appreciation-button { width: 41px; height: 39px; border-radius: 8px; }
    .appreciation-button svg { width: 21px; height: 21px; }
    .appreciation-count { margin-top: 3px; font-size: 1.1rem; }
    .appreciation-label { font-size: 0.59rem; }
    .cover-link { border-radius: 5px; }
    .release-copy h2 { overflow: hidden; font-size: clamp(1.03rem, 4.2vw, 1.28rem); text-overflow: ellipsis; white-space: nowrap; }
    .artist-name { overflow: hidden; margin-top: 4px; font-size: 0.82rem; text-overflow: ellipsis; white-space: nowrap; }
    .description { display: -webkit-box; margin-top: 4px; overflow: hidden; font-size: 0.75rem; line-height: 1.2; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 1; }
    .edition-summary { min-height: 25px; margin-top: 5px; padding: 0 8px; border-radius: 7px; font-size: 0.62rem; }
    .explore-link { width: 36px; min-height: 42px; padding: 0; border-radius: 8px; }
    .explore-link span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
    .explore-link svg { width: 20px; height: 20px; }
    .row-feedback { max-width: 180px; font-size: 0.63rem; transform: translateY(43px); }
    .market-handle { position: relative; z-index: auto; width: max-content; min-height: 44px; justify-self: end; flex-direction: row; gap: 8px; margin-top: -5px; padding: 0 13px; border: 1px solid rgba(112, 126, 156, 0.42); border-radius: 25px; box-shadow: 0 7px 24px rgba(0, 0, 0, 0.38); transform: none; }
    .market-handle::after { top: 8px; right: 0; width: 3px; height: 30px; }
    .market-handle > span { writing-mode: horizontal-tb; transform: none; font-size: 0.75rem; }
    .market-handle svg { width: 15px; height: 15px; order: -1; }
    .market-drawer { width: min(94vw, 460px); }
    .drawer-header { padding: calc(20px + env(safe-area-inset-top)) 18px 17px; }
    .drawer-header h2 { font-size: 1.65rem; }
    .drawer-header p:last-child { max-width: 290px; font-size: 0.78rem; }
    .drawer-close { width: 44px; height: 44px; }
    .drawer-listings { padding: 15px 14px calc(18px + env(safe-area-inset-bottom)); }
    .market-grid, .market-skeleton-grid { grid-template-columns: 1fr; gap: 12px; }
    .market-listing { display: grid; grid-template-columns: 106px minmax(0, 1fr); align-items: stretch; }
    .market-listing > img, .market-listing > .market-art-placeholder { height: 100%; min-height: 100%; aspect-ratio: auto; }
    .listing-copy { display: flex; min-width: 0; flex-direction: column; justify-content: center; padding: 10px 11px; }
    .listing-copy h3 { font-size: 0.93rem; }
    .listing-artist { font-size: 0.72rem; }
    .copy-identity { margin-top: 7px; font-size: 0.62rem; }
    .listing-price { margin: 5px 0 8px; font-size: 0.8rem; }
    .market-listing a { min-height: 34px; font-size: 0.72rem; }
    .market-skeleton { display: grid; grid-template-columns: 106px 1fr; gap: 0 12px; }
    .market-skeleton i:first-child { grid-row: 1 / span 4; margin-bottom: 0; }
    .market-skeleton b, .market-skeleton i:not(:first-child) { grid-column: 2; }
    .market-skeleton b { align-self: end; }
    .market-skeleton i:not(:first-child) { width: 80%; }
    .notice { align-items: flex-start; flex-direction: column; padding: 13px; font-size: 0.84rem; }
  }

  @media (max-width: 390px) {
    .exchange-page { padding-inline: 11px; }
    .release-row { grid-template-columns: 39px 66px minmax(0, 1fr) 32px; gap: 8px; }
    .appreciation-button { width: 38px; height: 37px; }
    .appreciation-label { font-size: 0.54rem; }
    .edition-summary { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .explore-link { width: 32px; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 120ms !important; transition-delay: 0ms !important; }
    .market-drawer, .market-drawer:not(.open) { transform: none; }
    .drawer-content { transform: none; }
  }
</style>
