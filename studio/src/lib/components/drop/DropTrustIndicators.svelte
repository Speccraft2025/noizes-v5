<script>
  // Only claims the release data supports appear here. An unsupported claim is
  // absent rather than greyed out, because a dimmed "Verified authentic" still
  // reads as a badge to someone skimming.
  export let trust = [];

  const GLYPHS = {
    offline: '⬡',
    portable: '⬟',
    validated: '◎',
    signed: '◈',
    transferable: '⇄',
  };
</script>

{#if trust.length}
  <ul class="grid grid-cols-2 sm:grid-cols-3 gap-2" aria-label="What this release guarantees">
    {#each trust as item (item.key)}
      <li class="glass rounded-xl px-3 py-2.5 flex items-start gap-2.5">
        <span class="text-sm leading-none mt-0.5" style="color: #7B5CF0;" aria-hidden="true">{GLYPHS[item.key] ?? '·'}</span>
        <div class="min-w-0">
          <p class="text-xs font-bold text-white leading-tight">{item.label}</p>
          <p class="text-[11px] mt-0.5 leading-snug" style="color: var(--ink-muted);">{item.detail}</p>
        </div>
      </li>
    {/each}
  </ul>
{/if}
