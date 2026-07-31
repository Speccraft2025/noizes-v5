<script>
  import { goto } from '$app/navigation';

  export let data;
  $: ({ featured, feed, resale } = data);

  const colors = ['#7B5CF0', '#4B6BF0', '#F04BD8', '#7B5CF0', '#4B6BF0', '#F04BD8'];

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
            <h3 class="text-lg font-black text-white">{item.title}</h3>
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

  {#if feed.length === 0}
    <div class="glass rounded-2xl p-20 text-center">
      <p class="t-caption mb-3">No releases yet</p>
      <p class="text-base mb-6" style="color: var(--ink-muted);">The first releases are being compiled. Check back soon.</p>
      <a href="/studio" class="btn-spectral rounded-full px-6 py-2.5 text-sm">Create a release →</a>
    </div>
  {:else}

    {#if featured.length > 0}
      <div class="mb-10">
        <p class="t-caption mb-4">Top Experiences</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          {#each featured as ed, i}
            {@const color = colors[i % 6]}
            <div class="glass rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300" style="border-color: {color}30;">
              <div class="w-full aspect-square relative flex items-end p-5"
                style="background: radial-gradient(ellipse at top, {color}30 0%, transparent 70%), var(--charcoal);">
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="w-20 h-20 rounded-full opacity-20" style="background: {color}; filter: blur(30px);"></div>
                  <span class="text-6xl font-black opacity-10 absolute" style="color: {color};">{ed.artist_name[0]}</span>
                </div>
                <div class="relative z-10">
                  <p class="text-xs font-bold uppercase tracking-widest mb-1" style="color: {color};">{ed.artist_name}</p>
                  <h3 class="text-xl font-black text-white leading-tight">{ed.title}</h3>
                </div>
              </div>
              <div class="p-4 flex items-center justify-between">
                <div>
                  <p class="text-xs font-semibold" style="color: var(--ink-muted);">
                    {formatType(ed.release_type)} · {ed.track_count || 1} track{ed.track_count === 1 ? '' : 's'}{duration(ed.total_duration_ms) ? ` · ${duration(ed.total_duration_ms)}` : ''}
                  </p>
                  <p class="text-[10px] mt-1" style="color: var(--ink-muted);">
                    {ed.edition_name || ed.edition_type} · {available(ed) !== null ? `${available(ed)} left` : 'Open edition'}
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-sm font-black text-white">{fmt(ed.price, ed.currency)}</span>
                  <button
                    class="btn-spectral py-1.5 px-4 text-xs rounded-full disabled:opacity-40"
                    disabled={isSoldOut(ed) || acquiring === ed.id}
                    on:click|stopPropagation={() => acquire(ed)}
                  >{isSoldOut(ed) ? 'Sold out' : acquiring === ed.id ? '…' : 'Acquire'}</button>
                </div>
              </div>
            </div>
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
          <div class="glass rounded-xl p-4 group cursor-pointer transition-all duration-200" style="border-color: rgba(255,255,255,0.06);">
            <div class="flex items-center gap-3">

              <div class="flex flex-col items-center shrink-0 w-8">
                <button class="text-xs font-black leading-none" style="color: var(--ink-muted);">▲</button>
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

              <div class="shrink-0 text-right">
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
