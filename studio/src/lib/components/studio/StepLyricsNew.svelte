<script>
  import FocusedSection from './FocusedSection.svelte';
  import { releaseProject } from '#lib/stores/package.js';
  import { orderedTracks } from '#lib/domain/release.js';
  import { currentSection, STEPS, markSectionState, nextSection, prevSection } from '#lib/stores/studio-nav.js';
  import { onDestroy } from 'svelte';

  const step = STEPS[2];
  const sections = step.sections;

  let selectedTrackId = '';
  let syncMode = false;
  let syncIndex = 0;
  let syncLines = [];
  let syncStamps = [];
  let audioEl;
  let audioUrl = '';
  let loadedAudioFile = null;
  let currentMs = 0;
  let playing = false;
  let animationFrame;
  $: tracks = orderedTracks($releaseProject.tracks);
  $: if (!selectedTrackId || !tracks.some((t) => t.track_id === selectedTrackId)) selectedTrackId = tracks[0]?.track_id || '';
  $: selectedTrack = tracks.find((t) => t.track_id === selectedTrackId);
  $: lyricRecord = $releaseProject.lyrics.find((entry) => entry.track_id === selectedTrackId) ?? { plain_text: '', timed_lines: [] };
  $: lyricsByTrack = new Map($releaseProject.lyrics.map((entry) => [entry.track_id, entry]));
  $: selectedAudio = $releaseProject.audio_assets.find((asset) => asset.asset_id === selectedTrack?.primary_audio_ref && asset.file)
    ?? $releaseProject.audio_assets.find((asset) => asset.track_id === selectedTrackId && asset.role === 'primary_master' && asset.file);
  $: if ((selectedAudio?.file ?? null) !== loadedAudioFile) loadAudio(selectedAudio?.file ?? null);

  function updateTrackLyrics(text) {
    releaseProject.update((p) => ({
      ...p,
      lyrics: [
        ...p.lyrics.filter((entry) => entry.track_id !== selectedTrackId),
        { ...lyricRecord, track_id: selectedTrackId, plain_text: text, timed_lines: lyricRecord.timed_lines || [] },
      ],
    }));
  }

  function loadAudio(file) {
    if (audioEl) audioEl.pause();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    loadedAudioFile = file;
    audioUrl = file ? URL.createObjectURL(file) : '';
    currentMs = 0;
    playing = false;
  }

  function tick() {
    if (audioEl && !audioEl.paused) {
      currentMs = Math.round(audioEl.currentTime * 1000);
      animationFrame = requestAnimationFrame(tick);
    } else playing = false;
  }

  function startSync() {
    syncLines = String(lyricRecord.plain_text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!syncLines.length) return;
    syncStamps = new Array(syncLines.length).fill(-1);
    syncIndex = 0;
    syncMode = true;
    if (audioEl) {
      audioEl.currentTime = 0;
      void audioEl.play();
      playing = true;
      animationFrame = requestAnimationFrame(tick);
    }
  }

  function markLine() {
    if (syncIndex >= syncLines.length) return;
    syncStamps[syncIndex] = currentMs;
    syncStamps = [...syncStamps];
    syncIndex += 1;
    if (syncIndex >= syncLines.length) {
      if (audioEl) audioEl.pause();
      playing = false;
      releaseProject.update((p) => ({
        ...p,
        lyrics: [...p.lyrics.filter((entry) => entry.track_id !== selectedTrackId), {
          ...lyricRecord,
          track_id: selectedTrackId,
          plain_text: lyricRecord.plain_text || '',
          timed_lines: syncLines.map((text, index) => ({ text, t: syncStamps[index] })),
        }],
      }));
      syncMode = false;
    }
  }

  function cancelSync() {
    if (audioEl) audioEl.pause();
    playing = false;
    syncMode = false;
    cancelAnimationFrame(animationFrame);
  }

  onDestroy(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    cancelAnimationFrame(animationFrame);
  });

  function handleContinue() {
    markSectionState(step.id, $currentSection.id, 'complete');
    nextSection();
  }
  function handleBack() { prevSection(); }

  $: sectionId = $currentSection?.id;
  $: tracksWithLyrics = tracks.filter((track) => lyricsByTrack.get(track.track_id)?.plain_text?.trim());
