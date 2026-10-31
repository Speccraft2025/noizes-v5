<script>
  import FocusedSection from './FocusedSection.svelte';
  import StudioField from './StudioField.svelte';
  import { releaseProject } from '#lib/stores/package.js';
  import { orderedTracks } from '#lib/domain/release.js';
  import { currentSection, STEPS, markSectionState, nextSection, prevSection } from '#lib/stores/studio-nav.js';

  const step = STEPS[2];
  const sections = step.sections;

  let selectedTrackId = '';
  $: tracks = orderedTracks($releaseProject.tracks);
  $: if (!selectedTrackId || !tracks.some((t) => t.track_id === selectedTrackId)) selectedTrackId = tracks[0]?.track_id || '';
  $: selectedTrack = tracks.find((t) => t.track_id === selectedTrackId);

  function updateTrackLyrics(text) {
    releaseProject.update((p) => ({
      ...p,
      tracks: p.tracks.map((t) => t.track_id === selectedTrackId ? { ...t, lyrics: text } : t),
    }));
  }

  function handleContinue() {
    markSectionState(step.id, $currentSection.id, 'complete');
    nextSection();
  }
  function handleBack() { prevSection(); }

  $: sectionId = $currentSection?.id;
  $: tracksWithLyrics = tracks.filter((t) => t.lyrics && t.lyrics.trim().length > 0);
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
            {#if track.lyrics?.trim()}
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
    {#if selectedTrack}
      <div class="lyrics-editor">
        <textarea
          class="lyrics-textarea"
          rows="16"
          value={selectedTrack.lyrics || ''}
          on:input={(e) => updateTrackLyrics(e.currentTarget.value)}
          placeholder="Paste or type the lyrics here…"
        ></textarea>
        <p class="lyrics-count">{(selectedTrack.lyrics || '').length} characters</p>
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
      <div class="review-row">
        <span class="review-indicator" class:review-ok={track.lyrics?.trim()} class:review-none={!track.lyrics?.trim()}></span>
        <span class="review-name">{track.disc_number}.{track.track_number} {track.title || 'Untitled'}</span>
        <span class="review-status">{track.lyrics?.trim() ? `${track.lyrics.trim().split('\n').length} lines` : 'No lyrics'}</span>
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
