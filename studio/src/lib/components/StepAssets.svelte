<script>
  import HelpTip from '$lib/components/HelpTip.svelte';
  import { releaseProject } from '$lib/stores/package.js';
  import {
    AUDIO_VERSION_ROLES,
    createAudioAsset,
    createAudioVersion,
    createReleaseAsset,
    createTrackAsset,
    orderedTracks,
  } from '$lib/domain/release.js';

  let selectedTrackId = '';
  let alternateRole = 'instrumental';
  let releaseSupplementRole = 'back_cover';
  let trackSupplementRole = 'track_image';
  $: tracks = orderedTracks($releaseProject.tracks);
  $: if (!selectedTrackId || !tracks.some((track) => track.track_id === selectedTrackId)) selectedTrackId = tracks[0]?.track_id || '';
  $: selectedTrack = tracks.find((track) => track.track_id === selectedTrackId);
  $: selectedVersions = $releaseProject.audio_versions.filter((version) => version.track_id === selectedTrackId);
  $: mainCover = $releaseProject.release_assets.find((asset) => asset.role === 'main_cover');
  $: continuousMaster = $releaseProject.audio_assets.find((asset) => asset.scope === 'release' && asset.role === 'continuous_master');
  $: trackArtwork = $releaseProject.track_assets.find((asset) => asset.track_id === selectedTrackId && asset.role === 'track_artwork');

  const roleLabel = (role) => role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const sizeLabel = (size) => size ? `${(size / 1024 / 1024).toFixed(size > 10 * 1024 * 1024 ? 0 : 1)} MB` : '';
  const RELEASE_SUPPORT = {
    back_cover: { label: 'Back cover', type: 'image', accept: 'image/*' },
    booklet_artwork: { label: 'Booklet artwork', type: 'image', accept: 'image/*' },
    release_trailer: { label: 'Release trailer', type: 'video', accept: 'video/*' },
    photograph: { label: 'Release photograph', type: 'image', accept: 'image/*' },
    document: { label: 'Release PDF / document', type: 'document', accept: '.pdf,application/pdf' },
    commentary: { label: 'Release commentary', type: 'audio', accept: 'audio/*,.wav,.flac,.mp3,.m4a' },
    promotional_material: { label: 'Promotional material', type: 'document', accept: 'image/*,.pdf,application/pdf' },
    typography: { label: 'Typography / design asset', type: 'image', accept: 'image/*' },
  };
  const TRACK_SUPPORT = {
    track_image: { label: 'Track image', type: 'image', accept: 'image/*' },
    music_video: { label: 'Music video', type: 'video', accept: 'video/*' },
    visualiser: { label: 'Visualiser', type: 'video', accept: 'video/*' },
    track_document: { label: 'Track note / PDF', type: 'document', accept: '.pdf,application/pdf' },
  };

  function dropPermissions(project, assetIds) {
    const removed = assetIds instanceof Set ? assetIds : new Set(assetIds);
    return {
      ...project,
      rights: {
        ...project.rights,
        asset_permissions: (project.rights.asset_permissions || []).filter((permission) => !removed.has(permission.asset_id)),
      },
    };
  }

  async function audioDuration(file) {
    if (typeof document === 'undefined' || !file) return 0;
    return new Promise((resolve) => {
      const element = document.createElement('audio');
      const url = URL.createObjectURL(file);
      const done = (value) => { URL.revokeObjectURL(url); resolve(Number.isFinite(value) ? Math.round(value * 1000) : 0); };
      element.preload = 'metadata';
      element.onloadedmetadata = () => done(element.duration);
      element.onerror = () => done(0);
      element.src = url;
    });
  }

  function setReleaseFile(role, type, file) {
    if (!file) return;
    releaseProject.update((project) => {
      const existing = project.release_assets.find((asset) => asset.role === role);
      const asset = existing
        ? { ...existing, file, filename: file.name, mime: file.type, size: file.size }
        : createReleaseAsset({ role, type, file }, { releaseId: project.release.release_id });
      return {
        ...project,
        release_assets: [...project.release_assets.filter((item) => item.asset_id !== asset.asset_id), asset],
      };
    });
  }

  function removeReleaseFile(assetId) {
    releaseProject.update((project) => dropPermissions({
      ...project,
      release_assets: project.release_assets.filter((asset) => asset.asset_id !== assetId),
      audio_assets: project.audio_assets.filter((asset) => asset.asset_id !== assetId),
    }, new Set([assetId])));
  }

  function removeTrackFile(assetId) {
    releaseProject.update((project) => dropPermissions({
      ...project,
      track_assets: project.track_assets.filter((asset) => asset.asset_id !== assetId),
      tracks: project.tracks.map((track) => track.artwork_ref === assetId ? { ...track, artwork_ref: '' } : track),
    }, new Set([assetId])));
  }

  async function setContinuousMaster(file) {
    if (!file) return;
    const duration_ms = await audioDuration(file);
    releaseProject.update((project) => {
      const existing = project.audio_assets.find((asset) => asset.scope === 'release' && asset.role === 'continuous_master');
      const asset = existing
        ? { ...existing, file, filename: file.name, mime: file.type, size: file.size, duration_ms }
        : createAudioAsset({ scope: 'release', role: 'continuous_master', file, duration_ms }, { releaseId: project.release.release_id });
      return {
        ...project,
        audio_assets: [...project.audio_assets.filter((item) => item.asset_id !== asset.asset_id), asset],
      };
    });
  }

  async function addReleaseSupplement(file) {
    if (!file) return;
    const definition = RELEASE_SUPPORT[releaseSupplementRole];
    const duration_ms = definition.type === 'audio' ? await audioDuration(file) : 0;
    releaseProject.update((project) => {
      if (definition.type === 'audio') {
        const asset = createAudioAsset({ scope: 'release', role: releaseSupplementRole, type: 'audio', file, duration_ms }, { releaseId: project.release.release_id });
        return { ...project, audio_assets: [...project.audio_assets, asset] };
      }
      const asset = createReleaseAsset({ role: releaseSupplementRole, type: definition.type, file }, { releaseId: project.release.release_id });
      return { ...project, release_assets: [...project.release_assets, asset] };
    });
  }

  function setTrackArtwork(file) {
    if (!file || !selectedTrackId) return;
    releaseProject.update((project) => {
      const existing = project.track_assets.find((asset) => asset.track_id === selectedTrackId && asset.role === 'track_artwork');
      const asset = existing
        ? { ...existing, file, filename: file.name, mime: file.type, size: file.size }
        : createTrackAsset({ track_id: selectedTrackId, role: 'track_artwork', type: 'image', file }, {
            releaseId: project.release.release_id,
            trackId: selectedTrackId,
          });
      return {
        ...project,
        track_assets: [...project.track_assets.filter((item) => item.asset_id !== asset.asset_id), asset],
        tracks: project.tracks.map((track) => track.track_id === selectedTrackId ? { ...track, artwork_ref: asset.asset_id } : track),
      };
    });
  }

  async function attachAudio(file, role = 'primary_master') {
    if (!file || !selectedTrackId) return;
    const duration_ms = await audioDuration(file);
    releaseProject.update((project) => {
      const primary = role === 'primary_master';
      const existingVersion = primary
        ? project.audio_versions.find((version) => version.track_id === selectedTrackId && version.is_primary)
        : null;
      const existingAsset = existingVersion
        ? project.audio_assets.find((asset) => asset.version_id === existingVersion.version_id)
        : null;
      let version = existingVersion || createAudioVersion({
        track_id: selectedTrackId,
        role,
        is_primary: primary,
        title: roleLabel(role),
      });
      const asset = existingAsset
        ? { ...existingAsset, file, filename: file.name, mime: file.type, size: file.size, duration_ms }
        : createAudioAsset({
            track_id: selectedTrackId,
            version_id: version.version_id,
            scope: 'track',
            role,
            title: roleLabel(role),
            file,
            duration_ms,
          }, { releaseId: project.release.release_id });
      version = { ...version, audio_asset_id: asset.asset_id };
      return {
        ...project,
        audio_versions: [...project.audio_versions.filter((item) => item.version_id !== version.version_id), version],
        audio_assets: [...project.audio_assets.filter((item) => item.asset_id !== asset.asset_id), asset],
        tracks: project.tracks.map((track) => track.track_id === selectedTrackId && primary
          ? { ...track, primary_version_id: version.version_id, primary_audio_ref: asset.asset_id }
          : track),
      };
    });
  }

  function addTrackSupplement(file) {
    if (!file || !selectedTrackId) return;
    const definition = TRACK_SUPPORT[trackSupplementRole];
    releaseProject.update((project) => {
      const asset = createTrackAsset({ track_id: selectedTrackId, role: trackSupplementRole, type: definition.type, file }, {
        releaseId: project.release.release_id,
        trackId: selectedTrackId,
      });
      return { ...project, track_assets: [...project.track_assets, asset] };
    });
  }

  function removeVersion(versionId) {
    releaseProject.update((project) => {
      const removedAssets = new Set(project.audio_assets.filter((asset) => asset.version_id === versionId).map((asset) => asset.asset_id));
      return {
        ...dropPermissions(project, removedAssets),
        audio_versions: project.audio_versions.filter((version) => version.version_id !== versionId),
        audio_assets: project.audio_assets.filter((asset) => !removedAssets.has(asset.asset_id)),
        tracks: project.tracks.map((track) => track.primary_version_id === versionId
          ? { ...track, primary_version_id: '', primary_audio_ref: '' }
          : track),
      };
    });
  }
