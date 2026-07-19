<script>
  import { identity, edition, assets, rights, template, play } from '$lib/stores/package.js';
  import { buildPackage } from '$lib/utils/packager.js';

  let exporting = false;
  let exported = false;
  let published = false;
  let publishError = '';
  let exportedFilename = '';
  let error = '';
  let progress = 0;
  let statusLabel = 'Compiling package…';

  $: canExport = $identity.artist && $identity.title && $identity.year;

  async function doExport() {
    exporting = true;
    error = '';
    publishError = '';
    exported = false;
    published = false;
    progress = 0;
    statusLabel = 'Compiling package…';

    const steps = [10, 25, 45, 65, 80];
    for (const p of steps) {
      await new Promise(r => setTimeout(r, 180));
      progress = p;
    }

    let result;
    try {
      result = await buildPackage({
        identity: $identity,
        edition:  $edition,
        assets:   $assets,
        rights:   $rights,
        template: $template,
        play:     $play,
      });
      exportedFilename = result.filename;
      progress = 90;
      exported = true;
    } catch (e) {
      error = e.message || 'Export failed.';
      exporting = false;
      return;
    }

    // Publish to Supabase. Files go straight from the browser to Supabase
    // Storage via signed upload URLs — Netlify functions reject request
    // bodies over 6MB, so the .nz/audio/cover can't be POSTed to our server.
    statusLabel = 'Uploading to Exchange…';
    try {
      const ext = (name) => name?.includes('.') ? name.split('.').pop() : null;
      const prepRes = await fetch('/studio/publish/upload-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          release_id: $identity.release_id,
          audio_ext: ext(result.audioFile?.name),
          cover_ext: ext(result.coverFile?.name),
        }),
      });
      if (!prepRes.ok) {
        const body = await prepRes.json().catch(() => ({}));
        throw new Error(body.message || `Upload setup failed (${prepRes.status})`);
      }
      const { release_id, uploads } = await prepRes.json();

      async function putFile(target, blob, type) {
        const res = await fetch(target.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': type, 'x-upsert': 'true' },
          body: blob,
        });
        if (!res.ok) throw new Error(`Upload to storage failed (${res.status})`);
      }

      await putFile(uploads.nz, result.blob, 'application/zip');
      progress = 94;
      if (uploads.audio && result.audioFile) {
        await putFile(uploads.audio, result.audioFile, result.audioFile.type || 'audio/mpeg');
      }
      if (uploads.cover && result.coverFile) {
        await putFile(uploads.cover, result.coverFile, result.coverFile.type || 'image/jpeg');
      }
      progress = 97;

      statusLabel = 'Publishing to Exchange…';
      const res = await fetch('/studio/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          release_id,
          meta: {
            artist: $identity.artist,
            title: $identity.title,
            genre: $identity.genre,
            year: $identity.year,
            location: $identity.location,
            description: $identity.description,
            edition_type: $edition.edition_type,
            edition_name: $edition.edition_name,
            edition_size: $edition.edition_size,
            price: $edition.price,
            currency: $edition.currency,
          },
        }),
      });
      if (res.ok) {
        published = true;
      } else {
        const body = await res.json().catch(() => ({}));
        publishError = body.message || `Publish failed (${res.status})`;
      }
    } catch (e) {
      publishError = e.message || 'Publish failed.';
    }

    progress = 100;
    exporting = false;
  }

  const files = [
    ['manifest.json', 'Work identity & metadata'],
    ['edition.json', 'Edition type, size & pricing'],
    ['rights.json', 'Copyright & license'],
    ['credits.json', 'Production credits'],
    ['authenticity.json', 'sha256 integrity record'],
    ['technical.json', 'Packager & timestamp'],
    ['experience.html', 'Self-contained offline player'],
  ];
</script>

