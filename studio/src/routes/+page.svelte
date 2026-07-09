<script>
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';
  import WaveCanvas from '$lib/components/WaveCanvas.svelte';
  export let form;

  let role = 'collector';
  let loading = false;
  let visible = {};
  let installPrompt = null;
  let showInstall = false;

  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) visible[e.target.dataset.reveal] = true; }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      installPrompt = e;
      showInstall = true;
    });

    return () => observer.disconnect();
  });

  async function installPWA() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') showInstall = false;
  }

  const timeline = [
    { era: '1950s', format: 'Vinyl LPs',       desc: 'Warmth. Ritual. Something you could hold.' },
    { era: '1970s', format: 'Cassette Tapes',  desc: 'Portable. Personal. Mixed for someone.' },
    { era: '1980s', format: 'Compact Discs',   desc: 'Digital clarity. The beginning of the copy.' },
    { era: '2000s', format: 'MP3 & Streaming', desc: 'Infinite access. Zero ownership. Music became background.' },
    { era: 'Now',   format: 'Noizes',          desc: 'A new format. Music as a complete, ownable cultural object.', highlight: true },
  ];
</script>

<svelte:head><title>Noizes — Music as a Cultural Object</title></svelte:head>

<div class="relative overflow-x-hidden" style="background: var(--bg-deep); color: var(--parchment);">
  <WaveCanvas />

  <!-- NAV -->
  <nav class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-14 border-b"
    style="background: rgba(3,3,3,0.85); backdrop-filter: blur(20px); border-color: var(--border-dim);">
    <img src="/logo-wordmark.png" alt="NOIZES" class="h-7 w-auto" />
    <div class="flex items-center gap-2">
      {#if showInstall}
        <button on:click={installPWA}
          class="text-xs font-semibold px-4 py-1.5 rounded-full transition-all"
          style="background: rgba(123,92,240,0.12); color: #7B5CF0; border: 1px solid rgba(123,92,240,0.25);">
          ⬟ Install App
        </button>
      {/if}
      <a href="/auth/login" class="btn-ghost py-1.5 px-5 text-sm rounded-full">Sign in</a>
    </div>
  </nav>

  <!-- ══ HERO ══ -->
  <section class="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-14 pb-20">
    <div class="relative z-10 max-w-4xl mx-auto">
      <p class="t-caption mb-6">Music was never meant to be just a file.</p>

      <h1 class="t-monumental text-white mb-6">
        An experience,<br />
        <span class="gradient-text">not a stream.</span>
      </h1>

      <p class="text-lg max-w-xl mx-auto mb-12 leading-relaxed" style="color: var(--ink-secondary);">
        We compressed music until we compressed its worth.<br />
        Noizes rebuilds the format — music as a complete, ownable object.
      </p>

      <!-- GATE 1: Waitlist -->
      {#if form?.success}
        <div class="inline-flex items-center gap-3 px-6 py-4 rounded-2xl"
          style="background: rgba(123,92,240,0.12); border: 1px solid rgba(123,92,240,0.3);">
          <span style="color: #7B5CF0; font-size: 1.1rem;">✓</span>
          <div class="text-left">
            <p class="text-sm font-bold text-white">You're on the list.</p>
            <p class="text-xs mt-0.5" style="color: var(--ink-muted);">You'll receive an invite email from Noizes when your access is ready.</p>
          </div>
        </div>
      {:else}
        <div class="max-w-md mx-auto">
          <div class="flex items-center justify-center gap-2 mb-4">
            {#each [['collector', '◉ Collector'], ['creator', '◈ Creator']] as [val, label]}
              <button type="button"
                class="px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200"
                style={role === val
                  ? 'background: var(--gradient-spectral); color: #fff;'
                  : 'background: rgba(255,255,255,0.05); color: var(--ink-muted); border: 1px solid var(--border-dim);'}
                on:click={() => role = val}>{label}</button>
            {/each}
          </div>

          <form method="POST" action="?/waitlist"
            use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }}>
            <input type="hidden" name="role" value={role} />
            <div class="flex gap-2">
              <input type="email" name="email" required placeholder="your@email.com"
                class="input-dark flex-1" style="border-radius: 99px; padding-left: 20px;" />
              <button type="submit" class="btn-spectral rounded-full px-6 shrink-0" disabled={loading}>
                {loading ? '…' : 'Request access'}
              </button>
            </div>
            {#if form?.error}
              <p class="text-xs mt-2 text-red-400">{form.error}</p>
            {/if}
          </form>

          <p class="text-xs mt-4" style="color: var(--ink-muted);">
            Have an account? <a href="/auth/login" class="text-white hover:underline font-semibold">Sign in →</a>
          </p>
        </div>
      {/if}
    </div>

    <div class="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce" style="color: var(--ink-muted);">
      <span class="text-xs font-mono tracking-widest uppercase">Scroll</span>
      <span>↓</span>
    </div>
  </section>

  <!-- ══ TIMELINE ══ -->
  <section class="max-w-2xl mx-auto px-6 py-24">
    <div data-reveal="timeline"
      class="transition-all duration-700 {visible.timeline ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}">
      <p class="t-caption text-center mb-3">The history of music formats</p>
      <h2 class="t-manifesto text-white text-center mb-16">So I rebuilt<br />the format.</h2>

      <div class="relative pl-10">
        <div class="absolute left-3 top-2 bottom-2 w-px"
          style="background: linear-gradient(to bottom, transparent, rgba(123,92,240,0.5), transparent);"></div>
        <div class="space-y-10">
          {#each timeline as item, i}
            <div data-reveal="tl{i}"
              class="relative transition-all duration-500 {visible[`tl${i}`] ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}"
              style="transition-delay: {i * 80}ms">
              <div class="absolute -left-7 top-1.5 w-3 h-3 rounded-full"
                style={item.highlight
                  ? 'background: var(--gradient-spectral); box-shadow: 0 0 16px rgba(123,92,240,0.7);'
                  : 'background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);'}></div>
              <div class="flex items-baseline gap-3 mb-1">
                <span class="text-xs font-mono" style="color: var(--ink-muted);">{item.era}</span>
                <span class="font-black text-base {item.highlight ? 'gradient-text' : ''}"
                  style={item.highlight ? '' : 'color: var(--ink-secondary);'}>{item.format}</span>
              </div>
              <p class="text-sm leading-relaxed" style="color: var(--ink-muted);">{item.desc}</p>
              {#if item.highlight}
                <span class="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold"
                  style="background: rgba(123,92,240,0.15); color: #7B5CF0; border: 1px solid rgba(123,92,240,0.25);">
                  ⬡ The new standard
                </span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <!-- ══ SPLIT ══ -->
  <section class="max-w-5xl mx-auto px-6 py-16">
    <div data-reveal="split"
      class="transition-all duration-700 {visible.split ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}">
      <p class="t-caption text-center mb-3">Who it's for</p>
      <h2 class="t-manifesto text-white text-center mb-12">Not just audio.</h2>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="rounded-2xl p-8 relative overflow-hidden"
          style="background: linear-gradient(135deg, rgba(123,92,240,0.1), rgba(75,107,240,0.04)); border: 1px solid rgba(123,92,240,0.2);">
          <p class="t-caption mb-4" style="color: #7B5CF0;">For creators</p>
          <h3 class="text-2xl font-black text-white mb-4 leading-tight">The creator<br />in control</h3>
          <ul class="space-y-2.5 mb-8">
            {#each ['Package music as a complete cultural object','Set your own editions, rules & pricing','Upload audio, visuals, lyrics, alternates','Track every ownership event — forever'] as f}
              <li class="flex items-start gap-2.5 text-sm" style="color: var(--ink-secondary);">
                <span class="shrink-0 mt-0.5" style="color: #7B5CF0;">✓</span>{f}
              </li>
            {/each}
          </ul>
          <button on:click={() => { role = 'creator'; window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            class="btn-spectral rounded-full py-2.5 px-6 text-sm">Request creator access →</button>
        </div>
        <div class="rounded-2xl p-8 relative overflow-hidden"
          style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-dim);">
          <p class="t-caption mb-4" style="color: #4B6BF0;">For collectors</p>
          <h3 class="text-2xl font-black text-white mb-4 leading-tight">Own a piece<br />of something real</h3>
          <ul class="space-y-2.5 mb-8">
            {#each ['Acquire limited editions from global artists','Own the full experience — not just a stream','Transfer, gift, or hold your collection','Provenance recorded on every object'] as f}
              <li class="flex items-start gap-2.5 text-sm" style="color: var(--ink-secondary);">
                <span class="shrink-0 mt-0.5" style="color: #4B6BF0;">✓</span>{f}
              </li>
            {/each}
          </ul>
          <button on:click={() => { role = 'collector'; window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            class="btn-ghost rounded-full py-2.5 px-6 text-sm">Request collector access →</button>
        </div>
      </div>
    </div>
  </section>

  <!-- ══ CLOSING ══ -->
  <section class="text-center px-6 py-28">
    <div data-reveal="close"
      class="transition-all duration-700 {visible.close ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}">
      <p class="t-caption mb-4">The new standard</p>
      <h2 class="t-monumental text-white mb-6 max-w-3xl mx-auto leading-tight">
        This is what music<br /><span class="gradient-text">was supposed to be.</span>
      </h2>
      <p class="text-base mb-10 max-w-sm mx-auto" style="color: var(--ink-muted);">
        The first format built for the modern creator. Global. Ownable. Complete.
      </p>
      <div class="flex flex-col items-center gap-3">
        <form method="POST" action="?/waitlist"
          use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }}
          class="flex gap-2 max-w-sm w-full">
          <input type="hidden" name="role" value={role} />
          <input type="email" name="email" required placeholder="your@email.com"
            class="input-dark flex-1" style="border-radius: 99px; padding-left: 20px;" />
          <button type="submit" class="btn-spectral rounded-full px-5 shrink-0 text-sm" disabled={loading}>
            {loading ? '…' : 'Join waitlist'}
          </button>
        </form>
        <p class="text-xs" style="color: var(--ink-muted);">
          Invitation only · <a href="/auth/login" class="hover:text-white transition-colors">Sign in</a> if you have access
        </p>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="border-t px-8 py-6 flex flex-wrap items-center justify-between gap-4 text-xs font-mono"
    style="border-color: var(--border-dim); color: var(--ink-muted);">
    <span>NOIZES · v5 · {new Date().getFullYear()}</span>
    <span>Music as a cultural object.</span>
    <a href="/auth/login" class="hover:text-white transition-colors">Sign in</a>
  </footer>
</div>
