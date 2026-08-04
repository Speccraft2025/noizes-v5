<script>
  // Rendered from the package manifest. If a row is here, the .nz contains it.
  export let contents = [];
  export let packageSize = 0;

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let index = 0;
    let size = value;
    while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
    return `${size >= 10 || index === 0 ? Math.round(size) : size.toFixed(1)} ${units[index]}`;
  }
</script>

{#if contents.length}
  <section aria-labelledby="drop-contents-heading" class="space-y-5">
    <div class="flex items-baseline justify-between gap-4 flex-wrap">
      <div>
        <p class="t-caption mb-1.5">Inside the package</p>
        <h2 id="drop-contents-heading" class="text-2xl font-black text-white tracking-tight">What you get</h2>
      </div>
      {#if packageSize}
        <p class="text-xs font-mono" style="color: var(--ink-muted);">{formatBytes(packageSize)} · one file</p>
      {/if}
    </div>

    <dl class="grid sm:grid-cols-2 gap-2.5">
      {#each contents as row (row.key)}
        <div class="glass rounded-xl px-4 py-3.5">
          <dt class="text-sm font-bold text-white">{row.label}</dt>
          <dd class="text-xs mt-1" style="color: var(--ink-muted);">{row.detail}</dd>
        </div>
      {/each}
    </dl>
  </section>
{/if}
