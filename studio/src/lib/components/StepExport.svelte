<script>
  import { createEventDispatcher } from 'svelte';
  import { identity, edition, releaseProject, template, play, extras, transcendence } from '$lib/stores/package.js';
  import { buildPackage } from '$lib/utils/packager.js';
  import { editionErrors } from '$lib/utils/project.js';
  import { validateReleaseProject } from '$lib/domain/release.js';
  import { estimatePackageSize, formatBytes } from '$lib/domain/package-size.js';
  import { prepareNzForViewer, VIEWER_FRAME_BOOTSTRAP } from '$lib/utils/viewer.js';
  import { goto } from '$app/navigation';

  const dispatch = createEventDispatcher();

  let exporting = false;
  let exported = false;
  let published = false;
  let publishError = '';
  let dropPath = '';
  let exportedFilename = '';
  let error = '';
  let progress = 0;
  let statusLabel = 'Compiling package…';
  let previewBusy = false;
  let previewPrepared = null;
  let previewSent = false;
  let previewIframe;

  $: projectValidation = validateReleaseProject({ ...$releaseProject, extras: $extras });
  $: validationErrors = [...editionErrors($edition), ...projectValidation.errors.map((issue) => issue.message)];
  $: validationWarnings = projectValidation.warnings;
  $: mainCover = $releaseProject.release_assets.find((asset) => asset.role === 'main_cover');
  $: canExport = Boolean($identity.title && $identity.year && mainCover?.file && !validationErrors.length);
  $: sizeReport = estimatePackageSize($releaseProject, $extras);

  function progressUpdate(update) {
    progress = Math.max(progress, Math.round(Number(update.percent) || 0));
    statusLabel = update.stage || statusLabel;
  }

  async function previewExperience() {
    previewBusy = true;
    error = '';
    progress = 0;
    try {
      const result = await buildPackage({
        project: $releaseProject,
        template: $template,
        play: $play,
        extras: $extras,
        transcendence: $transcendence,
        download: false,
        onProgress: progressUpdate,
      });
      const prepared = await prepareNzForViewer(result.blob);
      previewPrepared = prepared;
      previewSent = false;
    } catch (e) {
      error = `${e.message || 'Preview failed.'} Your Studio draft is unchanged; correct the reported item and try again.`;
    } finally {
      previewBusy = false;
    }
  }

  function loadPreviewFrame() {
    if (!previewIframe?.contentWindow || !previewPrepared || previewSent) return;
    const resources = previewPrepared.resources.map((resource) => ({ ...resource }));
    previewIframe.contentWindow.postMessage({
      type: 'noizes:viewer:load',
      html: previewPrepared.html,
      resources,
    }, '*', resources.map((resource) => resource.bytes));
    previewSent = true;
  }

  function closePreview() {
    previewPrepared = null;
    previewSent = false;
  }

  async function doExport() {
    exporting = true;
    error = '';
    publishError = '';
    exported = false;
    published = false;
    progress = 0;
    statusLabel = 'Compiling package…';

    let result;
    try {
      result = await buildPackage({
        project:  $releaseProject,
        template: $template,
        play:     $play,
        extras:   $extras,
        transcendence: $transcendence,
        onProgress: progressUpdate,
      });
      exportedFilename = result.filename;
      progress = 90;
      exported = true;
    } catch (e) {
      error = `${e.message || 'Export failed.'} No draft data was removed; adjust the failing asset or metadata and compile again.`;
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
            release_type: $releaseProject.release.release_type,
            featured_artists: $releaseProject.release.featured_artists,
            compilation_artists: $releaseProject.release.compilation_artists,
            release_date: $releaseProject.release.release_date,
            catalogue_number: $releaseProject.release.catalogue_number,
            label: $releaseProject.release.label,
            curator: $releaseProject.release.curator,
            compiler: $releaseProject.release.compiler,
            venue: $releaseProject.release.venue,
            event_name: $releaseProject.release.event_name,
            recording_date: $releaseProject.release.recording_date,
            track_count: $releaseProject.tracks.length,
            disc_count: Math.max(1, ...$releaseProject.tracks.map((track) => Number(track.disc_number) || 1)),
            total_duration_ms: $releaseProject.tracks.reduce((total, track) => {
              const asset = $releaseProject.audio_assets.find((item) => item.asset_id === track.primary_audio_ref);
              return total + (Number(asset?.duration_ms) || 0);
            }, 0),
            explicit: $releaseProject.tracks.some((track) => track.explicit),
            package_size: result.blob.size,
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
        const body = await res.json().catch(() => ({}));
        published = true;
        dropPath = body.drop_path || '';
        progress = 100;
        exporting = false;
        dispatch('published');
        if (dropPath) {
          statusLabel = 'Opening your Drop Page…';
          await goto(dropPath);
          return;
        }
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
    ['manifest.json', 'Release, tracklist & complete component inventory'],
    ['edition.json', 'Edition type, size & pricing'],
    ['rights.json', 'Release and track rights declarations'],
    ['credits.json', 'Release and per-track production credits'],
    ['authenticity.json', 'Per-component sha256 inventory'],
    ['technical.json', 'Packager & timestamp'],
    ['archive.json', 'Release and track object records'],
    ['history.json', 'Release-copy provenance and work history'],
    ['experience.html', 'Offline experience entry for packaged assets'],
  ];
</script>

<div class="space-y-6">
  <div>
    <p class="t-caption mb-2">Compile &amp; Publish</p>
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
    {#if $releaseProject.audio_assets.length}
      <div class="flex items-center gap-3 py-1.5 border-b" style="border-color: var(--border-dim);">
        <span class="text-xs font-mono w-36 shrink-0" style="color: #7B5CF0;">tracks/*/audio/</span>
        <span class="text-xs" style="color: var(--ink-muted);">{$releaseProject.audio_assets.length} audio component{$releaseProject.audio_assets.length === 1 ? '' : 's'}</span>
      </div>
    {/if}
    {#if mainCover}
      <div class="flex items-center gap-3 py-1.5 border-b" style="border-color: var(--border-dim);">
        <span class="text-xs font-mono w-36 shrink-0" style="color: #7B5CF0;">release/cover/</span>
        <span class="text-xs" style="color: var(--ink-muted);">{mainCover.filename}</span>
      </div>
    {/if}
    <div class="flex items-center gap-3 py-1.5">
      <span class="text-xs font-mono w-36 shrink-0" style="color: #7B5CF0;">guided experience</span>
      <span class="text-xs" style="color: var(--ink-muted);">ULTRA · {($releaseProject.journey.release_moments?.length || 0) + ($releaseProject.journey.track_journeys || []).reduce((total, entry) => total + (entry.moments?.length || 0), 0)} moments · {$releaseProject.lyrics.reduce((total, entry) => total + (entry.timed_lines?.length || 0), 0)} timed lyric lines</span>
    </div>
  </div>

  <div class="glass rounded-xl p-4 space-y-3">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="t-caption">Package size &amp; browser load</p>
        <p class="text-xs mt-1" style="color:var(--ink-muted);">Original packaged assets stay as files; they are not duplicated inside experience.html.</p>
      </div>
      <div class="text-right shrink-0">
        <p class="text-lg font-black text-white">{formatBytes(sizeReport.original_bytes)}</p>
        <p class="text-[10px]" style="color:var(--ink-muted);">est. {formatBytes(sizeReport.browser_memory_estimate_bytes)} compile memory</p>
      </div>
    </div>
    <div class="grid sm:grid-cols-3 gap-2">
      <div class="rounded-lg p-3" style="background:rgba(255,255,255,.025);"><p class="text-[10px] uppercase tracking-wider" style="color:var(--ink-muted);">Release assets</p><p class="text-sm text-white mt-1">{formatBytes(sizeReport.release_bytes)}</p></div>
      <div class="rounded-lg p-3" style="background:rgba(255,255,255,.025);"><p class="text-[10px] uppercase tracking-wider" style="color:var(--ink-muted);">All assets as data URIs</p><p class="text-sm text-white mt-1">{formatBytes(sizeReport.all_assets_data_uri_bytes)}</p></div>
      <div class="rounded-lg p-3" style="background:rgba(255,255,255,.025);"><p class="text-[10px] uppercase tracking-wider" style="color:var(--ink-muted);">Avoided expansion</p><p class="text-sm text-white mt-1">{formatBytes(sizeReport.data_uri_expansion_bytes)}</p></div>
    </div>
    {#if sizeReport.per_track.length > 1}
      <div class="space-y-1">
        {#each sizeReport.per_track as track, index}
          <div class="flex justify-between gap-4 text-xs py-1"><span class="truncate" style="color:var(--ink-muted);">{String(index + 1).padStart(2, '0')} · {track.title || 'Untitled track'}</span><span class="font-mono text-white shrink-0">{formatBytes(track.size)}</span></div>
        {/each}
      </div>
    {/if}
    {#each sizeReport.warnings as warning}
      <div class="rounded-lg px-3 py-2 text-xs" style="background:{warning.severity === 'critical' || warning.severity === 'high' ? 'rgba(240,75,107,.08)' : 'rgba(240,176,107,.08)'};color:{warning.severity === 'critical' || warning.severity === 'high' ? '#F08A9D' : '#F0B06B'};">{warning.message}</div>
    {/each}
  </div>

  {#if !canExport}
    <div class="glass rounded-lg px-4 py-3 text-sm" style="color: var(--ink-muted); border-color: rgba(123,92,240,0.2);">
      Complete release identity and tracklist, attach every visible track’s primary audio and a main cover, then provide a valid fixed-supply edition.
      {#if validationErrors.length}
        <span class="block mt-2" style="color:#F08A9D;">{validationErrors[0]}{validationErrors.length > 1 ? ` (+${validationErrors.length - 1} more)` : ''}</span>
      {/if}
    </div>
  {/if}

  {#if validationWarnings.length}
    <div class="rounded-xl p-4 space-y-2" style="background:rgba(240,176,107,.06);border:1px solid rgba(240,176,107,.18);">
      <p class="t-caption" style="color:#F0B06B;">Declarations &amp; package warnings · {validationWarnings.length}</p>
      {#each validationWarnings as warning}
        <div class="text-xs flex gap-2" style="color:var(--ink-muted);"><span style="color:#F0B06B;">○</span><span>{warning.message}</span></div>
      {/each}
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
          <p class="text-xs text-white">
            Published —
            {#if dropPath}
              <a href={dropPath} class="underline" style="color: #7B5CF0;">open your Drop Page</a>
            {:else}
              <a href="/exchange" class="underline" style="color: #7B5CF0;">view it live</a>
            {/if}
          </p>
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

  <div class="grid sm:grid-cols-[.42fr_.58fr] gap-3">
    <button class="btn-ghost w-full justify-center py-3.5 text-base rounded-xl" disabled={!canExport || exporting || previewBusy} on:click={previewExperience}>
      {previewBusy ? 'Preparing preview…' : 'Preview exact package'}
    </button>
    <button
      class="btn-spectral w-full justify-center py-3.5 text-base rounded-xl"
      disabled={!canExport || exporting || previewBusy}
      on:click={doExport}
    >
      {#if exporting}
        {progress < 90 ? 'Compiling…' : 'Publishing…'}
      {:else}
        ⬡ Compile & Publish .nz
      {/if}
    </button>
  </div>
</div>

{#if previewPrepared}
  <div class="fixed inset-0 z-[200] flex flex-col" style="background:#030303;">
    <div class="h-12 px-4 flex items-center justify-between border-b" style="border-color:rgba(255,255,255,.08);background:#080808;">
      <div><span class="text-xs font-black text-white">STUDIO PREVIEW</span><span class="text-[10px] ml-3" style="color:var(--ink-muted);">Generated .nz · real multi-track playback and Journey timing</span></div>
      <button class="btn-ghost rounded-full px-4 py-1.5 text-xs" on:click={closePreview}>Close preview</button>
    </div>
    <iframe bind:this={previewIframe} title="Studio package preview" srcdoc={VIEWER_FRAME_BOOTSTRAP} on:load={loadPreviewFrame} allow="autoplay" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads" class="flex-1 w-full border-0"></iframe>
  </div>
{/if}