</script>

<div class="space-y-6">
  <div>
    <p class="t-caption mb-2">Step 3</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Assets</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">Attach release-wide material and each track’s own masters and artwork.</p>
  </div>

  <section class="space-y-3">
    <div>
      <p class="t-caption">Release-level assets</p>
      <p class="text-xs mt-1" style="color:var(--ink-muted);">Shared by the complete edition.</p>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="glass rounded-xl p-3">
        <p class="label-dark">Main cover *<HelpTip field="main_cover" /></p>
        {#if mainCover}
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-violet">◼</span>
            <span class="text-xs text-white truncate flex-1">{mainCover.filename}</span>
            <button type="button" class="text-[10px]" style="color:var(--ink-muted);" on:click={() => removeReleaseFile(mainCover.asset_id)}>remove</button>
          </div>
        {:else}
          <label class="block rounded-lg py-5 text-center cursor-pointer" style="border:1px dashed var(--border-dim);">
            <span class="text-xs text-white">Choose image</span>
            <input class="hidden" type="file" accept="image/*" on:change={(event) => setReleaseFile('main_cover', 'image', event.currentTarget.files?.[0])} />
          </label>
        {/if}
      </div>

      <div class="glass rounded-xl p-3">
        <p class="label-dark">Continuous master<HelpTip field="continuous_master" /></p>
        {#if continuousMaster}
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-violet">♫</span>
            <span class="text-xs text-white truncate flex-1">{continuousMaster.filename}</span>
            <button type="button" class="text-[10px]" style="color:var(--ink-muted);" on:click={() => removeReleaseFile(continuousMaster.asset_id)}>remove</button>
          </div>
        {:else}
          <label class="block rounded-lg py-5 text-center cursor-pointer" style="border:1px dashed var(--border-dim);">
            <span class="text-xs text-white">Optional mix / concert master</span>
            <input class="hidden" type="file" accept="audio/*,.wav,.flac,.mp3,.m4a" on:change={(event) => setContinuousMaster(event.currentTarget.files?.[0])} />
          </label>
        {/if}
      </div>
    </div>

    <div class="glass rounded-xl p-3 space-y-3">
      <div class="grid sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
        <select class="input-dark" bind:value={releaseSupplementRole}>
          {#each Object.entries(RELEASE_SUPPORT) as [role, definition]}<option value={role}>{definition.label}</option>{/each}
        </select>
        <label class="btn-ghost flex items-center justify-center cursor-pointer shrink-0">
          ＋ Add release asset
          <input class="hidden" type="file" accept={RELEASE_SUPPORT[releaseSupplementRole].accept} on:change={(event) => { addReleaseSupplement(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
        </label>
      </div>
      {#each [...$releaseProject.release_assets.filter((asset) => asset.role !== 'main_cover'), ...$releaseProject.audio_assets.filter((asset) => asset.scope === 'release' && asset.role !== 'continuous_master')] as asset (asset.asset_id)}
        <div class="flex items-center gap-2 rounded-lg px-3 py-2" style="background:rgba(255,255,255,.03);">
          <span style="color:#7B5CF0;">{asset.type === 'video' ? '▶' : asset.type === 'audio' ? '♫' : asset.type === 'document' ? '▤' : '◼'}</span>
          <span class="text-xs text-white truncate flex-1">{asset.filename}</span>
          <span class="text-[10px]" style="color:var(--ink-muted);">{roleLabel(asset.role)} · {sizeLabel(asset.size)}</span>
          <button type="button" class="text-[10px]" style="color:var(--ink-muted);" on:click={() => removeReleaseFile(asset.asset_id)}>remove</button>
        </div>
      {/each}
    </div>
  </section>

  <section class="space-y-4">
    <div>
      <p class="t-caption">Track-level assets</p>
      <p class="text-xs mt-1" style="color:var(--ink-muted);">Select a work, then attach its primary master and optional versions.</p>
    </div>

    {#if tracks.length}
      <div class="flex gap-2 overflow-x-auto pb-1">
        {#each tracks as track}
          <button type="button" class="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold" style={selectedTrackId === track.track_id
            ? 'background:#7B5CF0;color:white;'
            : 'background:rgba(255,255,255,.05);color:var(--ink-muted);'} on:click={() => selectedTrackId = track.track_id}>
            {track.disc_number}.{track.track_number} {track.title || 'Untitled'}
          </button>
        {/each}
      </div>

      {#if selectedTrack}
        <div class="glass rounded-xl p-4 space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="font-bold text-white truncate">{selectedTrack.title || 'Untitled track'}</p>
              <p class="text-xs truncate" style="color:var(--ink-muted);">{selectedTrack.primary_artist}</p>
            </div>
            <!-- The tip sits outside the label: nested in it, a click would
                 also open the file picker. -->
            <div class="flex items-center gap-1 shrink-0">
              <label class="btn-ghost text-xs py-1.5 px-3 cursor-pointer">
                {trackArtwork ? 'Replace artwork' : 'Track artwork'}
                <input class="hidden" type="file" accept="image/*" on:change={(event) => setTrackArtwork(event.currentTarget.files?.[0])} />
              </label>
              <HelpTip field="track_artwork" align="right" />
            </div>
          </div>

          {#if trackArtwork}
            <div class="flex items-center gap-2 rounded-lg px-3 py-2" style="background:rgba(255,255,255,.03);">
              <span class="text-violet">◼</span>
              <span class="text-xs text-white truncate flex-1">{trackArtwork.filename}</span>
              <button type="button" class="text-[10px]" style="color:var(--ink-muted);" on:click={() => removeTrackFile(trackArtwork.asset_id)}>remove</button>
            </div>
          {/if}

          <div class="space-y-2">
            {#each selectedVersions as version (version.version_id)}
              {@const audio = $releaseProject.audio_assets.find((asset) => asset.version_id === version.version_id)}
              <div class="rounded-lg px-3 py-3 flex items-center gap-3" style="background:rgba(255,255,255,.035);border:1px solid var(--border-dim);">
                <span class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:{version.is_primary ? 'rgba(123,92,240,.18)' : 'rgba(255,255,255,.05)'};color:#7B5CF0;">♫</span>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-bold text-white">{roleLabel(version.role)}{version.is_primary ? ' · primary' : ''}</p>
                  <p class="text-[10px] truncate" style="color:var(--ink-muted);">{audio?.filename || 'File missing'} {audio?.size ? `· ${sizeLabel(audio.size)}` : ''}</p>
                </div>
                <button type="button" class="text-[10px]" style="color:var(--ink-muted);" on:click={() => removeVersion(version.version_id)}>remove</button>
              </div>
            {/each}
          </div>

          {#if !selectedVersions.some((version) => version.is_primary)}
            <div class="relative">
              <label class="rounded-xl flex flex-col items-center justify-center py-7 cursor-pointer" style="border:1px dashed rgba(123,92,240,.35);background:rgba(123,92,240,.05);">
                <span class="font-bold text-sm text-white">Upload primary master *</span>
                <span class="text-xs mt-1" style="color:var(--ink-muted);">WAV · FLAC · MP3 · M4A</span>
                <input class="hidden" type="file" accept="audio/*,.wav,.flac,.mp3,.m4a" on:change={(event) => attachAudio(event.currentTarget.files?.[0], 'primary_master')} />
              </label>
              <span class="absolute top-2 right-3"><HelpTip field="primary_master" align="right" /></span>
            </div>
          {/if}

          <div class="flex gap-2">
            <select class="input-dark flex-1" bind:value={alternateRole}>
              {#each AUDIO_VERSION_ROLES.filter((role) => role !== 'primary_master') as role}
                <option value={role}>{roleLabel(role)}</option>
              {/each}
            </select>
            <label class="btn-ghost flex items-center cursor-pointer shrink-0">
              ＋ Add version
              <input class="hidden" type="file" accept="audio/*,.wav,.flac,.mp3,.m4a" on:change={(event) => { attachAudio(event.currentTarget.files?.[0], alternateRole); event.currentTarget.value = ''; }} />
            </label>
          </div>

          <div class="pt-3 space-y-2" style="border-top:1px solid var(--border-dim);">
            <p class="text-[10px] uppercase tracking-widest" style="color:var(--ink-muted);">Track media &amp; documents</p>
            {#each $releaseProject.track_assets.filter((asset) => asset.track_id === selectedTrackId && asset.role !== 'track_artwork') as asset (asset.asset_id)}
              <div class="flex items-center gap-2 rounded-lg px-3 py-2" style="background:rgba(255,255,255,.03);">
                <span style="color:#7B5CF0;">{asset.type === 'video' ? '▶' : asset.type === 'document' ? '▤' : '◼'}</span>
                <span class="text-xs text-white truncate flex-1">{asset.filename}</span>
                <span class="text-[10px]" style="color:var(--ink-muted);">{roleLabel(asset.role)} · {sizeLabel(asset.size)}</span>
                <button type="button" class="text-[10px]" style="color:var(--ink-muted);" on:click={() => removeTrackFile(asset.asset_id)}>remove</button>
              </div>
            {/each}
            <div class="grid sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
              <select class="input-dark" bind:value={trackSupplementRole}>
                {#each Object.entries(TRACK_SUPPORT) as [role, definition]}<option value={role}>{definition.label}</option>{/each}
              </select>
              <label class="btn-ghost flex items-center justify-center cursor-pointer shrink-0">
                ＋ Add track asset
                <input class="hidden" type="file" accept={TRACK_SUPPORT[trackSupplementRole].accept} on:change={(event) => { addTrackSupplement(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
              </label>
            </div>
          </div>
        </div>
      {/if}
    {:else}
      <div class="glass rounded-xl p-6 text-center text-sm" style="color:var(--ink-muted);">Add track records in Step 2, or use a release-level continuous master for a chaptered DJ Mix.</div>
    {/if}
  </section>
</div>
