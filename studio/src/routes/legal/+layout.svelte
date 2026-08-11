<script>
  import { page } from '$app/stores';

  const docs = [
    { href: '/legal/terms',       label: 'Terms of Service' },
    { href: '/legal/privacy',     label: 'Privacy Policy' },
    { href: '/legal/creator',     label: 'Creator Agreement' },
    { href: '/legal/acceptable-use', label: 'Acceptable Use' },
    { href: '/legal/copyright',   label: 'Copyright Policy' },
    { href: '/legal/cookies',     label: 'Cookie Notice' },
  ];
</script>

<svelte:head>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="min-h-screen" style="background: var(--bg-deep); color: var(--parchment);">
  <!-- Nav bar -->
  <nav class="sticky top-0 z-50 border-b flex items-center justify-between px-6 md:px-8 h-14"
    style="background: rgba(3,3,3,0.92); backdrop-filter: blur(20px); border-color: var(--border-dim);">
    <a href="/" class="flex items-center gap-2 shrink-0">
      <img src="/logo-wordmark.png" alt="NOIZES" class="h-7 w-auto" />
    </a>
    <a href="/auth/login" class="btn-ghost py-1.5 px-5 text-sm rounded-full">Sign in</a>
  </nav>

  <div class="max-w-3xl mx-auto px-6 py-16">
    <!-- Document nav -->
    <div class="flex flex-wrap gap-2 mb-12">
      {#each docs as doc}
        <a href={doc.href}
          class="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
          style={$page.url.pathname === doc.href
            ? 'background: rgba(123,92,240,0.15); color: #fff; border: 1px solid rgba(123,92,240,0.3);'
            : 'color: var(--ink-muted); border: 1px solid var(--border-dim);'}>
          {doc.label}
        </a>
      {/each}
    </div>

    <!-- Document content -->
    <article class="legal-prose">
      <slot />
    </article>

  </div>
</div>

<style>
  :global(.legal-prose) {
    line-height: 1.75;
    color: var(--ink-secondary);
  }
  :global(.legal-prose h1) {
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.15;
    color: #fff;
    margin-bottom: 0.5rem;
  }
  :global(.legal-prose .effective-date) {
    font-size: 0.8rem;
    color: var(--ink-muted);
    font-weight: 500;
    margin-bottom: 2.5rem;
    display: block;
  }
  :global(.legal-prose h2) {
    font-size: 1.25rem;
    font-weight: 700;
    color: #fff;
    margin-top: 2.5rem;
    margin-bottom: 0.75rem;
    letter-spacing: -0.01em;
  }
  :global(.legal-prose h3) {
    font-size: 1rem;
    font-weight: 600;
    color: var(--parchment);
    margin-top: 1.75rem;
    margin-bottom: 0.5rem;
  }
  :global(.legal-prose p) {
    margin-bottom: 1rem;
  }
  :global(.legal-prose ul),
  :global(.legal-prose ol) {
    margin-bottom: 1rem;
    padding-left: 1.5rem;
  }
  :global(.legal-prose li) {
    margin-bottom: 0.4rem;
  }
  :global(.legal-prose ol) {
    list-style: decimal;
  }
  :global(.legal-prose ul) {
    list-style: disc;
  }
  :global(.legal-prose a) {
    color: #7B5CF0;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  :global(.legal-prose a:hover) {
    color: #fff;
  }
  :global(.legal-prose strong) {
    color: var(--parchment);
    font-weight: 600;
  }
  :global(.legal-prose table) {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }
  :global(.legal-prose th),
  :global(.legal-prose td) {
    text-align: left;
    padding: 0.6rem 0.8rem;
    border-bottom: 1px solid var(--border-dim);
  }
  :global(.legal-prose th) {
    color: var(--parchment);
    font-weight: 600;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
</style>
