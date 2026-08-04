<script>
  // The cover is the loudest thing on the page, so it must not be the only
  // thing carrying the title: alt text names the release, and the hero repeats
  // artist and title as real text beside it. A visitor who cannot see the
  // image loses the artwork, not the information.
  export let release;
  export let featured = false;

  const palette = ['#7B5CF0', '#4B6BF0', '#F04BD8'];
  $: accent = palette[(release.title?.length ?? 0) % palette.length];
  $: initial = (release.artist_name || 'N').trim().charAt(0).toUpperCase();
  $: editionLabel = release.edition_name || release.edition_type || '';
</script>

<figure class="relative">
  <div
    class="relative w-full aspect-square rounded-2xl overflow-hidden"
    style="background: radial-gradient(ellipse at 30% 0%, {accent}30 0%, transparent 68%), var(--charcoal);
           border: 1px solid {accent}28;"
  >
    {#if release.cover_url}
      <img
        src={release.cover_url}
        alt="Cover artwork for {release.title} by {release.artist_name}"
        class="absolute inset-0 w-full h-full object-cover"
        width="1000" height="1000"
        loading="eager" decoding="async"
      />
    {:else}
      <!-- No cover is a real state, not an error. It gets a composed
           placeholder rather than a broken-image glyph. -->
      <div class="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <div class="w-32 h-32 rounded-full opacity-25" style="background: {accent}; filter: blur(48px);"></div>
        <span class="absolute text-[7rem] font-black opacity-10" style="color: {accent};">{initial}</span>
      </div>
      <p class="sr-only">No cover artwork was included with this release.</p>
    {/if}

    <!-- The .nz mark, bottom-left, small. The object is the point; the badge
         is a signature, not a banner. -->
    <div class="absolute bottom-4 left-4 flex items-center gap-2">
      <span
        class="text-[10px] font-black tracking-[0.2em] px-2.5 py-1 rounded-full"
        style="background: rgba(3,3,3,0.72); backdrop-filter: blur(12px); color: #fff; border: 1px solid rgba(255,255,255,0.14);"
      >.NZ</span>
      {#if editionLabel}
        <span
          class="text-[10px] font-semibold tracking-[0.14em] uppercase px-2.5 py-1 rounded-full truncate max-w-[11rem]"
          style="background: rgba(3,3,3,0.6); backdrop-filter: blur(12px); color: var(--ink-secondary); border: 1px solid rgba(255,255,255,0.1);"
        >{editionLabel}</span>
      {/if}
    </div>

    {#if featured}
      <div class="absolute top-4 left-4">
        <span
          class="text-[10px] font-black tracking-[0.18em] px-2.5 py-1 rounded-full"
          style="background: {accent}; color: #fff;"
        >FEATURED DROP</span>
      </div>
    {/if}
  </div>
</figure>
