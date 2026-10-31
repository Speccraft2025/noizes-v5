<script>
  import FocusedSection from './FocusedSection.svelte';
  import StudioField from './StudioField.svelte';
  import StepTracklist from '#lib/components/StepTracklist.svelte';
  import HelpTip from '#lib/components/HelpTip.svelte';
  import MagneticDropZone from '#lib/components/ui/MagneticDropZone.svelte';
  import { releaseProject } from '#lib/stores/package.js';
  import {
    AUDIO_VERSION_ROLES,
    createAudioAsset,
    createAudioVersion,
    createReleaseAsset,
    createTrackAsset,
    orderedTracks,
  } from '#lib/domain/release.js';
  import { currentSection, STEPS, markSectionState, nextSection, prevSection } from '#lib/stores/studio-nav.js';

  const step = STEPS[1];
  const sections = step.sections;

  let selectedTrackId = '';
  let alternateRole = 'instrumental';
  let releaseSupplementRole = 'back_cover';
  let trackSupplementRole = 'track_image';

  $: tracks = orderedTracks($releaseProject.tracks);
  $: if (!selectedTrackId || !tracks.some((t) => t.track_id === selectedTrackId)) selectedTrackId = tracks[0]?.track_id || '';
  $: selectedTrack = tracks.find((t) => t.track_id === selectedTrackId);
  $: selectedVersions = $releaseProject.audio_versions.filter((v) => v.track_id === selectedTrackId);
  $: mainCover = $releaseProject.release_assets.find((a) => a.role === 'main_cover');
  $: continuousMaster = $releaseProject.audio_assets.find((a) => a.scope === 'release' && a.role === 'continuous_master');
  $: trackArtwork = $releaseProject.track_assets.find((a) => a.track_id === selectedTrackId && a.role === 'track_artwork');

  const roleLabel = (role) => role.replaceAll('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const sizeLabel = (size) => size ? `${(size / 1024 / 1024).toFixed(size > 10485760 ? 0 : 1)} MB` : '';

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
        asset_permissions: (project.rights.asset_permissions || []).filter((p) => !removed.has(p.asset_id)),
      },
    };
  }

  async function audioDuration(file) {
    if (typeof document === 'undefined' || !file) return 0;
    return new Promise((resolve) => {
      const el = document.createElement('audio');
      const url = URL.createObjectURL(file);
      const done = (v) => { URL.revokeObjectURL(url); resolve(Number.isFinite(v) ? Math.round(v * 1000) : 0); };
      el.preload = 'metadata';
      el.onloadedmetadata = () => done(el.duration);
      el.onerror = () => done(0);
      el.src = url;
    });
  }

  function setReleaseFile(role, type, file) {
    if (!file) return;
    releaseProject.update((p) => {
      const existing = p.release_assets.find((a) => a.role === role);
      const asset = existing
        ? { ...existing, file, filename: file.name, mime: file.type, size: file.size }
        : createReleaseAsset({ role, type, file }, { releaseId: p.release.release_id });
      return { ...p, release_assets: [...p.release_assets.filter((i) => i.asset_id !== asset.asset_id), asset] };
    });
  }

  function removeReleaseFile(assetId) {
    releaseProject.update((p) => dropPermissions({
      ...p,
      release_assets: p.release_assets.filter((a) => a.asset_id !== assetId),
      audio_assets: p.audio_assets.filter((a) => a.asset_id !== assetId),
    }, new Set([assetId])));
  }

  function removeTrackFile(assetId) {
    releaseProject.update((p) => dropPermissions({
      ...p,
      track_assets: p.track_assets.filter((a) => a.asset_id !== assetId),
      tracks: p.tracks.map((t) => t.artwork_ref === assetId ? { ...t, artwork_ref: '' } : t),
    }, new Set([assetId])));
  }

  async function setContinuousMaster(file) {
    if (!file) return;
    const duration_ms = await audioDuration(file);
    releaseProject.update((p) => {
      const existing = p.audio_assets.find((a) => a.scope === 'release' && a.role === 'continuous_master');
      const asset = existing
        ? { ...existing, file, filename: file.name, mime: file.type, size: file.size, duration_ms }
        : createAudioAsset({ scope: 'release', role: 'continuous_master', file, duration_ms }, { releaseId: p.release.release_id });
      return { ...p, audio_assets: [...p.audio_assets.filter((i) => i.asset_id !== asset.asset_id), asset] };
    });
  }

  async function attachAudio(file, role = 'primary_master') {
    if (!file || !selectedTrackId) return;
    const duration_ms = await audioDuration(file);
    releaseProject.update((p) => {
      const primary = role === 'primary_master';
      const existingVersion = primary ? p.audio_versions.find((v) => v.track_id === selectedTrackId && v.is_primary) : null;
      const existingAsset = existingVersion ? p.audio_assets.find((a) => a.version_id === existingVersion.version_id) : null;
      let version = existingVersion || createAudioVersion({ track_id: selectedTrackId, role, is_primary: primary, title: roleLabel(role) });
      const asset = existingAsset
        ? { ...existingAsset, file, filename: file.name, mime: file.type, size: file.size, duration_ms }
        : createAudioAsset({ track_id: selectedTrackId, version_id: version.version_id, scope: 'track', role, title: roleLabel(role), file, duration_ms }, { releaseId: p.release.release_id });
      version = { ...version, audio_asset_id: asset.asset_id };
      return {
        ...p,
        audio_versions: [...p.audio_versions.filter((i) => i.version_id !== version.version_id), version],
        audio_assets: [...p.audio_assets.filter((i) => i.asset_id !== asset.asset_id), asset],
        tracks: p.tracks.map((t) => t.track_id === selectedTrackId && primary ? { ...t, primary_version_id: version.version_id, primary_audio_ref: asset.asset_id } : t),
      };
    });
  }

  async function addReleaseSupplement(file) {
    if (!file) return;
    const def = RELEASE_SUPPORT[releaseSupplementRole];
    const duration_ms = def.type === 'audio' ? await audioDuration(file) : 0;
    releaseProject.update((p) => {
      if (def.type === 'audio') {
        const asset = createAudioAsset({ scope: 'release', role: releaseSupplementRole, type: 'audio', file, duration_ms }, { releaseId: p.release.release_id });
        return { ...p, audio_assets: [...p.audio_assets, asset] };
      }
      const asset = createReleaseAsset({ role: releaseSupplementRole, type: def.type, file }, { releaseId: p.release.release_id });
      return { ...p, release_assets: [...p.release_assets, asset] };
    });
  }

  function setTrackArtwork(file) {
    if (!file || !selectedTrackId) return;
    releaseProject.update((p) => {
      const existing = p.track_assets.find((a) => a.track_id === selectedTrackId && a.role === 'track_artwork');
      const asset = existing
        ? { ...existing, file, filename: file.name, mime: file.type, size: file.size }
        : createTrackAsset({ track_id: selectedTrackId, role: 'track_artwork', type: 'image', file }, { releaseId: p.release.release_id, trackId: selectedTrackId });
      return {
        ...p,
        track_assets: [...p.track_assets.filter((i) => i.asset_id !== asset.asset_id), asset],
        tracks: p.tracks.map((t) => t.track_id === selectedTrackId ? { ...t, artwork_ref: asset.asset_id } : t),
      };
    });
  }

  function addTrackSupplement(file) {
    if (!file || !selectedTrackId) return;
    const def = TRACK_SUPPORT[trackSupplementRole];
    releaseProject.update((p) => {
      const asset = createTrackAsset({ track_id: selectedTrackId, role: trackSupplementRole, type: def.type, file }, { releaseId: p.release.release_id, trackId: selectedTrackId });
      return { ...p, track_assets: [...p.track_assets, asset] };
    });
  }

  function removeVersion(versionId) {
    releaseProject.update((p) => {
      const removedAssets = new Set(p.audio_assets.filter((a) => a.version_id === versionId).map((a) => a.asset_id));
      return {
        ...dropPermissions(p, removedAssets),
        audio_versions: p.audio_versions.filter((v) => v.version_id !== versionId),
        audio_assets: p.audio_assets.filter((a) => !removedAssets.has(a.asset_id)),
        tracks: p.tracks.map((t) => t.primary_version_id === versionId ? { ...t, primary_version_id: '', primary_audio_ref: '' } : t),
      };
    });
  }

  function handleContinue() {
    const sec = $currentSection;
    markSectionState(step.id, sec.id, 'complete');
    nextSection();
  }

  function handleBack() { prevSection(); }

  $: sectionId = $currentSection?.id;

  $: allReleaseSupplementary = [
    ...$releaseProject.release_assets.filter((a) => a.role !== 'main_cover'),
    ...$releaseProject.audio_assets.filter((a) => a.scope === 'release' && a.role !== 'continuous_master'),
  ];

  $: totalAudioAttached = tracks.filter((t) => {
    return $releaseProject.audio_versions.some((v) => v.track_id === t.track_id && v.is_primary);
  }).length;
