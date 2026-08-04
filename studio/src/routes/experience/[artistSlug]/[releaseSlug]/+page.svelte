<script>
  import { onMount } from 'svelte';
  import { prepareNzForViewer, VIEWER_FRAME_BOOTSTRAP } from '$lib/utils/viewer.js';

  export let data;

  let status = 'loading';
  let errorMessage = '';
  let prepared = null;
  let frameSent = false;
  let iframeEl;

  async function open() {
    status = 'loading';
    errorMessage = '';
    try {
      const response = await fetch(data.packageUrl);
      if (!response.ok) throw new Error(`The package could not be fetched (${response.status}).`);
      const blob = await response.blob();
      // Validates structure and component checksums before a single byte of
      // creator-authored HTML is handed to the sandbox.
      prepared = await prepareNzForViewer(blob);
      frameSent = false;
      status = 'ready';
    } catch (cause) {
      errorMessage = cause.message || 'The experience could not be started.';
      status = 'error';
    }
  }

  function loadFrame() {
    if (!iframeEl?.contentWindow || !prepared || frameSent) return;
    const resources = prepared.resources.map((resource) => ({ ...resource }));
    iframeEl.contentWindow.postMessage(
      { type: 'noizes:viewer:load', html: prepared.html, resources },
      '*',
      resources.map((resource) => resource.bytes),
    );
    frameSent = true;
  }

  onMount(() => {
    open();
    const onMessage = (event) => {
      if (!iframeEl || event.source !== iframeEl.contentWindow) return;
      if (event.data?.type === 'noizes:viewer:error') {
        errorMessage = event.data.message || 'The experience could not start.';
        status = 'error';
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  });
</script>

<svelte:head>
  <title>{data.release.title} — Noizes experience</title>
  <!-- A playback surface has nothing to offer a search index, and the Drop
       Page is the address that should rank and be shared. -->
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="fixed inset-0" style="background: #030303;">
  <h1 class="sr-only">{data.release.title} by {data.release.artist_name}</h1>

  <a
    href={data.dropPath}
    class="fixed z-[60] flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold"
    style="top: max(14px, env(safe-area-inset-top)); left: 14px; border: 1px solid rgba(255,255,255,.16);
           color: rgba(255,255,255,.78); background: rgba(4,7,7,.5); backdrop-filter: blur(18px);"
  >← Drop page</a>

  {#if status === 'ready'}
    <!-- Opaque sandbox: creator-authored experience code never inherits the
         signed-in Noizes origin, and cannot reach cookies, storage or the
         session. Same boundary the offline viewer uses. -->
    <iframe
      bind:this={iframeEl}
      title="{data.release.title} experience"
      srcdoc={VIEWER_FRAME_BOOTSTRAP}
      on:load={loadFrame}
      class="absolute inset-0 w-full h-full border-0"
      allow="autoplay"
      sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
    ></iframe>
  {:else}
    <div class="absolute inset-0 flex items-center justify-center px-6">
      <div class="max-w-md w-full text-center space-y-4">
        {#if status === 'loading'}
          <div
            class="w-9 h-9 mx-auto rounded-full border-2 animate-spin"
            style="border-color: #7B5CF0; border-top-color: transparent;"
            role="status"
            aria-label="Opening the experience"
          ></div>
          <p class="text-sm" style="color: var(--ink-muted);">Opening {data.release.title}…</p>
          <p class="text-xs" style="color: var(--ink-muted);">
            The package is downloaded once and verified before it runs.
          </p>
        {:else}
          <p class="t-caption" style="color: #F08A9D;">Experience unavailable</p>
          <p class="text-sm text-white">{errorMessage}</p>
          <p class="text-xs" style="color: var(--ink-muted);">
            The .nz package itself is unaffected — it opens offline in the Noizes viewer.
          </p>
          <div class="flex flex-wrap gap-2 justify-center pt-2">
            <button type="button" class="btn-spectral rounded-full px-5 py-2 text-xs" on:click={open}>Try again</button>
            <a class="btn-ghost rounded-full px-5 py-2 text-xs" href={data.dropPath}>Back to the drop</a>
            <a class="btn-ghost rounded-full px-5 py-2 text-xs" href="/open">Open a .nz file</a>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
