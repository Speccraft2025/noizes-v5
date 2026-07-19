<script>
  import { page } from '$app/stores';
  import WaveCanvas from '$lib/components/WaveCanvas.svelte';
  export let data;

  const nav = [
    { href: '/admin',          label: 'Overview',  icon: '◎' },
    { href: '/admin/waitlist', label: 'Waitlist',  icon: '◉' },
    { href: '/admin/users',    label: 'Users',     icon: '◈' },
    { href: '/admin/kyc',      label: 'KYC',       icon: '⬡' },
  ];
</script>

<div class="min-h-screen flex flex-col" style="background: var(--bg-deep);">
  <WaveCanvas />

  <!-- Top bar -->
  <header class="sticky top-0 z-50 border-b"
    style="background: rgba(3,3,3,0.9); backdrop-filter: blur(20px); border-color: rgba(240,75,216,0.2);">
    <div class="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
      <div class="flex items-center gap-3">
        <a href="/" class="font-black text-lg tracking-tight text-white">NOIZES</a>
        <span class="text-xs font-bold px-2 py-0.5 rounded-full"
          style="background: rgba(240,75,216,0.12); color: #F04BD8; border: 1px solid rgba(240,75,216,0.25);">
          ⬟ Admin
        </span>
      </div>
      <nav class="flex items-center gap-1">
        {#each nav as item}
          <a href={item.href}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-200"
            style={$page.url.pathname === item.href
              ? 'background: rgba(240,75,216,0.12); color: #fff; border: 1px solid rgba(240,75,216,0.25);'
              : 'color: var(--ink-tertiary); border: 1px solid transparent;'}>
            <span class="text-xs">{item.icon}</span>{item.label}
          </a>
        {/each}
      </nav>
      <div class="flex items-center gap-3">
        <a href="/exchange" class="btn-ghost py-1.5 px-4 text-xs rounded-full">← App</a>
        <a href="/auth/logout" class="text-xs font-semibold" style="color: var(--ink-muted);">Sign out</a>
      </div>
    </div>
  </header>

  <main class="flex-1 relative z-10">
    <slot />
  </main>
</div>
