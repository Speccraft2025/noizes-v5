<script>
  import HelpTip from './HelpTip.svelte';
  import { extras, releaseProject, EASTER_EGG_TRIGGERS } from '$lib/stores/package.js';
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

  function addImages(event) {
    const files = [...(event.currentTarget.files || [])].filter((file) => file.type.startsWith('image/'));
    extras.update((value) => ({
      ...value,
      images: [...value.images, ...files.map((file) => ({
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^.]+$/, ''),
        name: file.name,
        file,
        caption: '',
      }))]
    }));
    event.currentTarget.value = '';
  }

  function updateImage(id, patch) {
    extras.update((value) => ({ ...value, images: value.images.map((img) => img.id === id ? { ...img, ...patch } : img) }));
  }

  function removeImage(id) {
    extras.update((value) => ({ ...value, images: value.images.filter((img) => img.id !== id) }));
  }

  function addEasterEgg() {
    extras.update((value) => ({
      ...value,
      easter_eggs: [...value.easter_eggs, {
        id: crypto.randomUUID(),
        message: '',
        trigger: 'after_full_listen',
        track_index: 0,
        seconds: 0,
        taps: 7,
      }]
    }));
  }

  function updateEasterEgg(id, patch) {
    extras.update((value) => ({
      ...value,
      easter_eggs: value.easter_eggs.map((egg) => egg.id === id ? { ...egg, ...patch } : egg),
    }));
  }

  function removeEasterEgg(id) {
    extras.update((value) => ({ ...value, easter_eggs: value.easter_eggs.filter((egg) => egg.id !== id) }));
  }

  $: trackList = ($releaseProject.tracks || []).map((t, i) => ({ index: i, title: t.title || `Track ${i + 1}` }));
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

  <!-- ── Dedication ──────────────────────────────────────────────────── -->
  <div>
    <label class="label-dark" for="dedication">Dedication<HelpTip field="dedication" /></label>
    <input id="dedication" class="input-dark" bind:value={$extras.dedication}
      maxlength="280" placeholder="For…" />
    <p class="text-xs mt-1 text-right" style="color: var(--ink-muted);">{$extras.dedication.length} / 280</p>
  </div>

  <!-- ── Collector's Note ────────────────────────────────────────────── -->
  <div>
    <label class="label-dark" for="collector-note">Collector's note<HelpTip field="collector_note" /></label>
    <textarea id="collector-note" class="input-dark resize-none" rows="4" bind:value={$extras.collector_note}
      maxlength="2000" placeholder="A personal message to whoever opens this object…"></textarea>
    <p class="text-xs mt-1" style="color: var(--ink-muted);">
      {#if $extras.collector_note.trim()}
        Appears after the collector finishes the guided experience — a private gift from you to them.
      {:else}
        Optional. A handwritten-feeling note the collector finds at the end.
      {/if}
    </p>
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

  <!-- ── Liner Images ────────────────────────────────────────────────── -->
  <div class="space-y-3">
    <div>
      <p class="label-dark mb-0">Liner images<HelpTip field="liner_images" /></p>
      <p class="text-xs" style="color: var(--ink-muted);">Photos and artwork beyond the cover — session shots, process, alternate visuals. They ship inside the package.</p>
    </div>
    <label class="glass rounded-xl flex items-center justify-center gap-3 py-5 cursor-pointer" style="border-style: dashed;">
      <span class="text-violet text-lg">◐</span>
      <span class="text-sm text-white">Add images</span>
      <input type="file" class="hidden" accept="image/*" multiple on:change={addImages} />
    </label>
    {#each $extras.images as img (img.id)}
      <div class="rounded-xl p-3 flex items-center gap-3" style="background: rgba(255,255,255,.03); border: 1px solid var(--border-dim);">
        <span class="text-violet">◐</span>
        <div class="flex-1 min-w-0 space-y-1">
          <input class="w-full bg-transparent text-sm font-bold text-white outline-none" value={img.title}
            aria-label="Image title" on:input={(event) => updateImage(img.id, { title: event.currentTarget.value })} />
          <input class="w-full bg-transparent text-xs outline-none" style="color: var(--ink-muted);" value={img.caption}
            aria-label="Image caption" placeholder="Caption (optional)"
            on:input={(event) => updateImage(img.id, { caption: event.currentTarget.value })} />
          <p class="text-xs truncate" style="color: var(--ink-muted);">{img.name}</p>
        </div>
        <button type="button" class="btn-ghost text-xs" on:click={() => removeImage(img.id)}>Remove</button>
      </div>
    {/each}
  </div>

  <!-- ── Easter Eggs ─────────────────────────────────────────────────── -->
  <div class="space-y-3 pt-5 border-t" style="border-color: var(--border-dim);">
    <div class="flex justify-between items-center">
      <div>
        <p class="label-dark mb-0">Easter eggs<HelpTip field="easter_eggs" /></p>
        <p class="text-xs" style="color: var(--ink-muted);">Hidden messages a collector discovers through the experience — rewards for attention.</p>
      </div>
      <button type="button" class="btn-ghost text-xs" on:click={addEasterEgg}>＋ Add egg</button>
    </div>
    {#each $extras.easter_eggs as egg (egg.id)}
      <div class="rounded-xl p-3 space-y-2" style="background: rgba(255,255,255,.03); border: 1px solid var(--border-dim);">
        <div class="flex gap-2">
          <select class="input-dark w-44" aria-label="Trigger" value={egg.trigger}
            on:change={(event) => updateEasterEgg(egg.id, { trigger: event.currentTarget.value })}>
            {#each EASTER_EGG_TRIGGERS as t}
              <option value={t.id}>{t.name}</option>
            {/each}
          </select>
          <button type="button" class="btn-ghost text-xs ml-auto" on:click={() => removeEasterEgg(egg.id)}>Remove</button>
        </div>
        {#if egg.trigger === 'at_timestamp'}
          <div class="flex gap-2">
            <select class="input-dark flex-1" aria-label="Track" value={egg.track_index}
              on:change={(event) => updateEasterEgg(egg.id, { track_index: +event.currentTarget.value })}>
              {#each trackList as t}
                <option value={t.index}>{t.title}</option>
              {/each}
            </select>
            <div class="flex items-center gap-1">
              <input type="number" class="input-dark w-20 text-center" aria-label="Seconds" min="0" value={egg.seconds}
                on:input={(event) => updateEasterEgg(egg.id, { seconds: Math.max(0, +event.currentTarget.value || 0) })} />
              <span class="text-xs" style="color: var(--ink-muted);">sec</span>
            </div>
          </div>
        {/if}
        {#if egg.trigger === 'cover_tap'}
          <div class="flex items-center gap-2">
            <span class="text-xs" style="color: var(--ink-muted);">Tap the cover</span>
            <input type="number" class="input-dark w-16 text-center" aria-label="Tap count" min="3" max="20" value={egg.taps}
              on:input={(event) => updateEasterEgg(egg.id, { taps: Math.min(20, Math.max(3, +event.currentTarget.value || 7)) })} />
            <span class="text-xs" style="color: var(--ink-muted);">times to reveal</span>
          </div>
        {/if}
        <textarea class="input-dark resize-none text-sm" rows="2" aria-label="Hidden message" maxlength="500"
          value={egg.message} placeholder="The hidden message…"
          on:input={(event) => updateEasterEgg(egg.id, { message: event.currentTarget.value })}></textarea>
        <p class="text-xs" style="color: var(--ink-muted);">
          {EASTER_EGG_TRIGGERS.find((t) => t.id === egg.trigger)?.hint ?? ''}
        </p>
      </div>
    {/each}
    {#if !$extras.easter_eggs.length}
      <p class="text-xs" style="color: var(--ink-muted);">
        No hidden messages yet. Easter eggs are optional — add one when you have a secret worth hiding.
      </p>
    {/if}
  </div>

  <div class="pt-5 border-t" style="border-color: var(--border-dim);">
    <StepPlay />
  </div>
</div>
