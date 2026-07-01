<script>
  const featured = [
    { id: 1, artist: 'Msafiri Zawose', title: 'Kibuyu', genre: 'Gogo', year: '2024', location: 'Dodoma, TZ', edition_type: 'First Edition', edition_size: 50, price: 2500, currency: 'KES', available: 12, color: '#7B5CF0' },
    { id: 2, artist: 'KMRU', title: 'Peel', genre: 'Ambient', year: '2022', location: 'Berlin, DE', edition_type: 'Archive Edition', edition_size: 100, price: 15, currency: 'EUR', available: 33, color: '#4B6BF0' },
    { id: 3, artist: 'Kasiva Mutua', title: 'Ngoma Ya Moyo', genre: 'Afro-Jazz', year: '2023', location: 'Nairobi, KE', edition_type: 'Collector Edition', edition_size: 20, price: 5000, currency: 'KES', available: 7, color: '#F04BD8' },
  ];

  const feed = [
    { id: 1, artist: 'Msafiri Zawose', title: 'Kibuyu', genre: 'Gogo', year: '2024', location: 'Dodoma, TZ', edition_type: 'First Edition', edition_size: 50, price: 2500, currency: 'KES', available: 12, votes: 842, comments: 34 },
    { id: 2, artist: 'Blinky Bill', title: 'Hali Halisi', genre: 'Afro-Soul', year: '2024', location: 'Nairobi, KE', edition_type: 'Open Edition', edition_size: null, price: 500, currency: 'KES', available: null, votes: 631, comments: 22 },
    { id: 3, artist: 'Kasiva Mutua', title: 'Ngoma Ya Moyo', genre: 'Afro-Jazz', year: '2023', location: 'Nairobi, KE', edition_type: 'Collector Edition', edition_size: 20, price: 5000, currency: 'KES', available: 7, votes: 519, comments: 18 },
    { id: 4, artist: 'KMRU', title: 'Peel', genre: 'Ambient', year: '2022', location: 'Berlin, DE', edition_type: 'Archive Edition', edition_size: 100, price: 15, currency: 'EUR', available: 33, votes: 410, comments: 11 },
    { id: 5, artist: 'Chidi Benz', title: 'Niambie', genre: 'Bongo Flava', year: '2024', location: 'Dar es Salaam, TZ', edition_type: 'Artist Proof', edition_size: 10, price: 9000, currency: 'KES', available: 2, votes: 389, comments: 9 },
    { id: 6, artist: 'Sho Madjozi', title: 'Dumi Hi Phone', genre: 'Tsonga-Pop', year: '2023', location: 'Johannesburg, ZA', edition_type: 'Founder Edition', edition_size: 30, price: 80, currency: 'USD', available: 9, votes: 298, comments: 15 },
  ];

  const colors = ['#7B5CF0', '#4B6BF0', '#F04BD8', '#7B5CF0', '#4B6BF0', '#F04BD8'];

  function fmt(price, currency) {
    if (currency === 'KES') return `KES ${price.toLocaleString()}`;
    if (currency === 'USD') return `$${price}`;
    if (currency === 'EUR') return `€${price}`;
    return `${currency} ${price}`;
  }
</script>

<div class="max-w-7xl mx-auto px-6 py-8">
  <!-- Header -->
  <div class="mb-10">
    <p class="t-caption mb-2">Discover</p>
    <h1 class="t-monumental-small text-white mb-2">Exchange</h1>
    <p class="text-base" style="color: var(--ink-muted);">Browse and acquire cultural objects from artists worldwide.</p>
  </div>

  <!-- Featured carousel -->
  <div class="mb-10">
    <p class="t-caption mb-4">Top Experiences</p>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      {#each featured as ed}
        <div class="glass rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 hover:border-opacity-50" style="border-color: {ed.color}30;">
          <!-- Gradient cover -->
          <div class="w-full aspect-square relative flex items-end p-5"
            style="background: radial-gradient(ellipse at top, {ed.color}30 0%, transparent 70%), var(--charcoal);">
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="w-20 h-20 rounded-full opacity-20" style="background: {ed.color}; filter: blur(30px);"></div>
              <span class="text-6xl font-black opacity-10 absolute" style="color: {ed.color};">{ed.artist[0]}</span>
            </div>
            <div class="relative z-10">
              <p class="text-xs font-bold uppercase tracking-widest mb-1" style="color: {ed.color};">{ed.artist}</p>
              <h3 class="text-xl font-black text-white leading-tight">{ed.title}</h3>
            </div>
          </div>
          <div class="p-4 flex items-center justify-between">
            <div>
              <p class="text-xs font-semibold" style="color: var(--ink-muted);">{ed.edition_type} · {ed.available ?? '∞'} left</p>
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

  <!-- Feed -->
  <div>
    <p class="t-caption mb-4">All Releases</p>
    <div class="space-y-2">
      {#each feed as ed, i}
        <div class="glass rounded-xl p-4 group cursor-pointer transition-all duration-200" style="border-color: rgba(255,255,255,0.06);">
          <div class="flex items-center gap-3">

            <!-- Votes -->
            <div class="flex flex-col items-center shrink-0 w-8">
              <button class="text-xs font-black leading-none" style="color: var(--ink-muted);">▲</button>
              <span class="text-xs font-black text-white mt-0.5">{ed.votes}</span>
            </div>

            <!-- Cover thumb -->
            <div class="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center text-base font-black"
              style="background: {colors[i % 6]}18; border: 1px solid {colors[i % 6]}35; color: {colors[i % 6]};">
              {ed.artist[0]}
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold uppercase tracking-widest truncate" style="color: {colors[i % 6]};">{ed.artist}</p>
              <h3 class="text-sm font-black text-white leading-snug truncate">{ed.title}</h3>
              <p class="text-xs mt-0.5 truncate" style="color: var(--ink-muted);">{ed.genre} · {ed.location}</p>
            </div>

            <!-- Price & CTA -->
            <div class="shrink-0 text-right">
              <p class="text-sm font-black text-white">{fmt(ed.price, ed.currency)}</p>
              <button class="mt-1.5 text-xs font-semibold px-3 py-1 rounded-full" style="background: rgba(255,255,255,0.07); border: 1px solid var(--border-dim); color: var(--ink-secondary);">Acquire</button>
            </div>
          </div>

          <!-- Bottom meta row -->
          <div class="flex items-center gap-3 mt-2.5 ml-11 pl-3" style="border-left: 1px solid var(--border-dim);">
            <span class="text-xs px-2 py-0.5 rounded-full" style="background: rgba(255,255,255,0.04); color: var(--ink-muted);">{ed.edition_type}</span>
            {#if ed.available !== null}
              <span class="text-xs" style="color: var(--ink-muted);">{ed.available}/{ed.edition_size} left</span>
            {:else}
              <span class="text-xs" style="color: var(--ink-muted);">Open edition</span>
            {/if}
            <span class="text-xs ml-auto" style="color: var(--ink-muted);">◉ {ed.comments}</span>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
