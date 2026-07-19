<script>
  export let data;
  $: ({ state, release, edition_number } = data);
</script>

<div class="max-w-xl mx-auto px-6 py-20">
  {#if state === 'success'}
    <div class="glass rounded-2xl p-10 text-center" style="border-color: #7B5CF040;">
      <p class="t-caption mb-3">Acquisition complete</p>
      <h1 class="text-2xl font-black text-white mb-2">{release?.title}</h1>
      {#if release?.artist_name}
        <p class="text-sm mb-4" style="color: var(--ink-muted);">{release.artist_name}</p>
      {/if}
      <p class="text-base font-bold mb-8" style="color: #7B5CF0;">
        {#if edition_number != null && release?.edition_size}
          Edition #{edition_number} of {release.edition_size}
        {:else if edition_number != null}
          Edition #{edition_number}
        {:else}
          Open edition
        {/if}
      </p>
      <a href="/collection" class="btn-spectral rounded-full px-6 py-2.5 text-sm">View in your collection →</a>
    </div>
  {:else if state === 'failed'}
    <div class="glass rounded-2xl p-10 text-center">
      <p class="t-caption mb-3">Payment failed</p>
      <p class="text-base mb-8" style="color: var(--ink-muted);">
        Your payment didn't go through{release ? ` for ${release.title}` : ''}. You have not been charged.
      </p>
      <a href="/exchange" class="btn-spectral rounded-full px-6 py-2.5 text-sm">Back to the exchange</a>
    </div>
  {:else if state === 'sold_out'}
    <div class="glass rounded-2xl p-10 text-center">
      <p class="t-caption mb-3">Edition sold out</p>
      <p class="text-base mb-8" style="color: var(--ink-muted);">
        The last edition was claimed while your payment processed. We've flagged your payment for a refund — you'll hear from us shortly.
      </p>
      <a href="/exchange" class="btn-spectral rounded-full px-6 py-2.5 text-sm">Back to the exchange</a>
    </div>
  {:else}
    <div class="glass rounded-2xl p-10 text-center">
      <p class="t-caption mb-3">Payment processing</p>
      <p class="text-base mb-8" style="color: var(--ink-muted);">
        We're confirming your payment{release ? ` for ${release.title}` : ''}. Your acquisition will appear in your collection shortly.
      </p>
      <a href="/collection" class="btn-spectral rounded-full px-6 py-2.5 text-sm">Go to your collection</a>
    </div>
  {/if}
</div>
