<script>
  export let data;
  $: ({ waitlistCount, userCount, recentWaitlist, recentUsers } = data);

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
  <div class="mb-8">
    <p class="t-caption mb-2">Overview</p>
    <h1 class="text-3xl font-black text-white">Dashboard</h1>
  </div>

  <!-- Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
    {#each [
      { label: 'Waitlist', value: waitlistCount ?? 0, color: '#7B5CF0', href: '/admin/waitlist' },
      { label: 'Users',    value: userCount ?? 0,    color: '#4B6BF0', href: '/admin/users' },
      { label: 'Creators', value: '—', color: '#F04BD8', href: '/admin/users' },
      { label: 'Revenue',  value: '—', color: '#c8a96e', href: '#' },
    ] as stat}
      <a href={stat.href} class="glass rounded-2xl p-5 hover:border-opacity-50 transition-all duration-200 block">
        <p class="t-caption mb-2" style="color: {stat.color};">{stat.label}</p>
        <p class="text-3xl font-black text-white">{stat.value}</p>
      </a>
    {/each}
  </div>

  <div class="grid md:grid-cols-2 gap-6">
    <!-- Recent waitlist -->
    <div class="glass rounded-2xl overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b" style="border-color: var(--border-dim);">
        <p class="font-bold text-white text-sm">Recent Waitlist</p>
        <a href="/admin/waitlist" class="text-xs" style="color: #7B5CF0;">View all →</a>
      </div>
      {#if recentWaitlist?.length}
        {#each recentWaitlist as entry}
          <div class="flex items-center justify-between px-5 py-3 border-b last:border-0"
            style="border-color: var(--border-dim);">
            <div>
              <p class="text-sm text-white font-medium">{entry.email}</p>
              <p class="text-xs" style="color: var(--ink-muted);">{entry.role} · {timeAgo(entry.created_at)}</p>
            </div>
            <a href="/admin/waitlist" class="text-xs px-3 py-1 rounded-full font-semibold"
              style="background: rgba(123,92,240,0.12); color: #7B5CF0; border: 1px solid rgba(123,92,240,0.25);">
              Invite
            </a>
          </div>
        {/each}
      {:else}
        <p class="px-5 py-8 text-sm text-center" style="color: var(--ink-muted);">No waitlist entries yet</p>
      {/if}
    </div>

    <!-- Recent users -->
    <div class="glass rounded-2xl overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b" style="border-color: var(--border-dim);">
        <p class="font-bold text-white text-sm">Recent Users</p>
        <a href="/admin/users" class="text-xs" style="color: #4B6BF0;">View all →</a>
      </div>
      {#if recentUsers?.length}
        {#each recentUsers as u}
          <div class="flex items-center justify-between px-5 py-3 border-b last:border-0"
            style="border-color: var(--border-dim);">
            <div>
              <p class="text-sm text-white font-medium">{u.display_name || u.email}</p>
              <p class="text-xs" style="color: var(--ink-muted);">{u.role} · {timeAgo(u.created_at)}</p>
            </div>
            <span class="text-xs px-2 py-0.5 rounded-full font-mono"
              style="background: rgba(255,255,255,0.05); color: var(--ink-muted);">{u.role}</span>
          </div>
        {/each}
      {:else}
        <p class="px-5 py-8 text-sm text-center" style="color: var(--ink-muted);">No users yet</p>
      {/if}
    </div>
  </div>
</div>