</script>

{#if sectionId === 'select-track'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[0].label}
    sectionNumber={1}
    totalSections={sections.length}
    heading={sections[0].heading}
    subtext={sections[0].subtext}
    on:continue={handleContinue}
    on:back={handleBack}
  >
    {#if tracks.length}
      <div class="track-list">
        {#each tracks as track (track.track_id)}
          <button
            type="button"
            class="track-item"
            class:track-item-active={selectedTrackId === track.track_id}
            on:click={() => selectedTrackId = track.track_id}
          >
            <span class="track-item-number">{track.disc_number}.{track.track_number}</span>
            <span class="track-item-title">{track.title || 'Untitled'}</span>
            {#if lyricsByTrack.get(track.track_id)?.plain_text?.trim()}
              <span class="track-item-badge">Has lyrics</span>
            {/if}
          </button>
        {/each}
      </div>
    {:else}
      <div class="empty-state">No tracks yet. Add tracks in the Assets step first.</div>
    {/if}
  </FocusedSection>
{/if}

{#if sectionId === 'edit-lyrics'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[1].label}
    sectionNumber={2}
    totalSections={sections.length}
    heading={selectedTrack ? `Lyrics for "${selectedTrack.title || 'Untitled'}"` : sections[1].heading}
    subtext={sections[1].subtext}
    wide={true}
    on:continue={handleContinue}
    on:back={handleBack}
  >
    {#if audioUrl}<audio bind:this={audioEl} src={audioUrl} preload="metadata" on:ended={() => { playing = false; cancelAnimationFrame(animationFrame); }} style="display:none"></audio>{/if}
    {#if selectedTrack && !syncMode}
      <div class="lyrics-editor">
        <textarea
          class="lyrics-textarea"
          rows="16"
          value={lyricRecord.plain_text || ''}
          on:input={(e) => updateTrackLyrics(e.currentTarget.value)}
          placeholder="Paste or type the lyrics here…"
        ></textarea>
        <p class="lyrics-count">{(lyricRecord.plain_text || '').length} characters</p>
        {#if selectedAudio?.file}
          <button class="sync-button" type="button" disabled={!lyricRecord.plain_text?.trim()} on:click={startSync}>Tap to sync lyrics →</button>
        {:else}
          <p class="sync-hint">Upload this track’s primary master in Assets to synchronize the pasted lyrics.</p>
        {/if}
      </div>
    {:else if selectedTrack}
      <div class="sync-panel">
        <p class="sync-progress">Line {syncIndex + 1} of {syncLines.length}</p>
        <p class="sync-current">{syncLines[syncIndex]}</p>
        <p class="sync-hint">Play the track and tap when this line begins. You can refine timings in Review.</p>
        <button type="button" class="sync-button" on:click={markLine}>Mark this line <span>{(currentMs / 1000).toFixed(1)}s</span></button>
        <button type="button" class="sync-cancel" on:click={cancelSync}>Cancel sync</button>
      </div>
    {:else}
      <div class="empty-state">Select a track first.</div>
    {/if}
  </FocusedSection>
{/if}

{#if sectionId === 'review-sync'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[2].label}
    sectionNumber={3}
    totalSections={sections.length}
    heading={sections[2].heading}
    subtext={sections[2].subtext}
    continueLabel="Continue to Extras"
    on:continue={handleContinue}
    on:back={handleBack}
  >
    <div class="review-summary">
      <span class="review-summary-stat">{tracksWithLyrics.length}</span>
      <span class="review-summary-label">of {tracks.length} tracks have lyrics</span>
    </div>

    {#each tracks as track (track.track_id)}
      {@const trackLyrics = lyricsByTrack.get(track.track_id)}
      <div class="review-row">
        <span class="review-indicator" class:review-ok={trackLyrics?.plain_text?.trim()} class:review-none={!trackLyrics?.plain_text?.trim()}></span>
        <span class="review-name">{track.disc_number}.{track.track_number} {track.title || 'Untitled'}</span>
        <span class="review-status">{trackLyrics?.timed_lines?.length ? `${trackLyrics.timed_lines.length} synced lines` : trackLyrics?.plain_text?.trim() ? `${trackLyrics.plain_text.trim().split('\n').length} lines` : 'No lyrics'}</span>
      </div>
    {/each}
  </FocusedSection>
{/if}

<style>
  .track-list { display: flex; flex-direction: column; gap: 6px; }
  .track-item {
    display: flex; align-items: center; gap: 12px; padding: 14px 16px;
    background: rgba(255,255,255,0.03); border: 1px solid var(--border-dim); border-radius: 12px;
    cursor: pointer; transition: all 0.2s; text-align: left;
  }
  .track-item:hover { border-color: var(--border-hover); }
  .track-item-active { border-color: var(--spectral-violet); background: rgba(123,92,240,0.06); }
  .track-item-number { font-size: 0.75rem; font-weight: 700; color: var(--spectral-violet); font-family: monospace; }
  .track-item-title { flex: 1; font-size: 0.88rem; font-weight: 600; color: #fff; }
  .track-item-badge { font-size: 0.68rem; padding: 3px 8px; border-radius: 6px; background: rgba(127,224,184,0.1); color: #7FE0B8; font-weight: 600; }

  .lyrics-editor { display: flex; flex-direction: column; gap: 8px; }
  .lyrics-textarea {
    width: 100%; padding: 16px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-dim);
    border-radius: 12px; color: #fff; font-size: 0.95rem; font-family: inherit; line-height: 1.7;
    outline: none; resize: vertical; min-height: 280px;
    transition: border-color 0.2s;
  }
  .lyrics-textarea:focus { border-color: var(--spectral-violet); }
  .lyrics-textarea::placeholder { color: var(--ink-muted); opacity: 0.7; }
  .lyrics-count { font-size: 0.72rem; color: var(--ink-muted); text-align: right; margin: 0; }
  .sync-button { width:100%; border:0; border-radius:10px; padding:12px 16px; background:var(--spectral-violet); color:#fff; font:inherit; font-size:.85rem; font-weight:800; cursor:pointer; }
  .sync-button:disabled { opacity:.45; cursor:not-allowed; }
  .sync-button span { margin-left:8px; color:rgba(255,255,255,.72); font-family:monospace; font-weight:500; }
  .sync-panel { display:flex; flex-direction:column; align-items:center; gap:14px; padding:32px 22px; text-align:center; background:rgba(123,92,240,.08); border:1px solid rgba(123,92,240,.3); border-radius:14px; }
  .sync-progress { margin:0; color:#b8a9ff; font:700 .75rem monospace; text-transform:uppercase; }
  .sync-current { margin:0; color:#fff; font-size:1.25rem; font-weight:800; line-height:1.4; }
  .sync-hint { margin:0; color:var(--ink-muted); font-size:.75rem; line-height:1.45; }
  .sync-cancel { border:0; background:none; color:var(--ink-muted); font:inherit; font-size:.75rem; cursor:pointer; }

  .empty-state {
    padding: 40px 24px; text-align: center; color: var(--ink-muted); font-size: 0.88rem;
    background: rgba(255,255,255,0.02); border: 1px dashed var(--border-dim); border-radius: 14px;
  }

  .review-summary { display: flex; align-items: baseline; gap: 8px; padding: 16px 0; }
  .review-summary-stat { font-size: 2rem; font-weight: 900; color: #fff; }
  .review-summary-label { font-size: 0.88rem; color: var(--ink-secondary); }

  .review-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(255,255,255,0.02); border-radius: 10px; }
  .review-indicator { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .review-ok { background: #7FE0B8; }
  .review-none { background: rgba(255,255,255,0.15); }
  .review-name { flex: 1; font-size: 0.85rem; font-weight: 600; color: #fff; }
  .review-status { font-size: 0.72rem; color: var(--ink-muted); }
</style>
