<script>
  export let data;
  $: ({ featured, feed } = data);

  const colors = ['#7B5CF0', '#4B6BF0', '#F04BD8', '#7B5CF0', '#4B6BF0', '#F04BD8'];

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
</script>

<div class="max-w-7xl mx-auto px-6 py-8">
  <!-- Header -->
  <div class="mb-10">
    <p class="t-caption mb-2">Discover</p>
    <h1 class="t-monumental-small text-white mb-2">Exchange</h1>
    <p class="text-base" style="color: var(--ink-muted);">Browse and acquire cultural objects from artists worldwide.</p>
  </div>

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
                    {ed.edition_type} · {available(ed) !== null ? `${available(ed)} left` : '∞'}
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-sm font-black text-white">{fmt(ed.price, ed.currency)}</span>
                  <button class="btn-spectral py-1.5 px-4 text-xs rounded-full">Acquire</button>
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
                <p class="text-xs mt-0.5 truncate" style="color: var(--ink-muted);">{ed.genre ?? ''}{ed.location ? ` · ${ed.location}` : ''}</p>
              </div>

              <div class="shrink-0 text-right">
                <p class="text-sm font-black text-white">{fmt(ed.price, ed.currency)}</p>
                <button class="mt-1.5 text-xs font-semibold px-3 py-1 rounded-full" style="background: rgba(255,255,255,0.07); border: 1px solid var(--border-dim); color: var(--ink-secondary);">Acquire</button>
              </div>
            </div>

            <div class="flex items-center gap-3 mt-2.5 ml-11 pl-3" style="border-left: 1px solid var(--border-dim);">
              <span class="text-xs px-2 py-0.5 rounded-full" style="background: rgba(255,255,255,0.04); color: var(--ink-muted);">{ed.edition_type}</span>
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
