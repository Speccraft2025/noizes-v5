<script>
  import { page } from '$app/stores';

  // A shared link that fails is often the first thing a stranger ever sees of
  // Noizes, so these states get real copy rather than a status code. The
  // message thrown by the loader is shown verbatim — it is written for a
  // reader, and it distinguishes "no such release" from "we are broken",
  // which are very different things to be told.
  $: status = $page.status;
  $: message = $page.error?.message ?? '';

  $: heading = status === 404
    ? 'Nothing lives at this address'
    : status === 410 || status === 409
      ? 'This drop is not available'
      : 'This page could not be loaded';

  // The loader's own message is written for a reader and is more specific than
  // anything generic, so it leads whenever there is one.
  $: explanation = status === 404
    ? 'The link may have a typo, or the release may never have been published. Drop Page links do not expire — a release that has been withdrawn still keeps its page.'
    : message
      || 'This is a fault on our side, not an empty shelf. Nothing about the release, or about any package already downloaded, has changed.';
</script>

<svelte:head>
  <title>{heading} — Noizes</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="min-h-screen flex flex-col items-center justify-center px-6 py-16" style="background: var(--bg-deep);">
  <div class="w-full max-w-lg text-center space-y-5">
    <p class="font-mono text-5xl font-black" style="color: rgba(123,92,240,0.28);">{status}</p>

    <h1 class="text-2xl font-black text-white">{heading}</h1>

    <p class="text-sm leading-relaxed" style="color: var(--ink-muted);">{explanation}</p>

    <div class="flex flex-wrap gap-2 justify-center pt-2">
      <a href="/exchange" class="btn-spectral rounded-full px-6 py-2.5 text-sm">Browse the Exchange</a>
      <a href="/open" class="btn-ghost rounded-full px-5 py-2.5 text-sm">Open a .nz file</a>
    </div>

    <p class="text-xs pt-6" style="color: var(--ink-muted);">
      A Noizes package works without this page. If you already have the .nz, it opens offline.
    </p>
  </div>
</div>
