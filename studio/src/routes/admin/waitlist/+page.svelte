<script>
  import { enhance } from '$app/forms';
  export let data;
  export let form;

  $: entries = data.entries ?? [];
  $: creators   = entries.filter(e => e.role === 'creator');
  $: collectors = entries.filter(e => e.role === 'collector');

  let inviting = {};
  let search = '';
  $: filtered = entries.filter(e => e.email.includes(search.toLowerCase()));

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts);
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
</script>

<div class="max-w-5xl mx-auto px-6 py-8">
  <div class="mb-8 flex items-end justify-between flex-wrap gap-4">
    <div>
      <p class="t-caption mb-2">Admin</p>
      <h1 class="text-3xl font-black text-white">Waitlist</h1>
      <p class="text-sm mt-1" style="color: var(--ink-muted);">
        {entries.length} total · {creators.length} creators · {collectors.length} collectors
      </p>
    </div>
    <input type="text" bind:value={search} placeholder="Search emails…"
      class="input-dark w-60 rounded-full" style="padding-left: 16px; padding-right: 16px;" />
  </div>

  {#if form?.invited}
    <div class="glass rounded-xl px-5 py-3 mb-5 text-sm flex items-center gap-2"
      style="border-color: rgba(123,92,240,0.3);">
      <span style="color: #7B5CF0;">✓</span>
      <span class="text-white">Invite sent to <strong>{form.invited}</strong> — they'll receive an email to set their password.</span>
    </div>
  {/if}

  {#if form?.inviteError}
    <div class="rounded-xl px-5 py-3 mb-5 text-sm" style="background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.2);">
      Failed to invite {form.failedEmail}: {form.inviteError}
    </div>
  {/if}

  <div class="glass rounded-2xl overflow-hidden">
    <table class="w-full">
      <thead>
        <tr class="border-b text-left" style="border-color: var(--border-dim);">
          <th class="px-5 py-3 t-caption">Email</th>
          <th class="px-5 py-3 t-caption">Role</th>
          <th class="px-5 py-3 t-caption">Joined</th>
          <th class="px-5 py-3 t-caption">Status</th>
          <th class="px-5 py-3 t-caption">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as entry (entry.id)}
          <tr class="border-b last:border-0 transition-colors hover:bg-white/[0.02]"
            style="border-color: var(--border-dim);">
            <td class="px-5 py-3.5 text-sm font-medium text-white">{entry.email}</td>
            <td class="px-5 py-3.5">
              <span class="text-xs px-2 py-0.5 rounded-full font-mono"
                style={entry.role === 'creator'
                  ? 'background: rgba(123,92,240,0.12); color: #7B5CF0;'
                  : 'background: rgba(75,107,240,0.12); color: #4B6BF0;'}>
                {entry.role}
              </span>
            </td>
            <td class="px-5 py-3.5 text-xs font-mono" style="color: var(--ink-muted);">{timeAgo(entry.created_at)}</td>
            <td class="px-5 py-3.5">
              {#if entry.invited}
                <span class="text-xs px-2 py-0.5 rounded-full font-mono"
                  style="background: rgba(74,222,128,0.1); color: #4ade80;">Invited</span>
              {:else}
                <span class="text-xs px-2 py-0.5 rounded-full font-mono"
                  style="background: rgba(255,255,255,0.05); color: var(--ink-muted);">Pending</span>
              {/if}
            </td>
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-2">
                {#if !entry.invited}
                  <form method="POST" action="?/invite"
                    use:enhance={() => {
                      inviting[entry.id] = true;
                      return async ({ update }) => { inviting[entry.id] = false; update(); };
                    }}>
                    <input type="hidden" name="email" value={entry.email} />
                    <input type="hidden" name="role"  value={entry.role} />
                    <button type="submit" class="btn-spectral py-1 px-3 text-xs rounded-full"
                      disabled={inviting[entry.id]}>
                      {inviting[entry.id] ? '…' : 'Invite'}
                    </button>
                  </form>
                {/if}
                <form method="POST" action="?/delete"
                  use:enhance={() => ({ update }) => update()}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button type="submit" class="text-xs px-3 py-1 rounded-full transition-colors"
                    style="color: var(--ink-muted);" title="Remove from waitlist">✕</button>
                </form>
              </div>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="5" class="px-5 py-12 text-center text-sm" style="color: var(--ink-muted);">
              {search ? 'No entries match your search.' : 'Waitlist is empty.'}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
