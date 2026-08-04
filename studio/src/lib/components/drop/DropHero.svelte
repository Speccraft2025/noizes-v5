<script>
  import DropArtwork from './DropArtwork.svelte';
  import DropPrimaryActions from './DropPrimaryActions.svelte';
  import DropTrustIndicators from './DropTrustIndicators.svelte';
  import DropAvailability from './DropAvailability.svelte';

  export let release;
  export let availability;
  export let trust = [];
  export let busy = false;
  export let message = '';

  function formatPrice(price, currency) {
    const value = Number(price) || 0;
    if (value === 0) return 'Free';
    if (currency === 'KES') return `KES ${value.toLocaleString()}`;
    if (currency === 'USD') return `$${value.toLocaleString()}`;
    if (currency === 'EUR') return `€${value.toLocaleString()}`;
    return `${currency} ${value.toLocaleString()}`;
  }

  function formatType(value) {
    return String(value || 'release').replaceAll('_', ' ').toUpperCase();
  }

  function duration(ms) {
    const minutes = Math.round((Number(ms) || 0) / 60000);
    return minutes ? `${minutes} min` : '';
  }

  $: facts = [
    release.year || release.release_date?.slice(0, 4),
    release.track_count ? `${release.track_count} track${release.track_count === 1 ? '' : 's'}` : '',
    duration(release.total_duration_ms),
    '.nz package',
  ].filter(Boolean);

  $: blurb = release.drop_description || release.description || '';
</script>

<section class="grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] gap-8 lg:gap-14 items-start">
  <div class="lg:sticky lg:top-24">
    <DropArtwork {release} />
  </div>

  <div class="space-y-7">
    <div class="space-y-3">
      <p class="t-caption" style="letter-spacing: 0.22em;">{formatType(release.release_type)} DROP</p>

      <h1 class="t-monumental-small text-white">{release.title}</h1>

      <p class="text-lg font-semibold" style="color: var(--ink-secondary);">
        {release.artist_name}
        {#if release.featured_artists?.length}
          <span style="color: var(--ink-muted);"> feat. {release.featured_artists.join(', ')}</span>
        {/if}
      </p>

      {#if blurb}
        <p class="text-base leading-relaxed max-w-prose" style="color: var(--ink-secondary);">{blurb}</p>
      {/if}
    </div>

    <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs" style="color: var(--ink-muted);">
      {#each facts as fact, index}
        {#if index > 0}<span aria-hidden="true">·</span>{/if}
        <span>{fact}</span>
      {/each}
      {#if release.explicit}
        <span aria-hidden="true">·</span>
        <span style="color: #F08A9D;">Explicit</span>
      {/if}
    </div>

    <div class="glow-line"></div>

    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="t-caption mb-1">Price</p>
        <p class="text-3xl font-black text-white">{formatPrice(release.price, release.currency)}</p>
      </div>
      <DropAvailability {release} />
    </div>

    <DropPrimaryActions {availability} {busy} {message} on:action />

    <DropTrustIndicators {trust} />
  </div>
</section>
