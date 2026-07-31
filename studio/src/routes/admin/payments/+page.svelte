<script>
  export let data;
  const money = (intent) => `${intent.currency} ${(Number(intent.amount_subunits) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
</script>

<svelte:head><title>Payment reconciliation — Noizes Admin</title></svelte:head>

<div class="max-w-5xl mx-auto px-6 py-8">
  <div class="mb-8">
    <p class="t-caption mb-2">Operations</p>
    <h1 class="text-3xl font-black text-white">Payment reconciliation</h1>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">Paid-but-unfulfilled transactions need a refund or manual fulfilment. Pending charges older than one hour should be checked in Paystack.</p>
  </div>

  <div class="glass rounded-2xl overflow-hidden">
    <table class="w-full text-sm">
      <thead><tr class="border-b text-left" style="border-color: var(--border-dim);">
        <th class="px-5 py-3 t-caption">Reference</th><th class="px-5 py-3 t-caption">Type</th>
        <th class="px-5 py-3 t-caption">Amount</th><th class="px-5 py-3 t-caption">Status</th><th class="px-5 py-3 t-caption">Created</th>
      </tr></thead>
      <tbody>
        {#each data.intents as intent (intent.id)}
          <tr class="border-b last:border-0" style="border-color: var(--border-dim);">
            <td class="px-5 py-3 font-mono text-xs text-white">{intent.reference}</td>
            <td class="px-5 py-3" style="color: var(--ink-muted);">{intent.kind}</td>
            <td class="px-5 py-3 text-white">{money(intent)}</td>
            <td class="px-5 py-3"><span class="text-xs text-red-400">{intent.status}</span></td>
            <td class="px-5 py-3 text-xs" style="color: var(--ink-muted);">{new Date(intent.created_at).toLocaleString()}</td>
          </tr>
        {:else}
          <tr><td colspan="5" class="px-5 py-12 text-center text-sm" style="color: var(--ink-muted);">No payment exceptions. The queue is clear.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
