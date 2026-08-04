<script>
  import { createEventDispatcher } from 'svelte';
  import DropQRCode from './DropQRCode.svelte';

  // Everything here shares the canonical Drop Page URL and nothing else. Never
  // a storage URL (they move and they expose the object's location), never a
  // URL carrying who shared it.
  export let share;
  export let title = '';

  const dispatch = createEventDispatcher();
  let copied = false;
  let copyError = '';

  async function copyLink() {
    copyError = '';
    try {
      await navigator.clipboard.writeText(share.url);
      copied = true;
      dispatch('shared', 'copy');
      setTimeout(() => { copied = false; }, 2400);
    } catch {
      // Clipboard access is refused often enough — in insecure contexts, in
      // locked-down browsers — that failing silently would leave the reader
      // thinking they had copied a link they had not.
      copyError = 'Could not copy automatically. Select the address bar and copy the URL.';
    }
  }

  async function nativeShare() {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({ title, text: share.message, url: share.url });
      dispatch('shared', 'native');
    } catch {
      // A cancelled share sheet is not an error worth reporting.
    }
  }

  $: canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
</script>

<section aria-labelledby="drop-share-heading" class="space-y-5">
  <div>
    <p class="t-caption mb-1.5">Pass it on</p>
    <h2 id="drop-share-heading" class="text-2xl font-black text-white tracking-tight">Share this drop</h2>
  </div>

  <div class="glass rounded-2xl p-6 grid lg:grid-cols-[1fr_auto] gap-8">
    <div class="space-y-4 min-w-0">
      <div class="flex flex-col sm:flex-row gap-2">
        <p
          class="flex-1 min-w-0 text-xs font-mono px-4 py-3 rounded-xl truncate"
          style="background: rgba(255,255,255,0.04); border: 1px solid var(--border-dim); color: var(--ink-secondary);"
          title={share.url}
        >{share.url}</p>
        <button type="button" class="btn-spectral rounded-xl px-5 py-3 text-xs shrink-0 justify-center" on:click={copyLink}>
          {copied ? '✓ Copied' : 'Copy link'}
        </button>
      </div>

      <p class="text-xs min-h-[1rem]" role="status" aria-live="polite" style="color: {copyError ? '#F08A9D' : 'var(--ink-muted)'};">
        {copyError || (copied ? 'Link copied to your clipboard.' : '')}
      </p>

      <div class="flex flex-wrap gap-2">
        {#if canNativeShare}
          <button type="button" class="btn-ghost rounded-full px-4 py-2 text-xs" on:click={nativeShare}>Share…</button>
        {/if}
        {#each share.targets as target (target.key)}
          <a
            class="btn-ghost rounded-full px-4 py-2 text-xs"
            href={target.href}
            target="_blank"
            rel="noopener noreferrer"
            on:click={() => dispatch('shared', target.key)}
          >{target.label}</a>
        {/each}
      </div>

      <details class="text-xs" style="color: var(--ink-muted);">
        <summary class="cursor-pointer font-semibold">Preview the message</summary>
        <pre class="mt-2 whitespace-pre-wrap font-sans leading-relaxed">{share.message}</pre>
      </details>
    </div>

    <div class="lg:border-l lg:pl-8" style="border-color: var(--border-dim);">
      <DropQRCode svg={share.qr} url={share.url} {title} on:opened={() => dispatch('shared', 'qr')} on:downloaded={() => dispatch('shared', 'qr')} />
    </div>
  </div>
</section>
