<script>
  import JSZip from 'jszip';
  import { onMount } from 'svelte';

  let dragging = false;
  let loading = false;
  let error = '';
  let ready = false;
  let manifest = null;
  let filename = '';
  let iframeSrc = '';
  let blobUrls = [];

  let showInstallBanner = false;
  let showInstallTip = false;

  onMount(() => {
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (iOS && !standalone) showInstallBanner = true;
  });

  function reset() {
    blobUrls.forEach(u => URL.revokeObjectURL(u));
    blobUrls = [];
    ready = false;
    manifest = null;
    filename = '';
    error = '';
    iframeSrc = '';
  }

  async function loadNZ(file) {
    if (!file) return;
    loading = true;
    error = '';
    filename = file.name;

    try {
      const zip = await JSZip.loadAsync(file);

      const manifestFile = zip.file('manifest.json');
      if (manifestFile) {
        try { manifest = JSON.parse(await manifestFile.async('string')); } catch {}
      }

      const expFile = zip.file('experience.html');
      if (!expFile) {
        error = 'No experience.html found. Is this a valid .nz file?';
        loading = false;
        return;
      }
      let html = await expFile.async('string');

      // Patch audio to blob URLs so iOS can play them
      const audioFiles = [];
      zip.forEach((path, f) => {
        if (path.startsWith('audio/') && !f.dir) audioFiles.push({ path, f });
      });
      for (const { path, f } of audioFiles) {
        const buf = await f.async('arraybuffer');
        const ext = path.split('.').pop().toLowerCase();
        const mime = { mp3: 'audio/mpeg', flac: 'audio/flac', wav: 'audio/wav', aac: 'audio/aac', m4a: 'audio/mp4' }[ext] || 'audio/mpeg';
        const blob = new Blob([buf], { type: mime });
        const url = URL.createObjectURL(blob);
        blobUrls.push(url);
        const rel = path.replace('audio/', '');
        html = html.split(`src="audio/${rel}"`).join(`src="${url}"`);
      }

      // Use blob URL for iframe — more compatible than srcdoc on iOS Safari
      const htmlBlob = new Blob([html], { type: 'text/html' });
      const htmlUrl = URL.createObjectURL(htmlBlob);
      blobUrls.push(htmlUrl);
      iframeSrc = htmlUrl;
      ready = true;

    } catch (e) {
      error = `Failed to open: ${e.message}`;
    } finally {
      loading = false;
    }
  }

  function onDrop(e) {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) loadNZ(file);
  }

  function onFileInput(e) {
    const file = e.target.files?.[0];
    if (file) loadNZ(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }
</script>

<svelte:head><title>Noizes Viewer</title></svelte:head>

{#if ready}
  <div class="fixed inset-0 z-50 flex flex-col" style="background: #030303;">
    <div class="flex items-center justify-between px-4 py-2 shrink-0 border-b"
      style="background: rgba(3,3,3,0.95); border-color: rgba(255,255,255,0.06);">
      <div class="flex items-center gap-3">
        <span class="font-black text-sm tracking-tight text-white">NOIZES</span>
        <span class="text-xs font-mono px-2 py-0.5 rounded"
          style="background: rgba(123,92,240,0.12); color: #7B5CF0;">
          {manifest?.title || filename}
        </span>
      </div>
      <div class="flex items-center gap-3">
        {#if manifest?.artist}
          <span class="text-xs font-mono" style="color: #555;">
            {manifest.artist}{manifest.year ? ' · ' + manifest.year : ''}
          </span>
        {/if}
        <button on:click={reset}
          class="text-xs px-3 py-1 rounded-full border"
          style="border-color: rgba(255,255,255,0.1); color: #666; background: none; cursor: pointer;">
          ✕ Close
        </button>
      </div>
    </div>
    <iframe
      title="Noizes Experience"
      src={iframeSrc}
      class="flex-1 border-0 w-full"
      allow="autoplay"
    ></iframe>
  </div>

{:else}
  <div class="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-6 py-16">
    <div class="w-full max-w-lg">

      {#if showInstallBanner}
        <!-- Install tip popover -->
        {#if showInstallTip}
          <div class="fixed inset-0 z-50 flex items-end justify-center pb-24 px-6"
            style="background: rgba(0,0,0,0.6);"
            on:click={() => showInstallTip = false}>
            <div class="w-full max-w-sm rounded-2xl p-5 relative"
              style="background: #1a1a1a; border: 1px solid rgba(123,92,240,0.3);">
              <p class="text-xs font-bold mb-3" style="color: #7B5CF0; letter-spacing:.06em;">ADD TO HOME SCREEN</p>
              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-3">
                  <span class="text-xl">⬆</span>
                  <p class="text-sm text-white">Tap the <strong>Share</strong> button in Safari's bottom toolbar</p>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-xl">＋</span>
                  <p class="text-sm text-white">Tap <strong>"Add to Home Screen"</strong></p>
                </div>
              </div>
              <div class="mt-4 pt-4 border-t text-center" style="border-color: rgba(255,255,255,0.08);">
                <span class="text-xs" style="color: var(--ink-muted);">Tap anywhere to dismiss</span>
              </div>
              <!-- Pointer arrow toward bottom -->
              <div class="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0"
                style="border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 12px solid #1a1a1a;"></div>
            </div>
          </div>
        {/if}

        <!-- Banner -->
        <div class="flex items-center gap-3 mb-6 px-4 py-3 rounded-2xl"
          style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);">
          <div class="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-lg"
            style="background: linear-gradient(135deg,#7B5CF0,#4B6BF0);">⬟</div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-white leading-tight">Get the Noizes app</p>
            <p class="text-xs" style="color: var(--ink-muted);">Open .nz files offline on your iPhone</p>
          </div>
          <button on:click={() => showInstallTip = true}
            class="shrink-0 text-sm font-bold px-4 py-2 rounded-xl"
            style="background: #7B5CF0; color: #fff;">
            Install
          </button>
          <button on:click={() => showInstallBanner = false}
            class="shrink-0 text-lg leading-none"
            style="color: #444; background: none; border: none; cursor: pointer;">×</button>
        </div>
      {/if}
      <div class="text-center mb-10">
        <p class="t-caption mb-3">Noizes Viewer</p>
        <h1 class="text-3xl font-black text-white tracking-tight">Open a .nz package</h1>
        <p class="text-sm mt-2" style="color: var(--ink-muted);">
          Tap to select your file — plays entirely in your browser, offline.
        </p>
      </div>

      <label
        class="block cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-12 text-center"
        style={dragging
          ? 'border-color: #7B5CF0; background: rgba(123,92,240,0.08);'
          : 'border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.02);'}
        on:dragover|preventDefault={() => dragging = true}
        on:dragleave={() => dragging = false}
        on:drop={onDrop}
      >
        <input type="file" class="sr-only" on:change={onFileInput} />

        {#if loading}
          <div class="flex flex-col items-center gap-3">
            <div class="w-8 h-8 rounded-full border-2 animate-spin"
              style="border-color: #7B5CF0; border-top-color: transparent;"></div>
            <p class="text-sm" style="color: var(--ink-muted);">Opening package…</p>
          </div>
        {:else}
          <div class="text-4xl mb-4" style="color: rgba(123,92,240,0.5);">⬟</div>
          <p class="font-bold text-white text-sm mb-1">Select your .nz file</p>
          <p class="text-xs mt-1" style="color: var(--ink-muted);">
            Tap here → Browse → Files app → your .nz
          </p>
        {/if}
      </label>

      {#if error}
        <div class="mt-4 px-4 py-3 rounded-xl text-sm text-red-400"
          style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15);">
          {error}
        </div>
      {/if}

      <div class="mt-10 grid grid-cols-3 gap-4 text-center">
        {#each [
          ['⬡', 'Offline', 'No internet required'],
          ['◎', 'Permanent', 'Works forever'],
          ['◈', 'Private', 'Nothing leaves your device'],
        ] as [icon, label, desc]}
          <div class="glass rounded-xl p-4">
            <div class="text-lg mb-1" style="color: #7B5CF0;">{icon}</div>
            <div class="text-xs font-bold text-white mb-0.5">{label}</div>
            <div class="text-xs" style="color: var(--ink-muted);">{desc}</div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}
