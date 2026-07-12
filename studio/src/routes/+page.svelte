<script>
  import { enhance } from '$app/forms';
  import { onMount, onDestroy } from 'svelte';
  import NoizesOrb from '$lib/components/NoizesOrb.svelte';
  import { introDone } from '$lib/stores/landing';
  export let form;

  let role = 'collector';
  let loading = false;
  let visible = {};
  let installPrompt = null;
  let showInstall = false;

  // ── Cinematic sequence state
  let entered = false;
  let gateReady = false;
  let gateEl;
  let initPromise;
  let cine = null;

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

    initPromise = initCinematics();

    return () => observer.disconnect();
  });

  onDestroy(() => {
    if (cine) {
      cine.scrollTriggers.forEach((st) => st?.kill());
      cine.splits.forEach((s) => s.revert());
      if (cine.tick) cine.gsap.ticker.remove(cine.tick);
      cine.lenis?.destroy();
    }
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('gate-locked');
    }
  });

  async function initCinematics() {
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    introDone.set(false);
    document.documentElement.classList.add('gate-locked');

    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const { gsap } = await import('gsap');
    const { ScrollTrigger } = await import('gsap/ScrollTrigger');
    const { SplitText } = await import('gsap/SplitText');
    gsap.registerPlugin(ScrollTrigger, SplitText);

    // Lenis smooth scroll, driven by GSAP's ticker, in lockstep with ScrollTrigger
    let lenis = null;
    let tick = null;
    if (!rm) {
      const Lenis = (await import('lenis')).default;
      lenis = new Lenis({ lerp: 0.09 });
      lenis.stop();
      lenis.on('scroll', ScrollTrigger.update);
      tick = (time) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }

    await document.fonts.ready;

    const splits = [];
    const scrollTriggers = [];
    if (!rm) {
      // hero headline → per-char masked reveal
      document.querySelectorAll('[data-hero-line]').forEach((el) => {
        const split = new SplitText(el, { type: 'chars', mask: 'chars' });
        if (el.classList.contains('gradient-text')) {
          split.chars.forEach((c) => c.classList.add('gradient-text'));
        }
        splits.push(split);
      });
      gsap.set(splits.flatMap((s) => s.chars), { yPercent: 120 });
      gsap.set('[data-hero-caption], [data-hero-fade]', { autoAlpha: 0, y: 24 });

      // section headings → masked line reveals on scroll
      document.querySelectorAll('[data-st-line]').forEach((el) => {
        const tween = gsap.from(el, {
          yPercent: 115,
          duration: 1.1,
          ease: 'power4.out',
          scrollTrigger: { trigger: el.parentElement, start: 'top 85%' },
        });
        scrollTriggers.push(tween.scrollTrigger);
      });
      document.querySelectorAll('[data-st-fade]').forEach((el) => {
        const tween = gsap.from(el, {
          autoAlpha: 0,
          y: 18,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 90%' },
        });
        scrollTriggers.push(tween.scrollTrigger);
      });
    }

    cine = { gsap, lenis, splits, scrollTriggers, rm, tick };
    gateReady = true;
    return cine;
  }

  async function enter() {
    const ctx = await initPromise;
    introDone.set(true);

    const { gsap, lenis, splits, rm } = ctx;
    const tl = gsap.timeline({
      onComplete: () => {
        entered = true;
        document.documentElement.classList.remove('gate-locked');
        lenis?.start();
      },
    });

    tl.to(gateEl, { yPercent: -100, duration: rm ? 0.5 : 1.05, ease: 'power4.inOut' });
    if (!rm && splits.length >= 2) {
      tl.to('[data-hero-caption]', { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.55);
      tl.to(splits[0].chars, { yPercent: 0, duration: 1.15, ease: 'power4.out', stagger: 0.028 }, 0.6);
      tl.to(splits[1].chars, { yPercent: 0, duration: 1.15, ease: 'power4.out', stagger: 0.028 }, 0.78);
      tl.to('[data-hero-fade]', { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power2.out', stagger: 0.12 }, 1.2);
    }
  }

  function scrollTop() {
    if (cine?.lenis) cine.lenis.scrollTo(0);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function installPWA() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') showInstall = false;
  }

  const timeline = [
    { era: '1950s', format: 'Vinyl LPs',       icon: 'vinyl',    desc: 'Warmth. Ritual. Something you could hold.' },
    { era: '1970s', format: 'Cassette Tapes',  icon: 'cassette', desc: 'Portable. Personal. Mixed for someone.' },
    { era: '1980s', format: 'Compact Discs',   icon: 'cd',       desc: 'Digital clarity. The beginning of the copy.' },
    { era: '2000s', format: 'MP3 & Streaming', icon: 'stream',   desc: 'Infinite access. Zero ownership. Music became background.' },
    { era: 'Now',   format: 'Noizes',          icon: 'noizes',   desc: 'A new format. Music as a complete, ownable cultural object.', highlight: true },
  ];
</script>

<svelte:head><title>Noizes — Music as a Cultural Object</title></svelte:head>

<div class="relative overflow-x-hidden grain" style="background: var(--bg-deep); color: var(--parchment);">
  <NoizesOrb />

  <!-- ══ ENTER GATE ══ -->
  {#if !entered}
    <div bind:this={gateEl} class="fixed inset-0 flex flex-col items-center justify-center gap-8"
      style="z-index: 200; background: #030303;">
      <img src="/logo-wordmark.png" alt="NOIZES" class="h-8 w-auto" />
      <p class="t-caption" style="letter-spacing: 0.3em;">Music as a cultural object</p>
      <button on:click={enter} disabled={!gateReady} class="gate-enter">ENTER</button>
    </div>
  {/if}

  <div class="relative" style="z-index: 10;">

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
  <section class="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-14 pb-20">
    <div class="relative z-10 max-w-4xl mx-auto">
      <p class="t-caption mb-6" data-hero-caption>Music was never meant to be just a file.</p>

      <h1 class="t-monumental text-white mb-6">
        <span class="block" data-hero-line>An experience,</span>
        <span class="block gradient-text" data-hero-line>not a stream.</span>
      </h1>

      <p class="text-lg max-w-xl mx-auto mb-12 leading-relaxed" style="color: var(--ink-secondary);" data-hero-fade>
        We compressed music until we compressed its worth.<br />
        Noizes rebuilds the format — music as a complete, ownable object.
      </p>

      <!-- GATE 1: Waitlist -->
      <div data-hero-fade>
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
    </div>

    <div class="absolute bottom-8 left-1/2 -translate-x-1/2" style="color: var(--ink-muted);">
      <div class="flex flex-col items-center gap-1 animate-bounce" data-hero-fade>
        <span class="text-xs font-mono tracking-widest uppercase">Scroll</span>
        <span>↓</span>
      </div>
    </div>
  </section>

  <!-- ══ TIMELINE ══ -->
  <section data-orb="timeline" class="max-w-2xl mx-auto px-6 py-24">
    <p class="t-caption text-center mb-3" data-st-fade>The history of music formats</p>
    <h2 class="t-manifesto text-white text-center mb-16">
      <span class="block overflow-hidden"><span class="block" data-st-line>So I rebuilt</span></span>
      <span class="block overflow-hidden"><span class="block" data-st-line>the format.</span></span>
    </h2>

    <div data-reveal="timeline"
      class="transition-all duration-700 {visible.timeline ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}">
      <div class="relative pl-24">
        <div class="absolute left-7 top-2 bottom-2 w-px"
          style="background: linear-gradient(to bottom, transparent, rgba(123,92,240,0.5), transparent);"></div>
        <div class="space-y-12">
          {#each timeline as item, i}
            <div data-reveal="tl{i}"
              class="relative transition-all duration-500 {visible[`tl${i}`] ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}"
              style="transition-delay: {i * 80}ms">
              <div class="absolute -left-24 top-0 w-14 h-14" data-icon3d={item.icon}></div>
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
  <section data-orb="split" class="max-w-5xl mx-auto px-6 py-16">
    <p class="t-caption text-center mb-3" data-st-fade>Who it's for</p>
    <h2 class="t-manifesto text-white text-center mb-12">
      <span class="block overflow-hidden"><span class="block" data-st-line>Not just audio.</span></span>
    </h2>
    <div data-reveal="split"
      class="transition-all duration-700 {visible.split ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}">
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
          <button on:click={() => { role = 'creator'; scrollTop(); }}
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
          <button on:click={() => { role = 'collector'; scrollTop(); }}
            class="btn-ghost rounded-full py-2.5 px-6 text-sm">Request collector access →</button>
        </div>
      </div>
    </div>
  </section>

  <!-- ══ CLOSING ══ -->
  <section data-orb="closing" class="text-center px-6 py-28">
    <p class="t-caption mb-4" data-st-fade>The new standard</p>
    <h2 class="t-monumental text-white mb-6 max-w-3xl mx-auto leading-tight">
      <span class="block overflow-hidden"><span class="block" data-st-line>This is what music</span></span>
      <span class="block overflow-hidden"><span class="block gradient-text" data-st-line>was supposed to be.</span></span>
    </h2>
    <div data-reveal="close"
      class="transition-all duration-700 {visible.close ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}">
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
</div>

<style>
  /* Cinematic film grain over the whole landing page */
  .grain::after {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 100;
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    mix-blend-mode: overlay;
  }

  /* No scrolling while the ENTER gate is up */
  :global(html.gate-locked),
  :global(html.gate-locked body) {
    overflow: hidden;
  }

  .gate-enter {
    padding: 18px 64px;
    background: transparent;
    color: var(--parchment);
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.4em;
    text-indent: 0.4em;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 99px;
    cursor: pointer;
    transition: border-color 0.3s, box-shadow 0.3s, color 0.3s;
    animation: gate-pulse 2.8s ease-in-out infinite;
  }
  .gate-enter:hover {
    border-color: rgba(123, 92, 240, 0.7);
    box-shadow: 0 0 32px rgba(123, 92, 240, 0.35);
    color: #fff;
  }
  .gate-enter:disabled {
    opacity: 0.35;
    cursor: wait;
    animation: none;
  }
  @keyframes gate-pulse {
    0%, 100% { box-shadow: 0 0 0 rgba(123, 92, 240, 0); }
    50% { box-shadow: 0 0 26px rgba(123, 92, 240, 0.22); }
  }
</style>
