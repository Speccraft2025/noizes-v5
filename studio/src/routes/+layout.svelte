<script>
  import '../app.css';
  import { page } from '$app/stores';
  import WaveCanvas from '$lib/components/WaveCanvas.svelte';

  const navItems = [
    { label: 'Studio', href: '/studio', icon: '◈' },
    { label: 'Exchange', href: '/exchange', icon: '⬡' },
    { label: 'Collection', href: '/collection', icon: '◉' },
    { label: 'Validator', href: '/validator', icon: '◎' },
  ];
</script>

<div class="min-h-screen flex flex-col relative" style="background: var(--bg-deep);">
  <WaveCanvas />

  <!-- Top nav -->
  <header class="sticky top-0 z-50 border-b" style="background: rgba(3,3,3,0.85); backdrop-filter: blur(20px); border-color: var(--border-dim);">
    <div class="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
      <a href="/studio" class="flex items-center gap-2">
        <span class="font-black text-lg tracking-tight text-white">NOIZES</span>
        <span class="text-xs font-semibold px-2 py-0.5 rounded-full" style="background: var(--spectral-violet-glow); color: var(--spectral-violet); border: 1px solid rgba(123,92,240,0.3);">v5</span>
      </a>

      <nav class="flex items-center gap-1">
        {#each navItems as item}
          <a
            href={item.href}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-200"
            style={$page.url.pathname.startsWith(item.href)
              ? 'background: rgba(123,92,240,0.15); color: #fff; border: 1px solid rgba(123,92,240,0.3);'
              : 'color: var(--ink-tertiary); border: 1px solid transparent;'}
          >
            <span class="text-xs opacity-60">{item.icon}</span>
            {item.label}
          </a>
        {/each}
      </nav>

      <button class="btn-spectral py-2 px-5 text-sm">Connect</button>
    </div>
  </header>

  <main class="flex-1 relative z-10">
    <slot />
  </main>
</div>
