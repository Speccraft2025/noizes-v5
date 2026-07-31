<script>
  import { extras } from '$lib/stores/package.js';
  import StepPlay from './StepPlay.svelte';

  function addLink() {
    extras.update((value) => ({
      ...value,
      links: [...value.links, { id: crypto.randomUUID(), label: '', url: '', kind: 'artist' }]
    }));
  }

  function updateLink(id, patch) {
    extras.update((value) => ({ ...value, links: value.links.map((link) => link.id === id ? { ...link, ...patch } : link) }));
  }

  function removeLink(id) {
    extras.update((value) => ({ ...value, links: value.links.filter((link) => link.id !== id) }));
  }
</script>

<div class="space-y-7">
  <div>
    <p class="t-caption mb-2">Step 4</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Extras</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">Add context, interactive moments, and deliberate online pathways around the music.</p>
  </div>

  <div>
    <label class="label-dark" for="artist-story">Artist statement or liner note</label>
    <textarea id="artist-story" class="input-dark resize-none" rows="6" bind:value={$extras.story}
      maxlength="20000" placeholder="Tell listeners what lives behind this work…"></textarea>
    <p class="text-xs mt-1 text-right" style="color: var(--ink-muted);">{$extras.story.length} / 20,000</p>
  </div>

  <div class="space-y-3">
    <div class="flex justify-between items-center">
      <div>
        <p class="label-dark mb-0">Optional online links</p>
        <p class="text-xs" style="color: var(--ink-muted);">Collectors are warned before leaving the offline object.</p>
      </div>
      <button type="button" class="btn-ghost text-xs" on:click={addLink}>＋ Add link</button>
    </div>
    {#each $extras.links as link (link.id)}
      <div class="rounded-xl p-3 space-y-2" style="background: rgba(255,255,255,.03); border: 1px solid var(--border-dim);">
        <div class="flex gap-2">
          <input class="input-dark flex-1" aria-label="Link label" value={link.label} placeholder="Merch, tickets, artist site…"
            on:input={(event) => updateLink(link.id, { label: event.currentTarget.value })} />
          <select class="input-dark w-28" aria-label="Link type" value={link.kind}
            on:change={(event) => updateLink(link.id, { kind: event.currentTarget.value })}>
            <option value="artist">Artist</option><option value="merch">Merch</option><option value="tickets">Tickets</option><option value="platform">Platform</option>
          </select>
        </div>
        <div class="flex gap-2">
          <input class="input-dark flex-1 font-mono text-xs" aria-label="Link URL" value={link.url} placeholder="https://…"
            on:input={(event) => updateLink(link.id, { url: event.currentTarget.value })} />
          <button type="button" class="btn-ghost text-xs" aria-label="Remove link" on:click={() => removeLink(link.id)}>Remove</button>
        </div>
      </div>
    {/each}
  </div>

  <div class="pt-5 border-t" style="border-color: var(--border-dim);">
    <StepPlay />
  </div>
</div>
