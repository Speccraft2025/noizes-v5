<script>
  import { page } from '$app/stores';
</script>

<svelte:head><title>Error — Noizes</title></svelte:head>

<div class="min-h-screen flex flex-col items-center justify-center px-6 text-center"
  style="background: var(--bg-deep); color: var(--parchment);">
  <p class="font-mono text-6xl font-black mb-4" style="color: rgba(123,92,240,0.3);">{$page.status}</p>
  <h1 class="text-2xl font-black text-white mb-3">
    {$page.status === 404 ? 'Not found.' : 'Something went wrong.'}
  </h1>
  <p class="text-sm mb-8" style="color: var(--ink-muted);">
    {$page.status === 404
      ? 'This page doesn\'t exist or has been moved.'
      : 'An error occurred. Try again or go back.'}
  </p>
  <a href="/exchange" class="btn-spectral rounded-full px-6 py-2.5 text-sm">← Back to Exchange</a>
</div>
