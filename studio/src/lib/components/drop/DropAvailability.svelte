<script>
  // Availability is stated in words as well as by colour: "3 of 100 remain" is
  // legible to someone who cannot distinguish the violet dot from the amber
  // one, and it survives a screenshot.
  export let release;

  $: limited = release.edition_size != null;
  $: available = release.copies_available;
  $: claimed = Number(release.acquired_count) || 0;
  $: soldOut = limited && available === 0;
  $: tone = soldOut ? '#F08A9D' : available !== null && available <= 5 ? '#F0B06B' : '#7B5CF0';
</script>

<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
  <span class="inline-flex items-center gap-2">
    <span class="w-1.5 h-1.5 rounded-full" style="background: {tone};" aria-hidden="true"></span>
    <span class="text-sm font-bold" style="color: {tone};">
      {#if !limited}
        Open edition
      {:else if soldOut}
        Sold out
      {:else}
        {available} of {release.edition_size} remain
      {/if}
    </span>
  </span>

  {#if limited && claimed > 0}
    <span class="text-xs" style="color: var(--ink-muted);">
      {claimed} claimed
    </span>
  {/if}

  {#if release.status === 'withdrawn'}
    <span class="text-xs px-2 py-0.5 rounded-full"
      style="background: rgba(240,176,107,.1); color: #F0B06B; border: 1px solid rgba(240,176,107,.22);">
      Withdrawn — archive record
    </span>
  {/if}
</div>
