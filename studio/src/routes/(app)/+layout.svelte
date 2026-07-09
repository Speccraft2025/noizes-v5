<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import WaveCanvas from '$lib/components/WaveCanvas.svelte';

  export let data;
  $: ({ profile, user } = data);
  $: isCreator = profile?.role === 'creator';
  $: isAdmin = profile?.is_admin === true;

  let mobileMenuOpen = false;

  const navItems = [
    { label: 'Studio',     href: '/studio',     icon: '◈', creatorOnly: true },
    { label: 'Exchange',   href: '/exchange',   icon: '⬡', creatorOnly: false },
    { label: 'Collection', href: '/collection', icon: '◉', creatorOnly: false },
    { label: 'Validator',  href: '/validator',  icon: '◎', creatorOnly: false },
    { label: 'Open .nz',  href: '/open',        icon: '⬟', creatorOnly: false },
  ];

  $: visibleNav = navItems.filter(n => !n.creatorOnly || isCreator);
  $: if ($page.url.pathname) mobileMenuOpen = false;
</script>

<div class="min-h-screen flex flex-col relative" style="background: var(--bg-deep);">
  <WaveCanvas />

  <header class="sticky top-0 z-50 border-b"
    style="background: rgba(3,3,3,0.92); backdrop-filter: blur(20px); border-color: var(--border-dim);">
    <div class="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-14">

      <!-- Logo -->
      <a href="/" class="flex items-center gap-2 shrink-0">
        <img src="/logo-wordmark.png" alt="NOIZES" class="h-7 w-auto" />
      </a>

      <!-- Desktop nav -->
      <nav class="hidden md:flex items-center gap-1">
        {#each visibleNav as item}
          <a href={item.href}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-200"
            style={$page.url.pathname.startsWith(item.href)
              ? 'background: rgba(123,92,240,0.15); color: #fff; border: 1px solid rgba(123,92,240,0.3);'
              : 'color: var(--ink-tertiary); border: 1px solid transparent;'}>
            <span class="text-xs opacity-60">{item.icon}</span>{item.label}
          </a>
        {/each}
      </nav>

      <!-- Desktop right -->
      <div class="hidden md:flex items-center gap-3">
        {#if user}
          {#if isAdmin}
            <a href="/admin" class="text-xs font-mono px-2 py-1 rounded-full"
              style="background: rgba(240,75,216,0.1); color: #F04BD8; border: 1px solid rgba(240,75,216,0.25);">⬟ Admin</a>
          {/if}
          <span class="text-xs font-mono px-2 py-1 rounded-full"
            style="background: rgba(255,255,255,0.05); color: var(--ink-muted);">
            {isCreator ? '◈ Creator' : '◉ Collector'}
          </span>
          <span class="text-sm font-semibold" style="color: var(--ink-secondary);">
            {profile?.display_name || user.email?.split('@')[0]}
          </span>
          <a href="/auth/logout" class="btn-ghost py-1.5 px-4 text-xs rounded-full">Sign out</a>
        {:else}
          <a href="/auth/login" class="btn-ghost py-1.5 px-4 text-sm rounded-full">Sign in</a>
        {/if}
      </div>

      <!-- Mobile right: user initial + hamburger -->
      <div class="flex md:hidden items-center gap-2">
        {#if user}
          <span class="text-xs font-mono" style="color: var(--ink-muted);">
            {profile?.display_name || user.email?.split('@')[0]}
          </span>
        {/if}
        <button on:click={() => mobileMenuOpen = !mobileMenuOpen}
          class="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-xl"
          style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-dim);"
          aria-label="Menu">
          <span class="block w-4 h-px transition-all" style="background: {mobileMenuOpen ? '#7B5CF0' : '#666'};"></span>
          <span class="block w-4 h-px" style="background: {mobileMenuOpen ? '#7B5CF0' : '#666'};"></span>
          <span class="block w-4 h-px transition-all" style="background: {mobileMenuOpen ? '#7B5CF0' : '#666'};"></span>
        </button>
      </div>
    </div>

    <!-- Mobile menu dropdown -->
    {#if mobileMenuOpen}
      <div class="md:hidden border-t px-4 py-3 flex flex-col gap-1"
        style="background: rgba(3,3,3,0.97); border-color: var(--border-dim);">
        {#each visibleNav as item}
          <a href={item.href}
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={$page.url.pathname.startsWith(item.href)
              ? 'background: rgba(123,92,240,0.12); color: #fff;'
              : 'color: var(--ink-secondary);'}>
            <span style="color: #7B5CF0;">{item.icon}</span>{item.label}
          </a>
        {/each}
        <div class="mt-2 pt-2 border-t flex flex-col gap-1" style="border-color: var(--border-dim);">
          {#if user}
            {#if isAdmin}
              <a href="/admin" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold"
                style="color: #F04BD8;">⬟ Admin</a>
            {/if}
            <a href="/auth/logout" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold"
              style="color: var(--ink-muted);">Sign out</a>
          {:else}
            <a href="/auth/login" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold"
              style="color: #7B5CF0;">Sign in →</a>
          {/if}
        </div>
      </div>
    {/if}
  </header>

  <main class="flex-1 relative z-10">
    <slot />
  </main>
</div>
