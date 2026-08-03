<script>
  import HelpTip from './HelpTip.svelte';
  import { extras, releaseProject } from '$lib/stores/package.js';
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

  function addPdfs(event) {
    const files = [...(event.currentTarget.files || [])].filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    extras.update((value) => ({
      ...value,
      pdfs: [...value.pdfs, ...files.map((file) => ({ id: crypto.randomUUID(), title: file.name.replace(/\.pdf$/i, ''), name: file.name, file }))]
    }));
    event.currentTarget.value = '';
  }

  function renamePdf(id, title) {
    extras.update((value) => ({ ...value, pdfs: value.pdfs.map((pdf) => pdf.id === id ? { ...pdf, title } : pdf) }));
  }

  function removePdf(id) {
    extras.update((value) => ({ ...value, pdfs: value.pdfs.filter((pdf) => pdf.id !== id) }));
    releaseProject.update((project) => ({
      ...project,
      rights: {
        ...project.rights,
        asset_permissions: (project.rights.asset_permissions || []).filter((permission) => permission.asset_id !== id),
      },
    }));
  }
</script>

<div class="space-y-7">
  <div>
    <p class="t-caption mb-2">Step 5</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Extras</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">Add context, interactive moments, and deliberate online pathways around the music.</p>
  </div>

  <div>
    <label class="label-dark" for="artist-story">Artist statement or liner note<HelpTip field="story" /></label>
    <textarea id="artist-story" class="input-dark resize-none" rows="6" bind:value={$extras.story}
      maxlength="20000" placeholder="Tell listeners what lives behind this work…"></textarea>
    <p class="text-xs mt-1 text-right" style="color: var(--ink-muted);">{$extras.story.length} / 20,000</p>
  </div>

  <div class="space-y-3">
    <div class="flex justify-between items-center">
      <div>
        <p class="label-dark mb-0">Optional online links<HelpTip field="extras_links" /></p>
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

  <div class="space-y-3">
    <div>
      <p class="label-dark mb-0">Note wall<HelpTip field="note_wall" /></p>
      <p class="text-xs" style="color: var(--ink-muted);">PDF liner notes and booklets become tactile objects pinned inside the experience.</p>
    </div>
    <label class="glass rounded-xl flex items-center justify-center gap-3 py-5 cursor-pointer" style="border-style: dashed;">
      <span class="text-violet text-lg">▤</span>
      <span class="text-sm text-white">Add PDF notes</span>
      <input type="file" class="hidden" accept="application/pdf,.pdf" multiple on:change={addPdfs} />
    </label>
    {#each $extras.pdfs as pdf (pdf.id)}
      <div class="rounded-xl p-3 flex items-center gap-3" style="background: rgba(255,255,255,.03); border: 1px solid var(--border-dim);">
        <span class="text-violet">▤</span>
        <div class="flex-1 min-w-0">
          <input class="w-full bg-transparent text-sm font-bold text-white outline-none" value={pdf.title}
            aria-label="PDF note title" on:input={(event) => renamePdf(pdf.id, event.currentTarget.value)} />
          <p class="text-xs truncate" style="color: var(--ink-muted);">{pdf.name}</p>
        </div>
        <button type="button" class="btn-ghost text-xs" on:click={() => removePdf(pdf.id)}>Remove</button>
      </div>
    {/each}
  </div>

  <div class="pt-5 border-t" style="border-color: var(--border-dim);">
    <StepPlay />
  </div>
</div>
