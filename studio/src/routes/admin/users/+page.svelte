<script>
  import { enhance } from '$app/forms';
  export let data;
  export let form;

  $: users = data.users ?? [];
  let search = '';
  $: filtered = users.filter(u =>
    (u.email ?? '').includes(search.toLowerCase()) ||
    (u.display_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts);
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  let confirmDelete = null;
</script>

<div class="max-w-5xl mx-auto px-6 py-8">
  <div class="mb-8 flex items-end justify-between flex-wrap gap-4">
    <div>
      <p class="t-caption mb-2">Admin</p>
      <h1 class="text-3xl font-black text-white">Users</h1>
      <p class="text-sm mt-1" style="color: var(--ink-muted);">{users.length} accounts</p>
    </div>
    <input type="text" bind:value={search} placeholder="Search users…"
      class="input-dark w-60 rounded-full" style="padding-left: 16px; padding-right: 16px;" />
  </div>

  {#if form?.error}
    <div class="rounded-xl px-5 py-3 mb-5 text-sm" style="background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.2);">
      {form.error}
    </div>
  {/if}

  <div class="glass rounded-2xl overflow-hidden">
    <table class="w-full">
      <thead>
        <tr class="border-b text-left" style="border-color: var(--border-dim);">
          <th class="px-5 py-3 t-caption">User</th>
          <th class="px-5 py-3 t-caption">Role</th>
          <th class="px-5 py-3 t-caption">Admin</th>
          <th class="px-5 py-3 t-caption">Joined</th>
          <th class="px-5 py-3 t-caption">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as u (u.id)}
          <tr class="border-b last:border-0 transition-colors hover:bg-white/[0.02]"
            style="border-color: var(--border-dim);">
            <td class="px-5 py-3.5">
              <p class="text-sm font-medium text-white">{u.display_name || '—'}</p>
              <p class="text-xs font-mono" style="color: var(--ink-muted);">{u.email}</p>
            </td>
            <td class="px-5 py-3.5">
              <form method="POST" action="?/changeRole" use:enhance>
                <input type="hidden" name="id" value={u.id} />
                <select name="role" onchange="this.form.submit()"
                  class="text-xs rounded-full px-2 py-0.5 font-mono border-0 cursor-pointer"
                  style={u.role === 'creator'
                    ? 'background: rgba(123,92,240,0.12); color: #7B5CF0;'
                    : 'background: rgba(75,107,240,0.12); color: #4B6BF0;'}>
                  <option value="creator"  selected={u.role === 'creator'}>creator</option>
                  <option value="collector" selected={u.role === 'collector'}>collector</option>
                </select>
              </form>
            </td>
            <td class="px-5 py-3.5">
              <form method="POST" action="?/toggleAdmin" use:enhance>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="is_admin" value={u.is_admin ? 'true' : 'false'} />
                <button type="submit"
                  class="text-xs px-2 py-0.5 rounded-full font-mono border transition-colors"
                  style={u.is_admin
                    ? 'background: rgba(240,75,216,0.12); color: #F04BD8; border-color: rgba(240,75,216,0.25);'
                    : 'background: rgba(255,255,255,0.04); color: var(--ink-muted); border-color: rgba(255,255,255,0.08);'}>
                  {u.is_admin ? 'Admin' : 'User'}
                </button>
              </form>
            </td>
            <td class="px-5 py-3.5 text-xs font-mono" style="color: var(--ink-muted);">{timeAgo(u.created_at)}</td>
            <td class="px-5 py-3.5">
              {#if confirmDelete === u.id}
                <div class="flex items-center gap-2">
                  <span class="text-xs" style="color: #f87171;">Sure?</span>
                  <form method="POST" action="?/deleteUser" use:enhance={() => {
                    confirmDelete = null;
                    return ({ update }) => update();
                  }}>
                    <input type="hidden" name="id" value={u.id} />
                    <button type="submit" class="text-xs px-2 py-0.5 rounded" style="background: rgba(248,113,113,0.15); color: #f87171;">Delete</button>
                  </form>
                  <button onclick={() => confirmDelete = null}
                    class="text-xs px-2 py-0.5 rounded" style="color: var(--ink-muted);">Cancel</button>
                </div>
              {:else}
                <button onclick={() => confirmDelete = u.id}
                  class="text-xs px-3 py-1 rounded-full transition-colors"
                  style="color: var(--ink-muted);" title="Delete user">✕</button>
              {/if}
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="5" class="px-5 py-12 text-center text-sm" style="color: var(--ink-muted);">
              {search ? 'No users match your search.' : 'No users yet.'}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
