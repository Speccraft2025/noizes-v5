<script>
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
  $: tracks = orderedTracks($releaseProject.tracks);
  $: if (!selectedTrackId || !tracks.some((track) => track.track_id === selectedTrackId)) selectedTrackId = tracks[0]?.track_id || '';
  $: selectedTrack = tracks.find((track) => track.track_id === selectedTrackId);
  $: selectedVersions = $releaseProject.audio_versions.filter((version) => version.track_id === selectedTrackId);
  $: mainCover = $releaseProject.release_assets.find((asset) => asset.role === 'main_cover');
  $: continuousMaster = $releaseProject.audio_assets.find((asset) => asset.scope === 'release' && asset.role === 'continuous_master');
  $: trackArtwork = $releaseProject.track_assets.find((asset) => asset.track_id === selectedTrackId && asset.role === 'track_artwork');

  const roleLabel = (role) => role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const sizeLabel = (size) => size ? `${(size / 1024 / 1024).toFixed(size > 10 * 1024 * 1024 ? 0 : 1)} MB` : '';

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
    releaseProject.update((project) => ({
      ...project,
      release_assets: project.release_assets.filter((asset) => asset.asset_id !== assetId),
    }));
  }

  function setContinuousMaster(file) {
    if (!file) return;
    releaseProject.update((project) => {
      const existing = project.audio_assets.find((asset) => asset.scope === 'release' && asset.role === 'continuous_master');
      const asset = existing
        ? { ...existing, file, filename: file.name, mime: file.type, size: file.size }
        : createAudioAsset({ scope: 'release', role: 'continuous_master', file }, { releaseId: project.release.release_id });
      return {
        ...project,
        audio_assets: [...project.audio_assets.filter((item) => item.asset_id !== asset.asset_id), asset],
      };
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

  function attachAudio(file, role = 'primary_master') {
    if (!file || !selectedTrackId) return;
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
        ? { ...existingAsset, file, filename: file.name, mime: file.type, size: file.size }
        : createAudioAsset({
            track_id: selectedTrackId,
            version_id: version.version_id,
            scope: 'track',
            role,
            title: roleLabel(role),
            file,
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

  function removeVersion(versionId) {
    releaseProject.update((project) => {
      const removedAssets = new Set(project.audio_assets.filter((asset) => asset.version_id === versionId).map((asset) => asset.asset_id));
      return {
        ...project,
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
        <p class="label-dark">Main cover *</p>
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
        <p class="label-dark">Continuous master</p>
        {#if continuousMaster}
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-violet">♫</span>
            <span class="text-xs text-white truncate flex-1">{continuousMaster.filename}</span>
            <button type="button" class="text-[10px]" style="color:var(--ink-muted);" on:click={() => releaseProject.update((project) => ({ ...project, audio_assets: project.audio_assets.filter((asset) => asset.asset_id !== continuousMaster.asset_id) }))}>remove</button>
          </div>
        {:else}
          <label class="block rounded-lg py-5 text-center cursor-pointer" style="border:1px dashed var(--border-dim);">
            <span class="text-xs text-white">Optional mix / concert master</span>
            <input class="hidden" type="file" accept="audio/*,.wav,.flac,.mp3,.m4a" on:change={(event) => setContinuousMaster(event.currentTarget.files?.[0])} />
          </label>
        {/if}
      </div>
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
            <label class="btn-ghost text-xs py-1.5 px-3 cursor-pointer shrink-0">
              {trackArtwork ? 'Replace artwork' : 'Track artwork'}
              <input class="hidden" type="file" accept="image/*" on:change={(event) => setTrackArtwork(event.currentTarget.files?.[0])} />
            </label>
          </div>

          {#if trackArtwork}
            <div class="flex items-center gap-2 rounded-lg px-3 py-2" style="background:rgba(255,255,255,.03);">
              <span class="text-violet">◼</span>
              <span class="text-xs text-white truncate flex-1">{trackArtwork.filename}</span>
              <button type="button" class="text-[10px]" style="color:var(--ink-muted);" on:click={() => releaseProject.update((project) => ({
                ...project,
                track_assets: project.track_assets.filter((asset) => asset.asset_id !== trackArtwork.asset_id),
                tracks: project.tracks.map((track) => track.track_id === selectedTrackId ? { ...track, artwork_ref: '' } : track),
              }))}>remove</button>
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
            <label class="rounded-xl flex flex-col items-center justify-center py-7 cursor-pointer" style="border:1px dashed rgba(123,92,240,.35);background:rgba(123,92,240,.05);">
              <span class="font-bold text-sm text-white">Upload primary master *</span>
              <span class="text-xs mt-1" style="color:var(--ink-muted);">WAV · FLAC · MP3 · M4A</span>
              <input class="hidden" type="file" accept="audio/*,.wav,.flac,.mp3,.m4a" on:change={(event) => attachAudio(event.currentTarget.files?.[0], 'primary_master')} />
            </label>
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
        </div>
      {/if}
    {:else}
      <div class="glass rounded-xl p-6 text-center text-sm" style="color:var(--ink-muted);">Add track records in Step 2, or use a release-level continuous master for a chaptered DJ Mix.</div>
    {/if}
  </section>
</div>
