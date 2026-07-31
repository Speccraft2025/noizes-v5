<script>
  import { enhance } from '$app/forms';
  export let data;
  export let form;
</script>

<svelte:head><title>Collector notes — Noizes Admin</title></svelte:head>

<div class="max-w-5xl mx-auto px-6 py-8">
  <div class="mb-8">
    <p class="t-caption mb-2">Moderation</p>
    <h1 class="text-3xl font-black text-white">Collector notes</h1>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">Hide abusive notes from Noizes without altering the signed provenance record.</p>
  </div>

  {#if data.loadError || form?.error}
    <div class="rounded-xl px-5 py-3 mb-5 text-sm text-red-400 glass">{data.loadError || form.error}</div>
  {/if}

  <div class="space-y-3">
    {#each data.notes as note (note.id)}
      <article class="glass rounded-xl p-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm text-white mb-2">“{note.body}”</p>
            <p class="text-xs" style="color: var(--ink-muted);">
              {note.profiles?.display_name || note.profiles?.email || 'Deleted user'} ·
              {note.acquisitions?.releases?.artist_name || 'Unknown artist'} — {note.acquisitions?.releases?.title || 'Unknown release'}
            </p>
          </div>
          <form method="POST" action={note.status === 'visible' ? '?/hide' : '?/restore'} use:enhance>
            <input type="hidden" name="id" value={note.id} />
            <button class="btn-ghost py-1.5 px-4 text-xs rounded-full" type="submit">
              {note.status === 'visible' ? 'Hide' : 'Restore'}
            </button>
          </form>
        </div>
      </article>
    {:else}
      <div class="glass rounded-2xl p-12 text-center text-sm" style="color: var(--ink-muted);">No collector notes yet.</div>
    {/each}
  </div>
</div>
