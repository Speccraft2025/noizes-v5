<script>
  import { createEventDispatcher } from 'svelte';

  // The SVG arrives from the server already rendered, so the code is present
  // in the first paint and works with JavaScript off. It is deliberately
  // unstyled black-on-white: a QR tinted to match the page is a QR that fails
  // in dim light, and the quiet zone is part of the code, not padding.
  export let svg = '';
  export let url = '';
  export let title = '';
  export let expandedByDefault = false;

  const dispatch = createEventDispatcher();
  let expanded = expandedByDefault;

  function download() {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `${String(title || 'noizes-drop').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-qr.svg`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
    dispatch('downloaded');
  }
</script>

{#if svg}
  <div class="space-y-3">
    <button
      type="button"
      class="btn-ghost rounded-full px-4 py-2 text-xs sm:hidden w-full justify-center"
      aria-expanded={expanded}
      aria-controls="drop-qr-panel"
      on:click={() => { expanded = !expanded; if (expanded) dispatch('opened'); }}
    >
      {expanded ? 'Hide QR code' : 'Show QR code'}
    </button>

    <div id="drop-qr-panel" class="{expanded ? 'block' : 'hidden'} sm:block space-y-3">
      <div class="rounded-xl overflow-hidden inline-block" style="background: #fff; padding: 0; line-height: 0;">
        {@html svg}
      </div>
      <p class="text-[11px] leading-snug" style="color: var(--ink-muted);">
        Scan to open this drop. Point a camera at it from a poster, a sleeve or a screen.
      </p>
      <div class="flex gap-2">
        <button type="button" class="btn-ghost rounded-full px-4 py-1.5 text-xs" on:click={download}>
          Download SVG
        </button>
      </div>
      <p class="sr-only">QR code encoding {url}</p>
    </div>
  </div>
{/if}
