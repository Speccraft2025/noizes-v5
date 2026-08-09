<script>
  import { goto } from '$app/navigation';

  export let data;
  $: ({ featured, feed, resale } = data);
  // Set when the catalogue could not be read. An empty shelf and a broken
  // query are different things and must not look the same.
  $: loadError = data.loadError ?? null;

  import { onMount, onDestroy } from 'svelte';

  const colors = ['#7B5CF0', '#4B6BF0', '#F04BD8', '#7B5CF0', '#4B6BF0', '#F04BD8'];

  let carouselEl;
  let autoScrollTimer;
  let paused = false;

  function startAutoScroll() {
    stopAutoScroll();
    autoScrollTimer = setInterval(() => {
      if (paused || !carouselEl) return;
      const { scrollLeft, scrollWidth, clientWidth } = carouselEl;
      const maxScroll = scrollWidth - clientWidth;
      if (maxScroll <= 0) return;
      const cardWidth = carouselEl.querySelector('.store-card')?.offsetWidth ?? clientWidth;
      const gap = 16;
      const step = cardWidth + gap;
      const next = scrollLeft + step;
      carouselEl.scrollTo({ left: next > maxScroll ? 0 : next, behavior: 'smooth' });
    }, 5000);
  }

  function stopAutoScroll() {
    if (autoScrollTimer) clearInterval(autoScrollTimer);
  }

  onMount(() => { if (featured.length > 0) startAutoScroll(); });
  onDestroy(stopAutoScroll);

  let acquiring = null; // release id with a checkout in flight
  let soldOut = {};     // release ids learned sold-out from a 409
  let acquireError = null;
  let offerDrafts = {};
  let offering = null;
  let offerMessage = '';

  async function placeOffer(item) {
    if (!data.user) return goto(`/auth/login?next=${encodeURIComponent('/exchange')}`);
    const amount = Number(offerDrafts[item.acquisition_id]);
    if (!Number.isFinite(amount) || amount <= 0) {
      offerMessage = 'Enter a valid offer amount.';
      return;
    }
    offering = item.acquisition_id;
    offerMessage = '';
    try {
      const res = await fetch('/exchange/offers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ acquisition_id: item.acquisition_id, amount }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Could not place offer.');
      offerMessage = `Offer placed on ${item.artist_name} — ${item.title}.`;
      offerDrafts = { ...offerDrafts, [item.acquisition_id]: '' };
    } catch (e) {
      offerMessage = e.message;
    } finally {
      offering = null;
    }
  }

  async function acquire(r) {
    if (!data.user) {
      return goto(`/auth/login?next=${encodeURIComponent('/exchange')}`);
    }
    acquiring = r.id;
    acquireError = null;
    try {
      const res = await fetch('/exchange/acquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ release_id: r.id }),
      });
      if (res.status === 409) {
        soldOut = { ...soldOut, [r.id]: true };
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        acquireError = body?.message || 'Could not start checkout — try again.';
        return;
      }
      const { authorization_url } = await res.json();
      window.location.href = authorization_url;
    } catch {
      acquireError = 'Could not start checkout — try again.';
    } finally {
      acquiring = null;
    }
  }

  function isSoldOut(r) {
    return soldOut[r.id] || available(r) === 0;
  }

  function fmt(price, currency) {
    if (currency === 'KES') return `KES ${Number(price).toLocaleString()}`;
    if (currency === 'USD') return `$${price}`;
    if (currency === 'EUR') return `€${price}`;
    return `${currency} ${price}`;
  }

  function available(r) {
    if (!r.edition_size) return null;
    return r.edition_size - (r.acquired_count ?? 0);
  }

  function formatType(value) {
    return String(value || 'release').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function duration(ms) {
    const minutes = Math.round((Number(ms) || 0) / 60000);
    return minutes ? `${minutes} min` : '';
  }

  // Every card leads to the release's Drop Page — its permanent public
  // address, and the thing people share. Releases published before Drop Pages
  // existed are backfilled by the migration; the fallback keeps a card
  // clickable rather than dead if one is ever missing.
  function dropHref(release) {
    return release.artist_slug && release.slug
      ? `/drop/${release.artist_slug}/${release.slug}`
      : null;
  }
</script>

<div class="max-w-7xl mx-auto px-6 py-8">
  <!-- Header -->
  <div class="mb-10">
    <p class="t-caption mb-2">Discover</p>
    <h1 class="t-monumental-small text-white mb-2">Exchange</h1>
    <p class="text-base" style="color: var(--ink-muted);">Browse and acquire cultural objects from artists worldwide.</p>
  </div>

  {#if acquireError}
    <div class="glass rounded-xl px-4 py-3 mb-6 text-sm" style="border-color: #F04BD850; color: var(--ink-secondary);">
      {acquireError}
    </div>
  {/if}
  {#if offerMessage}
    <div class="glass rounded-xl px-4 py-3 mb-6 text-sm text-white" aria-live="polite">{offerMessage}</div>
  {/if}

  {#if resale?.length}
    <section class="mb-10" aria-labelledby="secondary-market-heading">
      <p class="t-caption mb-2">Secondary market</p>
      <h2 id="secondary-market-heading" class="text-2xl font-black text-white mb-4">Editions accepting offers</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        {#each resale as item, i}
          {@const color = colors[i % colors.length]}
          <article class="glass rounded-xl p-5">
            <p class="text-xs font-bold uppercase tracking-widest" style="color: {color};">{item.artist_name}</p>
            <h3 class="text-lg font-black text-white">
              {#if item.drop_path}
                <a href={item.drop_path} class="hover:underline">{item.title}</a>
              {:else}
                {item.title}
              {/if}
            </h3>
            <p class="text-xs mt-1 mb-4" style="color: var(--ink-muted);">
              {formatType(item.release_type)} · {item.track_count || 1} track{item.track_count === 1 ? '' : 's'} · {item.edition_name || item.edition_type}{item.edition_number ? ` #${item.edition_number}` : ''}{item.edition_size ? ` / ${item.edition_size}` : ''}
            </p>
            <div class="flex gap-2">
              <label class="sr-only" for={`offer-${item.acquisition_id}`}>Offer amount in {item.currency}</label>
              <input id={`offer-${item.acquisition_id}`} class="input-dark flex-1" type="number" min="1" step="1"
                placeholder={`${item.currency} offer`} bind:value={offerDrafts[item.acquisition_id]} />
              <button class="btn-spectral px-4 text-xs rounded-full" disabled={offering === item.acquisition_id}
                on:click={() => placeOffer(item)}>{offering === item.acquisition_id ? '…' : 'Make offer'}</button>
            </div>
          </article>
        {/each}
      </div>
    </section>
  {/if}

  {#if loadError}
    <!-- Never invite someone to publish into a catalogue that is merely
         unreadable — their release may already be in it. -->
    <div class="glass rounded-2xl p-16 text-center" style="border-color: rgba(240,201,138,.28);">
      <p class="t-caption mb-3" style="color:#F0C98A;">Catalogue unavailable</p>
      <p class="text-base mb-6 mx-auto" style="color: var(--ink-muted); max-width: 34rem;">{loadError.message}</p>
      <button type="button" class="btn-spectral rounded-full px-6 py-2.5 text-sm" on:click={() => location.reload()}>
        Try again
      </button>
    </div>
  {:else if feed.length === 0}
    <div class="glass rounded-2xl p-20 text-center">
      <p class="t-caption mb-3">No releases yet</p>
      <p class="text-base mb-6" style="color: var(--ink-muted);">The first releases are being compiled. Check back soon.</p>
      <a href="/studio" class="btn-spectral rounded-full px-6 py-2.5 text-sm">Create a release →</a>
    </div>
  {:else}

    {#if featured.length > 0}
      <div class="mb-10">
        <p class="t-caption mb-4">Top Experiences</p>

        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="carousel-track"
          bind:this={carouselEl}
          on:mouseenter={() => (paused = true)}
          on:mouseleave={() => (paused = false)}
          on:touchstart={() => (paused = true)}
          on:touchend={() => { setTimeout(() => (paused = false), 3000); }}
        >
          {#each featured as ed, i}
            {@const color = colors[i % 6]}
            <article class="store-card glass rounded-2xl overflow-hidden group relative" style="border-color: {color}30;">
              {#if dropHref(ed)}
                <a href={dropHref(ed)} class="absolute inset-0 z-10">
                  <span class="sr-only">Open the drop page for {ed.title} by {ed.artist_name}</span>
                </a>
              {/if}

              <div class="store-card-hero" style="background: radial-gradient(ellipse at top, {color}30 0%, transparent 70%), var(--charcoal);">
                {#if ed.cover_url}
                  <img
                    src={ed.cover_url}
                    alt="{ed.title} cover artwork"
                    class="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div class="absolute inset-0" style="background: linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.3) 40%, transparent 70%);"></div>
                {:else}
                  <div class="absolute inset-0 flex items-center justify-center">
                    <div class="w-24 h-24 rounded-full opacity-20" style="background: {color}; filter: blur(40px);"></div>
                    <span class="text-7xl font-black opacity-10 absolute" style="color: {color};">{ed.artist_name[0]}</span>
                  </div>
                {/if}

                <div class="absolute bottom-0 left-0 right-0 p-5 z-[2]">
                  <p class="text-[10px] font-bold uppercase tracking-[.25em] mb-1.5" style="color: {color};">{ed.artist_name}</p>
                  <h3 class="text-xl font-black text-white leading-tight">{ed.title}</h3>
                </div>
              </div>

              <div class="store-card-sample">
                {#if ed.tracks?.length}
                  <div class="flex flex-col gap-1">
                    {#each ed.tracks.filter((t) => !t.hidden).slice(0, 3) as track, ti}
                      <div class="flex items-center gap-2">
                        <span class="text-[9px] font-mono shrink-0" style="color: {color};">{String(ti + 1).padStart(2, '0')}</span>
                        <span class="text-xs text-white truncate">{track.title}</span>
                      </div>
                    {/each}
                    {#if (ed.tracks?.filter((t) => !t.hidden).length ?? 0) > 3}
                      <span class="text-[10px]" style="color: var(--ink-muted);">+{ed.tracks.filter((t) => !t.hidden).length - 3} more</span>
                    {/if}
                  </div>
                {/if}
              </div>

              <div class="store-card-footer">
                <div class="min-w-0">
                  <p class="text-[10px] font-semibold truncate" style="color: var(--ink-muted);">
                    {formatType(ed.release_type)} · {ed.track_count || 1} track{ed.track_count === 1 ? '' : 's'}{duration(ed.total_duration_ms) ? ` · ${duration(ed.total_duration_ms)}` : ''}
                  </p>
                  <p class="text-[9px] mt-0.5 truncate" style="color: var(--ink-muted);">
                    {ed.edition_name || ed.edition_type} · {available(ed) !== null ? `${available(ed)} left` : 'Open edition'}
                  </p>
                </div>
                <div class="flex items-center gap-2.5 shrink-0 relative z-20">
                  <span class="text-sm font-black text-white">{fmt(ed.price, ed.currency)}</span>
                  <button
                    class="btn-spectral py-1.5 px-4 text-xs rounded-full disabled:opacity-40"
                    disabled={isSoldOut(ed) || acquiring === ed.id}
                    on:click|stopPropagation={() => acquire(ed)}
                  >{isSoldOut(ed) ? 'Sold out' : acquiring === ed.id ? '…' : 'Acquire'}</button>
                </div>
              </div>
            </article>
          {/each}
        </div>
      </div>

      <div class="glow-line mb-8"></div>
    {/if}

    <div>
      <p class="t-caption mb-4">All Releases</p>
      <div class="space-y-2">
        {#each feed as ed, i}
          {@const color = colors[i % 6]}
          {@const avail = available(ed)}
          <div class="glass rounded-xl p-4 group relative transition-all duration-200" style="border-color: rgba(255,255,255,0.06);">
            {#if dropHref(ed)}
              <a href={dropHref(ed)} class="absolute inset-0 z-10">
                <span class="sr-only">Open the drop page for {ed.title} by {ed.artist_name}</span>
              </a>
            {/if}
            <div class="flex items-center gap-3">

              <div class="flex flex-col items-center shrink-0 w-8 relative z-20">
                <button class="text-xs font-black leading-none" style="color: var(--ink-muted);" aria-label="Upvote {ed.title}">▲</button>
                <span class="text-xs font-black text-white mt-0.5">{ed.votes ?? 0}</span>
              </div>

              <div class="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center text-base font-black"
                style="background: {color}18; border: 1px solid {color}35; color: {color};">
                {ed.artist_name[0]}
              </div>

              <div class="flex-1 min-w-0">
                <p class="text-xs font-bold uppercase tracking-widest truncate" style="color: {color};">{ed.artist_name}</p>
                <h3 class="text-sm font-black text-white leading-snug truncate">{ed.title}</h3>
                <p class="text-xs mt-0.5 truncate" style="color: var(--ink-muted);">{formatType(ed.release_type)} · {ed.track_count || 1} track{ed.track_count === 1 ? '' : 's'}{ed.disc_count > 1 ? ` · ${ed.disc_count} discs` : ''}{ed.explicit ? ' · Explicit' : ''}</p>
                {#if ed.tracks?.length}
                  <p class="text-[10px] mt-1 truncate" style="color:var(--ink-muted);">{ed.tracks.filter((track) => !track.hidden).slice(0, 3).map((track) => track.title).join(' · ')}</p>
                {/if}
              </div>

              <div class="shrink-0 text-right relative z-20">
                <p class="text-sm font-black text-white">{fmt(ed.price, ed.currency)}</p>
                <button
                  class="mt-1.5 text-xs font-semibold px-3 py-1 rounded-full disabled:opacity-40"
                  style="background: rgba(255,255,255,0.07); border: 1px solid var(--border-dim); color: var(--ink-secondary);"
                  disabled={isSoldOut(ed) || acquiring === ed.id}
                  on:click|stopPropagation={() => acquire(ed)}
                >{isSoldOut(ed) ? 'Sold out' : acquiring === ed.id ? '…' : 'Acquire'}</button>
              </div>
            </div>

            <div class="flex items-center gap-3 mt-2.5 ml-11 pl-3" style="border-left: 1px solid var(--border-dim);">
              <span class="text-xs px-2 py-0.5 rounded-full" style="background: rgba(255,255,255,0.04); color: var(--ink-muted);">{ed.edition_name || ed.edition_type}</span>
              {#if avail !== null}
                <span class="text-xs" style="color: var(--ink-muted);">{avail}/{ed.edition_size} left</span>
              {:else}
                <span class="text-xs" style="color: var(--ink-muted);">Open edition</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>

  {/if}
</div>

<style>
  .carousel-track {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 8px;
    scrollbar-width: none;
  }
  .carousel-track::-webkit-scrollbar { display: none; }

  .store-card {
    scroll-snap-align: start;
    flex: 0 0 calc(85vw - 48px);
    max-width: 340px;
    min-width: 260px;
    transition: transform .25s ease, box-shadow .25s ease;
  }
  .store-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(0,0,0,.4); }

  @media (min-width: 640px) {
    .store-card { flex: 0 0 300px; }
  }
  @media (min-width: 1024px) {
    .store-card { flex: 0 0 320px; }
  }

  .store-card-hero {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    overflow: hidden;
  }

  .store-card-sample {
    padding: 10px 16px;
    min-height: 52px;
    border-top: 1px solid rgba(255,255,255,.06);
  }

  .store-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 16px;
    border-top: 1px solid rgba(255,255,255,.06);
  }
</style>
