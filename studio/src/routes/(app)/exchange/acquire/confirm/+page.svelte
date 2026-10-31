<script>
  import ReceiptPrinter from '#lib/components/ui/ReceiptPrinter.svelte';
  import TactileButton from '#lib/components/ui/TactileButton.svelte';

  export let data;
  $: ({ state, release, edition_number } = data);

  $: editionLabel = edition_number != null && release?.edition_size
    ? `#${edition_number} of ${release.edition_size}`
    : edition_number != null
      ? `#${edition_number}`
      : 'Open edition';

  $: receiptItems = [
    release?.catalogue_number ? { label: 'CAT', value: release.catalogue_number } : null,
    { label: 'FORMAT', value: 'Digital package' },
    { label: 'STATUS', value: 'Verified authentic' },
  ].filter(Boolean);
</script>

<div class="max-w-xl mx-auto px-6 py-20">
  {#if state === 'success'}
    <div class="space-y-8">
      <div class="text-center">
        <p class="t-caption mb-2">Acquisition complete</p>
        <h1 class="text-2xl font-black text-white">{release?.title}</h1>
      </div>

      <ReceiptPrinter
        title={release?.title || 'Untitled'}
        artist={release?.artist_name || ''}
        edition={editionLabel}
        price={release?.price_display || ''}
        transactionId={data.transaction_ref || ''}
        items={receiptItems}
      />

      <div class="text-center pt-4">
        <TactileButton variant="spectral" size="md" href="/collection">
          View in your collection →
        </TactileButton>
      </div>
    </div>
  {:else if state === 'failed'}
    <div class="glass rounded-2xl p-10 text-center">
      <p class="t-caption mb-3">Payment failed</p>
      <p class="text-base mb-8" style="color: var(--ink-muted);">
        Your payment didn't go through{release ? ` for ${release.title}` : ''}. You have not been charged.
      </p>
      <TactileButton variant="ghost" size="md" href="/exchange">
        Back to the exchange
      </TactileButton>
    </div>
  {:else if state === 'sold_out'}
    <div class="glass rounded-2xl p-10 text-center">
      <p class="t-caption mb-3">Edition sold out</p>
      <p class="text-base mb-8" style="color: var(--ink-muted);">
        The last edition was claimed while your payment processed. We've flagged your payment for a refund — you'll hear from us shortly.
      </p>
      <TactileButton variant="ghost" size="md" href="/exchange">
        Back to the exchange
      </TactileButton>
    </div>
  {:else}
    <div class="glass rounded-2xl p-10 text-center">
      <p class="t-caption mb-3">Payment processing</p>
      <p class="text-base mb-8" style="color: var(--ink-muted);">
        We're confirming your payment{release ? ` for ${release.title}` : ''}. Your acquisition will appear in your collection shortly.
      </p>
      <TactileButton variant="spectral" size="md" href="/collection">
        Go to your collection
      </TactileButton>
    </div>
  {/if}
</div>
