<script>
  import { identity } from '$lib/stores/package.js';
</script>

<div class="space-y-5">
  <div>
    <p class="t-caption mb-2">Step 1</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Identity</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">Define the work's core metadata.</p>
  </div>

  <div>
    <label class="label-dark" for="artist">Artist *</label>
    <input id="artist" class="input-dark" type="text" bind:value={$identity.artist} placeholder="Artist or band name" />
  </div>

  <div>
    <label class="label-dark" for="title">Title *</label>
    <input id="title" class="input-dark" type="text" bind:value={$identity.title} placeholder="Track or album title" />
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div>
      <label class="label-dark" for="release_id">Release ID</label>
      <input id="release_id" class="input-dark font-mono text-xs" type="text" bind:value={$identity.release_id} placeholder="nz-XXXXXX" />
    </div>
    <div>
      <label class="label-dark" for="year">Year *</label>
      <input id="year" class="input-dark" type="number" min="1900" max="2100" bind:value={$identity.year} placeholder="2024" />
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div>
      <label class="label-dark" for="genre">Genre</label>
      <input id="genre" class="input-dark" type="text" bind:value={$identity.genre} placeholder="e.g. Afro-Soul, Jazz" />
    </div>
    <div>
      <label class="label-dark" for="location">Location</label>
      <input id="location" class="input-dark" type="text" bind:value={$identity.location} placeholder="e.g. Nairobi, KE" />
    </div>
  </div>

  <div>
    <label class="label-dark" for="description">Description</label>
    <textarea id="description" class="input-dark resize-none" rows="4" bind:value={$identity.description} placeholder="A short note about this work…"></textarea>
  </div>
</div>
