<script>
  export let data;
  $: ({ collection, events } = data);

  const colors = ['#4B6BF0', '#7B5CF0', '#F04BD8', '#7B5CF0', '#4B6BF0', '#F04BD8'];
</script>

<div class="max-w-5xl mx-auto px-6 py-8">
  <div class="mb-10 flex items-end justify-between">
    <div>
      <p class="t-caption mb-2">Your Library</p>
      <h1 class="t-monumental-small text-white">Collection</h1>
      <p class="text-base mt-2" style="color: var(--ink-muted);">Your owned cultural objects and provenance history.</p>
    </div>
    <div class="glass rounded-xl px-5 py-3 text-center">
      <p class="text-2xl font-black text-white">{collection.length}</p>
      <p class="t-caption">Objects</p>
    </div>
  </div>

  {#if collection.length === 0}
    <div class="glass rounded-2xl p-16 text-center">
      <p class="t-caption mb-3">Empty collection</p>
      <p class="text-base" style="color: var(--ink-muted);">Head to <a href="/exchange" class="text-white underline">Exchange</a> to acquire your first object.</p>
    </div>
  {:else}
    <div class="space-y-3 mb-10">
      {#each collection as item, i}
        {@const color = colors[i % colors.length]}
        <div class="glass rounded-2xl p-5 flex gap-5 group transition-all duration-200">
          <!-- Cover -->
          <div class="w-20 h-20 shrink-0 rounded-xl flex items-center justify-center text-2xl font-black"
            style="background: radial-gradient(ellipse, {color}25, transparent); border: 1px solid {color}25; color: {color};">
            {item.artist[0]}
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold uppercase tracking-widest mb-0.5" style="color: {color};">{item.artist}</p>
            <h3 class="text-xl font-black text-white mb-2">{item.title}</h3>
            <div class="flex gap-4 flex-wrap">
              <span class="text-xs" style="color: var(--ink-muted);">{item.genre} · {item.year} · {item.location}</span>
            </div>
            <div class="flex gap-3 mt-2 flex-wrap">
              <span class="text-xs px-2 py-0.5 rounded-full" style="background: rgba(255,255,255,0.05); color: var(--ink-muted);">{item.edition_type}{item.edition_number ? ` #${item.edition_number}` : ''}{item.edition_size ? ` / ${item.edition_size}` : ''}</span>
              <span class="text-xs" style="color: var(--ink-muted);">Acquired {item.acquired}</span>
              <span class="text-xs" style="color: var(--ink-muted);">{item.currency} {Number(item.price).toLocaleString()}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-col gap-2 shrink-0 justify-center">
            <button class="btn-spectral py-1.5 px-4 text-xs rounded-full">Open .nz</button>
            <button class="btn-ghost py-1.5 px-4 text-xs rounded-full">Transfer</button>
          </div>
        </div>
      {/each}
    </div>

    <!-- Ownership log -->
    <div>
      <p class="t-caption mb-4">Ownership Events</p>
      <div class="glass rounded-xl overflow-hidden">
        <table class="w-full text-xs font-mono">
          <thead>
            <tr class="border-b" style="border-color: var(--border-dim);">
              <th class="text-left px-5 py-3" style="color: var(--ink-muted);">Date</th>
              <th class="text-left px-5 py-3" style="color: var(--ink-muted);">Work</th>
              <th class="text-left px-5 py-3" style="color: var(--ink-muted);">Event</th>
              <th class="text-left px-5 py-3" style="color: var(--ink-muted);">Price</th>
            </tr>
          </thead>
          <tbody>
            {#each events as ev}
              <tr class="border-b last:border-0 transition-colors" style="border-color: var(--border-dim);">
                <td class="px-5 py-3" style="color: var(--ink-muted);">{ev.date}</td>
                <td class="px-5 py-3 text-white">{ev.work}</td>
                <td class="px-5 py-3" style="color: #7B5CF0;">{ev.event}</td>
                <td class="px-5 py-3 text-white">{ev.price}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