</script>

<!-- Section 1: Audio -->
{#if sectionId === 'audio'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[0].label}
    sectionNumber={1}
    totalSections={sections.length}
    heading={sections[0].heading}
    subtext={sections[0].subtext}
    wide={true}
    on:continue={handleContinue}
    on:back={handleBack}
  >
    <details class="tracklist-disclosure" open={!tracks.length}>
      <summary>{tracks.length ? `Manage ${tracks.length} track${tracks.length === 1 ? '' : 's'}` : 'Create your first track'}</summary>
      <div class="tracklist-editor">
        <StepTracklist />
      </div>
    </details>

    {#if tracks.length}
      <div class="track-selector">
        {#each tracks as track}
          <button type="button" class="track-pill" class:track-pill-active={selectedTrackId === track.track_id} on:click={() => selectedTrackId = track.track_id}>
            {track.disc_number}.{track.track_number} {track.title || 'Untitled'}
          </button>
        {/each}
      </div>

      {#if selectedTrack}
        <div class="asset-card">
          <div class="asset-card-header">
            <div>
              <p class="asset-card-title">{selectedTrack.title || 'Untitled track'}</p>
              <p class="asset-card-sub">{selectedTrack.primary_artist}</p>
            </div>
          </div>

          {#each selectedVersions as version (version.version_id)}
            {@const audio = $releaseProject.audio_assets.find((a) => a.version_id === version.version_id)}
            <div class="asset-row">
              <span class="asset-icon" style={version.is_primary ? 'background:rgba(123,92,240,.18);' : ''}>♫</span>
              <div class="asset-row-info">
                <p class="asset-row-name">{roleLabel(version.role)}{version.is_primary ? ' · primary' : ''}</p>
                <p class="asset-row-meta">{audio?.filename || 'File missing'} {audio?.size ? `· ${sizeLabel(audio.size)}` : ''}</p>
              </div>
              <button type="button" class="asset-row-action" on:click={() => removeVersion(version.version_id)}>remove</button>
            </div>
          {/each}

          {#if !selectedVersions.some((v) => v.is_primary)}
            <MagneticDropZone
              accept="audio/*,.wav,.flac,.mp3,.m4a"
              label="Drop primary master"
              hint="WAV · FLAC · MP3 · M4A"
              on:files={(e) => attachAudio(e.detail[0], 'primary_master')}
            />
          {/if}

          <div class="asset-add-row">
            <select class="asset-select" bind:value={alternateRole}>
              {#each AUDIO_VERSION_ROLES.filter((r) => r !== 'primary_master') as role}
                <option value={role}>{roleLabel(role)}</option>
              {/each}
            </select>
            <label class="asset-add-btn">
              + Add version
              <input class="sr-only" type="file" accept="audio/*,.wav,.flac,.mp3,.m4a" on:change={(e) => { attachAudio(e.currentTarget.files?.[0], alternateRole); e.currentTarget.value = ''; }} />
            </label>
          </div>
        </div>
      {/if}
    {:else}
      <div class="empty-state">Add track records in Identity, or use a release-level continuous master for a chaptered DJ Mix.</div>
    {/if}

    <div class="asset-card">
      <p class="asset-card-title">Continuous master</p>
      <p class="asset-card-sub">For DJ mixes and live recordings</p>
      {#if continuousMaster}
        <div class="asset-row">
          <span class="asset-icon">♫</span>
          <div class="asset-row-info">
            <p class="asset-row-name">{continuousMaster.filename}</p>
          </div>
          <button type="button" class="asset-row-action" on:click={() => removeReleaseFile(continuousMaster.asset_id)}>remove</button>
        </div>
      {:else}
        <MagneticDropZone
          accept="audio/*,.wav,.flac,.mp3,.m4a"
          label="Drop mix / concert master"
          hint="WAV · FLAC · MP3 · M4A"
          on:files={(e) => setContinuousMaster(e.detail[0])}
        />
      {/if}
    </div>
  </FocusedSection>
{/if}

<!-- Section 2: Artwork -->
{#if sectionId === 'artwork'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[1].label}
    sectionNumber={2}
    totalSections={sections.length}
    heading={sections[1].heading}
    subtext={sections[1].subtext}
    wide={true}
    on:continue={handleContinue}
    on:back={handleBack}
  >
    <div class="artwork-grid">
      <div class="asset-card">
        <p class="asset-card-title">Main cover *</p>
        {#if mainCover}
          <div class="asset-row">
            <span class="asset-icon" style="color:var(--spectral-violet);">◼</span>
            <div class="asset-row-info"><p class="asset-row-name">{mainCover.filename}</p></div>
            <button type="button" class="asset-row-action" on:click={() => removeReleaseFile(mainCover.asset_id)}>remove</button>
          </div>
        {:else}
          <MagneticDropZone accept="image/*" label="Drop cover artwork" hint="PNG · JPG · WebP" on:files={(e) => setReleaseFile('main_cover', 'image', e.detail[0])} />
        {/if}
      </div>

      {#if tracks.length && selectedTrack}
        <div class="asset-card">
          <div class="asset-card-header">
            <p class="asset-card-title">Track artwork</p>
            <select class="asset-select-small" bind:value={selectedTrackId}>
              {#each tracks as t}<option value={t.track_id}>{t.disc_number}.{t.track_number} {t.title || 'Untitled'}</option>{/each}
            </select>
          </div>
          {#if trackArtwork}
            <div class="asset-row">
              <span class="asset-icon" style="color:var(--spectral-violet);">◼</span>
              <div class="asset-row-info"><p class="asset-row-name">{trackArtwork.filename}</p></div>
              <button type="button" class="asset-row-action" on:click={() => removeTrackFile(trackArtwork.asset_id)}>remove</button>
            </div>
          {:else}
            <label class="asset-add-btn" style="width:100%;text-align:center;">
              + Upload track artwork
              <input class="sr-only" type="file" accept="image/*" on:change={(e) => setTrackArtwork(e.currentTarget.files?.[0])} />
            </label>
          {/if}
        </div>
      {/if}
    </div>

    <div class="asset-card">
      <div class="asset-card-header">
        <p class="asset-card-title">Supplementary assets</p>
      </div>
      <div class="asset-add-row">
        <select class="asset-select" bind:value={releaseSupplementRole}>
          {#each Object.entries(RELEASE_SUPPORT) as [role, def]}<option value={role}>{def.label}</option>{/each}
        </select>
        <label class="asset-add-btn">
          + Add release asset
          <input class="sr-only" type="file" accept={RELEASE_SUPPORT[releaseSupplementRole].accept} on:change={(e) => { addReleaseSupplement(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
        </label>
      </div>
      {#each allReleaseSupplementary as asset (asset.asset_id)}
        <div class="asset-row">
          <span class="asset-icon" style="color:var(--spectral-violet);">{asset.type === 'video' ? '▶' : asset.type === 'audio' ? '♫' : asset.type === 'document' ? '▤' : '◼'}</span>
          <div class="asset-row-info">
            <p class="asset-row-name">{asset.filename}</p>
            <p class="asset-row-meta">{roleLabel(asset.role)} · {sizeLabel(asset.size)}</p>
          </div>
          <button type="button" class="asset-row-action" on:click={() => removeReleaseFile(asset.asset_id)}>remove</button>
        </div>
      {/each}
    </div>

    {#if tracks.length && selectedTrack}
      <div class="asset-card">
        <p class="asset-card-title">Track media & documents</p>
        <div class="asset-add-row">
          <select class="asset-select" bind:value={trackSupplementRole}>
            {#each Object.entries(TRACK_SUPPORT) as [role, def]}<option value={role}>{def.label}</option>{/each}
          </select>
          <label class="asset-add-btn">
            + Add track asset
            <input class="sr-only" type="file" accept={TRACK_SUPPORT[trackSupplementRole].accept} on:change={(e) => { addTrackSupplement(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
          </label>
        </div>
        {#each $releaseProject.track_assets.filter((a) => a.track_id === selectedTrackId && a.role !== 'track_artwork') as asset (asset.asset_id)}
          <div class="asset-row">
            <span class="asset-icon" style="color:var(--spectral-violet);">{asset.type === 'video' ? '▶' : '▤'}</span>
            <div class="asset-row-info">
              <p class="asset-row-name">{asset.filename}</p>
              <p class="asset-row-meta">{roleLabel(asset.role)} · {sizeLabel(asset.size)}</p>
            </div>
            <button type="button" class="asset-row-action" on:click={() => removeTrackFile(asset.asset_id)}>remove</button>
          </div>
        {/each}
      </div>
    {/if}
  </FocusedSection>
{/if}

<!-- Section 3: Asset review -->
{#if sectionId === 'asset-review'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[2].label}
    sectionNumber={3}
    totalSections={sections.length}
    heading={sections[2].heading}
    subtext={sections[2].subtext}
    continueLabel="Continue to Lyrics"
    on:continue={handleContinue}
    on:back={handleBack}
  >
    <div class="review-grid">
      <div class="review-stat">
        <span class="review-stat-number">{tracks.length}</span>
        <span class="review-stat-label">Tracks</span>
      </div>
      <div class="review-stat">
        <span class="review-stat-number" class:review-stat-warn={totalAudioAttached < tracks.length}>{totalAudioAttached}/{tracks.length}</span>
        <span class="review-stat-label">Audio masters</span>
      </div>
      <div class="review-stat">
        <span class="review-stat-number" class:review-stat-ok={!!mainCover} class:review-stat-warn={!mainCover}>{mainCover ? '1' : '0'}</span>
        <span class="review-stat-label">Cover art</span>
      </div>
      <div class="review-stat">
        <span class="review-stat-number">{allReleaseSupplementary.length}</span>
        <span class="review-stat-label">Supplementary</span>
      </div>
    </div>

    {#each tracks as track (track.track_id)}
      {@const hasAudio = $releaseProject.audio_versions.some((v) => v.track_id === track.track_id && v.is_primary)}
      <div class="review-track-row">
        <span class="review-track-indicator" class:review-track-ok={hasAudio} class:review-track-missing={!hasAudio}></span>
        <span class="review-track-name">{track.disc_number}.{track.track_number} {track.title || 'Untitled'}</span>
        <span class="review-track-status">{hasAudio ? 'Audio attached' : 'Missing audio'}</span>
      </div>
    {/each}

    {#if !mainCover}
      <div class="review-warning">Cover art is required before publishing.</div>
    {/if}
    {#if totalAudioAttached < tracks.length}
      <div class="review-warning">Not every track has a primary master attached.</div>
    {/if}
  </FocusedSection>
{/if}

<style>
  .track-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tracklist-disclosure {
    border: 1px solid var(--border-dim);
    border-radius: 12px;
    background: rgba(255,255,255,.025);
    overflow: hidden;
  }
  .tracklist-disclosure summary {
    padding: 13px 16px;
    cursor: pointer;
    color: var(--ink-secondary);
    font-size: 0.82rem;
    font-weight: 700;
  }
  .tracklist-editor { padding: 0 16px 16px; border-top: 1px solid var(--border-dim); }

  .track-pill {
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid var(--border-dim);
    background: rgba(255,255,255,0.03);
    color: var(--ink-muted);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .track-pill:hover { border-color: var(--border-hover); color: #fff; }
  .track-pill-active { background: var(--spectral-violet); color: #fff; border-color: var(--spectral-violet); }

  .asset-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border-dim);
    border-radius: 14px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .asset-card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .asset-card-title { font-size: 0.88rem; font-weight: 800; color: #fff; margin: 0; }
  .asset-card-sub { font-size: 0.75rem; color: var(--ink-muted); margin: 0; }

  .asset-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: rgba(255,255,255,0.03);
    border-radius: 10px;
  }

  .asset-icon {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.05); color: var(--spectral-violet); font-size: 0.85rem; flex-shrink: 0;
  }

  .asset-row-info { flex: 1; min-width: 0; }
  .asset-row-name { font-size: 0.82rem; font-weight: 600; color: #fff; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .asset-row-meta { font-size: 0.68rem; color: var(--ink-muted); margin: 2px 0 0; }
  .asset-row-action { background: none; border: none; font-size: 0.68rem; color: var(--ink-muted); cursor: pointer; padding: 4px 6px; }
  .asset-row-action:hover { color: #F08A9D; }

  .asset-add-row { display: flex; gap: 8px; align-items: center; }
  .asset-select {
    flex: 1; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-dim);
    border-radius: 10px; color: #fff; font-size: 0.85rem; font-family: inherit; outline: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='rgba(255,255,255,0.4)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px;
  }
  .asset-select option { background: var(--charcoal); color: #fff; }
  .asset-select-small { padding: 6px 10px; font-size: 0.78rem; background: rgba(255,255,255,0.04); border: 1px solid var(--border-dim); border-radius: 8px; color: var(--ink-secondary); font-family: inherit; outline: none; }
  .asset-select-small option { background: var(--charcoal); color: #fff; }

  .asset-add-btn {
    display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px;
    background: rgba(255,255,255,0.04); border: 1px solid var(--border-dim); border-radius: 10px;
    color: var(--ink-secondary); font-size: 0.82rem; font-weight: 600; cursor: pointer; white-space: nowrap;
    transition: border-color 0.2s, color 0.2s;
  }
  .asset-add-btn:hover { border-color: var(--border-hover); color: #fff; }

  .artwork-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .empty-state {
    padding: 40px 24px; text-align: center; color: var(--ink-muted); font-size: 0.88rem;
    background: rgba(255,255,255,0.02); border: 1px dashed var(--border-dim); border-radius: 14px;
  }

  .review-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .review-stat {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 16px 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-dim); border-radius: 12px;
  }
  .review-stat-number { font-size: 1.4rem; font-weight: 900; color: #fff; }
  .review-stat-label { font-size: 0.7rem; color: var(--ink-muted); font-weight: 600; }
  .review-stat-ok { color: #7FE0B8; }
  .review-stat-warn { color: #F08A9D; }

  .review-track-row {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; background: rgba(255,255,255,0.02); border-radius: 10px;
  }
  .review-track-indicator { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .review-track-ok { background: #7FE0B8; }
  .review-track-missing { background: #F08A9D; }
  .review-track-name { flex: 1; font-size: 0.85rem; font-weight: 600; color: #fff; }
  .review-track-status { font-size: 0.72rem; color: var(--ink-muted); }

  .review-warning {
    padding: 12px 16px; border-radius: 10px; font-size: 0.82rem;
    background: rgba(240,75,107,0.08); border: 1px solid rgba(240,75,107,0.2); color: #F08A9D;
  }

  @media (max-width: 600px) {
    .artwork-grid { grid-template-columns: 1fr; }
    .review-grid { grid-template-columns: repeat(2, 1fr); }
    .asset-add-row { flex-direction: column; }
  }

  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
</style>
