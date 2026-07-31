<script>
  import { identity } from '$lib/stores/package.js';
  import { RELEASE_TYPES, RELEASE_TYPE_LABELS } from '$lib/domain/release.js';

  function setList(field, value) {
    identity.update((current) => ({
      ...current,
      [field]: String(value).split(',').map((entry) => entry.trim()).filter(Boolean),
    }));
  }
</script>

<div class="space-y-5">
  <div>
    <p class="t-caption mb-2">Step 1</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Release identity</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">Define the complete release. Individual works come next.</p>
  </div>

  <div>
    <label class="label-dark" for="release_type">Release type *</label>
    <select id="release_type" class="input-dark" bind:value={$identity.release_type}>
      {#each RELEASE_TYPES as releaseType}
        <option value={releaseType}>{RELEASE_TYPE_LABELS[releaseType]}</option>
      {/each}
    </select>
  </div>

  <div>
    <label class="label-dark" for="title">Release title *</label>
    <input id="title" class="input-dark" type="text" bind:value={$identity.title} placeholder="Single, EP, album, mix, or collection title" />
  </div>

  <div>
    <label class="label-dark" for="artist">Primary artist *</label>
    <input id="artist" class="input-dark" type="text" bind:value={$identity.artist} placeholder={$identity.release_type === 'compilation' ? 'Compiler, curator, or release artist' : 'Artist or band name'} />
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div>
      <label class="label-dark" for="featured_artists">Featured artists</label>
      <input id="featured_artists" class="input-dark" type="text" value={$identity.featured_artists.join(', ')}
        on:input={(event) => setList('featured_artists', event.currentTarget.value)} placeholder="Comma-separated" />
    </div>
    {#if $identity.release_type === 'compilation'}
      <div>
        <label class="label-dark" for="compilation_artists">Compilation artists</label>
        <input id="compilation_artists" class="input-dark" type="text" value={$identity.compilation_artists.join(', ')}
          on:input={(event) => setList('compilation_artists', event.currentTarget.value)} placeholder="Various artists" />
      </div>
    {:else}
      <div>
        <label class="label-dark" for="label">Label</label>
        <input id="label" class="input-dark" type="text" bind:value={$identity.label} placeholder="Independent or label name" />
      </div>
    {/if}
  </div>

  {#if $identity.release_type === 'compilation'}
    <div class="grid grid-cols-2 gap-3">
      <div><label class="label-dark" for="curator">Curator</label><input id="curator" class="input-dark" type="text" bind:value={$identity.curator} /></div>
      <div><label class="label-dark" for="compiler">Compiler</label><input id="compiler" class="input-dark" type="text" bind:value={$identity.compiler} /></div>
    </div>
  {/if}

  {#if $identity.release_type === 'live_release'}
    <div class="grid grid-cols-2 gap-3">
      <div><label class="label-dark" for="event_name">Event name</label><input id="event_name" class="input-dark" type="text" bind:value={$identity.event_name} placeholder="Concert or session" /></div>
      <div><label class="label-dark" for="venue">Venue</label><input id="venue" class="input-dark" type="text" bind:value={$identity.venue} placeholder="Venue and city" /></div>
      <div><label class="label-dark" for="recording_date">Recording date</label><input id="recording_date" class="input-dark" type="date" bind:value={$identity.recording_date} /></div>
    </div>
  {/if}

  <div class="grid grid-cols-2 gap-3">
    <div>
      <label class="label-dark" for="year">Year *</label>
      <input id="year" class="input-dark" type="number" min="1000" max="2999" bind:value={$identity.year} placeholder="2026" />
    </div>
    <div>
      <label class="label-dark" for="release_date">Release date</label>
      <input id="release_date" class="input-dark" type="date" bind:value={$identity.release_date} />
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div>
      <label class="label-dark" for="genre">Genres</label>
      <input id="genre" class="input-dark" type="text" bind:value={$identity.genre} placeholder="Afro-Soul, Jazz" />
    </div>
    <div>
      <label class="label-dark" for="location">Location</label>
      <input id="location" class="input-dark" type="text" bind:value={$identity.location} placeholder="Nairobi, KE" />
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div>
      <label class="label-dark" for="catalogue_number">Catalogue number</label>
      <input id="catalogue_number" class="input-dark font-mono text-xs" type="text" bind:value={$identity.catalogue_number} placeholder="NZ-001" />
    </div>
    {#if $identity.release_type === 'compilation'}
      <div>
        <label class="label-dark" for="label">Label</label>
        <input id="label" class="input-dark" type="text" bind:value={$identity.label} placeholder="Independent or label name" />
      </div>
    {:else}
      <div>
        <label class="label-dark" for="release_id">Stable release ID</label>
        <input id="release_id" class="input-dark font-mono text-xs" type="text" value={$identity.release_id} readonly />
      </div>
    {/if}
  </div>

  <div>
    <label class="label-dark" for="description">Release statement</label>
    <textarea id="description" class="input-dark resize-none" rows="4" bind:value={$identity.description} placeholder="Context for the complete work…"></textarea>
  </div>
</div>
