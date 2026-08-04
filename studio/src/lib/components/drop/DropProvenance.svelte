<script>
  // The public timeline is the RELEASE's history: created, published, and
  // anything that happened to the work itself. Who holds copy 12 is between
  // that collector and the object; the page reports movement in aggregate and
  // names nobody. No placeholder buyers, no invented events — if the only
  // thing that ever happened is publication, that is what the page shows.
  export let timeline = [];
  export let transfers = { acquisitions: 0, transfers: 0 };
  export let historyHref = '';
</script>

{#if timeline.length}
  <section aria-labelledby="drop-provenance-heading" class="space-y-5">
    <div>
      <p class="t-caption mb-1.5">The living record</p>
      <h2 id="drop-provenance-heading" class="text-2xl font-black text-white tracking-tight">Provenance</h2>
    </div>

    <ol class="glass rounded-2xl p-6 space-y-0">
      {#each timeline as event, index (event.seq)}
        <li class="flex gap-4 {index === timeline.length - 1 ? '' : 'pb-5'}">
          <div class="flex flex-col items-center shrink-0">
            <span class="w-2.5 h-2.5 rounded-full mt-1.5" style="background: #7B5CF0;" aria-hidden="true"></span>
            {#if index !== timeline.length - 1}
              <span class="w-px flex-1 mt-1" style="background: var(--border-dim);" aria-hidden="true"></span>
            {/if}
          </div>
          <div class="min-w-0 pb-1">
            <p class="text-sm font-bold text-white">{event.label}</p>
            {#if event.date}
              <p class="text-xs mt-0.5" style="color: var(--ink-muted);">
                <time datetime={event.date}>{event.date}</time>
              </p>
            {/if}
          </div>
        </li>
      {/each}
    </ol>

    {#if transfers.acquisitions || transfers.transfers}
      <p class="text-xs" style="color: var(--ink-muted);">
        {transfers.acquisitions} cop{transfers.acquisitions === 1 ? 'y has' : 'ies have'} been acquired{#if transfers.transfers}, and {transfers.transfers} {transfers.transfers === 1 ? 'has' : 'have'} changed hands since{/if}.
        Collector identities stay private unless a collector chooses otherwise.
      </p>
    {/if}

    {#if historyHref}
      <a class="btn-ghost rounded-full px-5 py-2 text-xs" href={historyHref} download>View full history</a>
    {/if}
  </section>
{/if}
