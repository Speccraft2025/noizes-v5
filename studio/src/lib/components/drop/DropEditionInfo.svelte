<script>
  // Only fields that actually hold a value are rendered. A specification sheet
  // full of em dashes reads as an incomplete record; an absent row reads as a
  // field that does not apply.
  export let release;
  export let packageRecord = null;

  function bytes(value) {
    const size = Number(value) || 0;
    if (size <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let index = 0;
    let out = size;
    while (out >= 1024 && index < units.length - 1) { out /= 1024; index += 1; }
    return `${out >= 10 || index === 0 ? Math.round(out) : out.toFixed(1)} ${units[index]}`;
  }

  function minutes(ms) {
    const total = Math.round((Number(ms) || 0) / 60000);
    return total ? `${total} min` : '';
  }

  $: rows = [
    ['Release', release.title],
    ['Artist', release.artist_name],
    ['Type', String(release.release_type || '').replaceAll('_', ' ')],
    ['Released', release.release_date || release.year],
    ['Label', release.label],
    ['Catalogue number', release.catalogue_number],
    ['UPC / EAN', release.upc],
    ['Edition', release.edition_name || release.edition_type],
    ['Edition size', release.edition_size ? `${release.edition_size} copies` : 'Open edition'],
    ['Claimed', release.acquired_count ? `${release.acquired_count}` : null],
    ['Available', release.copies_available == null ? 'Unlimited' : `${release.copies_available}`],
    ['Tracks', release.track_count || null],
    ['Discs', release.disc_count > 1 ? release.disc_count : null],
    ['Duration', minutes(release.total_duration_ms)],
    ['Package size', bytes(packageRecord?.file_size || release.package_size)],
    ['Package version', packageRecord?.version ? `v${packageRecord.version}` : null],
    ['Format', '.nz'],
    ['Transferable', release.transferable ? 'Yes' : 'No'],
    ['Resale', release.resale_enabled ? 'Permitted' : 'Not permitted'],
    ['Territory', release.territory],
    ['Rights', release.rights_summary],
    ['Noizes release ID', release.id],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
</script>

<section aria-labelledby="drop-record-heading" class="space-y-5">
  <div>
    <p class="t-caption mb-1.5">The record</p>
    <h2 id="drop-record-heading" class="text-2xl font-black text-white tracking-tight">Release information</h2>
  </div>

  <dl class="glass rounded-2xl divide-y" style="border-color: var(--border-dim);">
    {#each rows as [label, value] (label)}
      <div class="flex items-start gap-4 px-5 py-3" style="border-color: var(--border-dim);">
        <dt class="text-xs font-semibold uppercase tracking-wider w-44 shrink-0" style="color: var(--ink-muted);">{label}</dt>
        <dd class="text-sm text-white min-w-0 break-words">{value}</dd>
      </div>
    {/each}
  </dl>
</section>

<style>
  /* Tailwind's divide-y needs a border colour that matches the glass edge. */
  dl > div + div { border-top-width: 1px; }
</style>