<div class="space-y-6">
  <div>
    <p class="t-caption mb-2">Step 7</p>
    <h2 class="text-2xl font-black tracking-tight text-white">The Compiler</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">Package your work as a self-contained .nz file.</p>
  </div>

  <!-- File manifest -->
  <div class="glass rounded-xl p-4 space-y-1">
    <p class="t-caption mb-3">Package Contents</p>
    {#each files as [file, desc]}
      <div class="flex items-center gap-3 py-1.5 border-b" style="border-color: var(--border-dim);">
        <span class="text-xs font-mono w-36 shrink-0" style="color: #7B5CF0;">{file}</span>
        <span class="text-xs" style="color: var(--ink-muted);">{desc}</span>
      </div>
    {/each}
    {#if $assets.audioName}
      <div class="flex items-center gap-3 py-1.5 border-b" style="border-color: var(--border-dim);">
        <span class="text-xs font-mono w-36 shrink-0" style="color: #7B5CF0;">audio/</span>
        <span class="text-xs" style="color: var(--ink-muted);">{$assets.audioName}</span>
      </div>
    {/if}
    {#if $assets.coverName}
      <div class="flex items-center gap-3 py-1.5 border-b" style="border-color: var(--border-dim);">
        <span class="text-xs font-mono w-36 shrink-0" style="color: #7B5CF0;">cover/</span>
        <span class="text-xs" style="color: var(--ink-muted);">{$assets.coverName}</span>
      </div>
    {/if}
    <div class="flex items-center gap-3 py-1.5">
      <span class="text-xs font-mono w-36 shrink-0" style="color: #7B5CF0;">template</span>
      <span class="text-xs" style="color: var(--ink-muted);">{$template} · {$assets.lyrics?.length ?? 0} lyric lines synced</span>
    </div>
  </div>

  {#if !canExport}
    <div class="glass rounded-lg px-4 py-3 text-sm" style="color: var(--ink-muted); border-color: rgba(123,92,240,0.2);">
      Complete Step 1 (artist, title, year) before forging.
    </div>
  {/if}

  {#if error}
    <div class="rounded-lg px-4 py-3 text-sm text-red-400" style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);">{error}</div>
  {/if}

  {#if exporting}
    <div class="space-y-2">
      <div class="flex justify-between text-xs font-mono" style="color: var(--ink-muted);">
        <span>{statusLabel}</span>
        <span>{progress}%</span>
      </div>
      <div class="h-1 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.08);">
        <div
          class="h-full rounded-full transition-all duration-300"
          style="width: {progress}%; background: var(--gradient-spectral);"
        ></div>
      </div>
    </div>
  {/if}

  {#if exported}
    <div class="rounded-xl p-4 space-y-3" style="background: rgba(123,92,240,0.1); border: 1px solid rgba(123,92,240,0.3);">
      <div>
        <p class="t-caption mb-1" style="color: #7B5CF0;">Package Downloaded</p>
        <p class="font-mono text-sm text-white">{exportedFilename}</p>
        <p class="text-xs mt-1" style="color: var(--ink-muted);">Drag it into <a href="/open" class="underline" style="color: #7B5CF0;">Noizes Viewer</a> to play offline.</p>
      </div>

      {#if published}
        <div class="flex items-center gap-2 pt-2 border-t" style="border-color: rgba(123,92,240,0.2);">
          <span style="color: #7B5CF0;">✓</span>
          <p class="text-xs text-white">Published to Exchange — <a href="/exchange" class="underline" style="color: #7B5CF0;">view it live</a></p>
        </div>
      {:else if publishError}
        <div class="pt-2 border-t" style="border-color: rgba(239,68,68,0.2);">
          <p class="text-xs text-red-400">Exchange publish failed: {publishError}</p>
          <p class="text-xs mt-1" style="color: var(--ink-muted);">Your .nz file was still downloaded successfully.</p>
        </div>
      {:else if !exporting}
        <p class="text-xs pt-2 border-t" style="border-color: rgba(255,255,255,0.06); color: var(--ink-muted);">Publishing…</p>
      {/if}
    </div>
  {/if}

  <button
    class="btn-spectral w-full justify-center py-3.5 text-base rounded-xl"
    disabled={!canExport || exporting}
    on:click={doExport}
  >
    {#if exporting}
      {progress < 90 ? 'Compiling…' : 'Publishing…'}
    {:else}
      ⬡ Compile & Publish .nz
    {/if}
  </button>
</div>
