<script>
  // Only the creator sees this, and it stays folded away: a visitor who came
  // from a shared link should not have to read past the owner's tooling to
  // reach the record.
  export let release;
  export let analytics = null;
  export let links = [];
  export let busy = false;
  export let message = '';

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  let open = false;
  let priceDraft = release.price;
  let downloadDraft = release.allow_public_download;
  let offersDraft = release.offers_enabled;
  let descriptionDraft = release.drop_description ?? '';
  let linkDrafts = links.map((link) => ({ label: link.label, url: link.url, link_type: link.link_type }));

  const MAX_LINKS = 12;

  function addLink() {
    if (linkDrafts.length >= MAX_LINKS) return;
    linkDrafts = [...linkDrafts, { label: '', url: '', link_type: 'other' }];
  }

  function removeLink(index) {
    linkDrafts = linkDrafts.filter((_, position) => position !== index);
  }

  $: withdrawn = release.status === 'withdrawn';
</script>

<section class="glass rounded-2xl overflow-hidden" style="border-color: rgba(123,92,240,0.24);">
  <button
    type="button"
    class="w-full flex items-center justify-between gap-4 px-5 py-3.5 text-left"
    aria-expanded={open}
    aria-controls="drop-creator-panel"
    on:click={() => (open = !open)}
  >
    <span class="text-xs font-bold tracking-[0.16em] uppercase" style="color: #7B5CF0;">◈ Creator controls</span>
    <span class="text-xs" style="color: var(--ink-muted);" aria-hidden="true">{open ? '−' : '+'}</span>
  </button>

  {#if open}
    <div id="drop-creator-panel" class="px-5 pb-5 space-y-5 border-t" style="border-color: var(--border-dim);">
      {#if analytics}
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-5">
          {#each [['Views', analytics.view], ['Shares', analytics.share], ['Opens', analytics.experience_open], ['Downloads', analytics.download]] as [label, value]}
            <div class="rounded-lg px-3 py-2.5" style="background: rgba(255,255,255,0.03);">
              <p class="text-[10px] uppercase tracking-wider" style="color: var(--ink-muted);">{label}</p>
              <p class="text-lg font-black text-white">{value ?? 0}</p>
            </div>
          {/each}
        </div>
        <p class="text-[11px]" style="color: var(--ink-muted);">
          Counts only — no visitor is identified, located or tracked between pages.
        </p>
      {/if}

      <div class="grid sm:grid-cols-2 gap-4 pt-1">
        <div>
          <label class="label-dark" for="drop-price">Price ({release.currency})</label>
          <input id="drop-price" class="input-dark" type="number" min="0" step="1" bind:value={priceDraft} />
        </div>
        <div>
          <label class="label-dark" for="drop-description">Drop Page description</label>
          <input id="drop-description" class="input-dark" type="text" maxlength="400" bind:value={descriptionDraft} />
        </div>
      </div>

      <div class="space-y-2.5">
        <label class="flex items-start gap-3 text-sm" style="color: var(--ink-secondary);">
          <input type="checkbox" class="mt-1" bind:checked={downloadDraft} />
          <span>
            Allow anyone to download the .nz
            <span class="block text-xs" style="color: var(--ink-muted);">Only applies while the release is free.</span>
          </span>
        </label>
        <label class="flex items-start gap-3 text-sm" style="color: var(--ink-secondary);">
          <input type="checkbox" class="mt-1" bind:checked={offersDraft} />
          <span>
            Accept offers once the edition sells out
            <span class="block text-xs" style="color: var(--ink-muted);">Offers go to the collectors holding copies, not to you.</span>
          </span>
        </label>
      </div>

      <div class="space-y-2.5 pt-1">
        <p class="t-caption">From the creator · links</p>
        <p class="text-[11px]" style="color: var(--ink-muted);">
          Kept secondary to the release. https:// addresses only.
        </p>
        {#each linkDrafts as link, index}
          <div class="flex flex-wrap gap-2 items-center">
            <label class="sr-only" for={`link-label-${index}`}>Link {index + 1} label</label>
            <input id={`link-label-${index}`} class="input-dark flex-1 min-w-[8rem]" type="text"
              maxlength="60" placeholder="Label" bind:value={link.label} />
            <label class="sr-only" for={`link-url-${index}`}>Link {index + 1} address</label>
            <input id={`link-url-${index}`} class="input-dark flex-[2] min-w-[12rem]" type="url"
              placeholder="https://" bind:value={link.url} />
            <button type="button" class="btn-ghost rounded-full px-3 py-1.5 text-xs"
              on:click={() => removeLink(index)}>Remove</button>
          </div>
        {/each}
        <div class="flex gap-2">
          <button type="button" class="btn-ghost rounded-full px-4 py-1.5 text-xs"
            disabled={linkDrafts.length >= MAX_LINKS} on:click={addLink}>Add link</button>
          <button type="button" class="btn-ghost rounded-full px-4 py-1.5 text-xs"
            disabled={busy} on:click={() => dispatch('links', linkDrafts)}>Save links</button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          class="btn-spectral rounded-full px-5 py-2 text-xs"
          disabled={busy}
          on:click={() => dispatch('save', {
            price: priceDraft,
            allow_public_download: downloadDraft,
            offers_enabled: offersDraft,
            drop_description: descriptionDraft,
          })}
        >Save changes</button>

        <a class="btn-ghost rounded-full px-5 py-2 text-xs" href="/studio">Edit release in Studio</a>

        <button
          type="button"
          class="btn-ghost rounded-full px-5 py-2 text-xs"
          disabled={busy}
          on:click={() => dispatch(withdrawn ? 'republish' : 'withdraw')}
        >{withdrawn ? 'Publish again' : 'Withdraw from Exchange'}</button>
      </div>

      <p class="text-xs min-h-[1rem]" role="status" aria-live="polite" style="color: var(--ink-muted);">{message}</p>

      <p class="text-[11px] leading-relaxed pt-3 border-t" style="color: var(--ink-muted); border-color: var(--border-dim);">
        Withdrawing stops new acquisitions. This page stays reachable as an archive record, and copies already held
        are untouched — a collector's package never changes because you changed your mind. Replacing the package
        itself creates a new version beside the old one rather than overwriting it.
      </p>
    </div>
  {/if}
</section>
