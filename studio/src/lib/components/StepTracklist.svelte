<script>
  import HelpTip from './HelpTip.svelte';
  import { releaseProject } from '$lib/stores/package.js';
  import { createTrack, duplicateTrack as duplicateReleaseTrack, orderedTracks, removeTrack, reorderTrack } from '$lib/domain/release.js';

  let selectedTrackId = '';
  $: tracks = orderedTracks($releaseProject.tracks);
  $: if (!selectedTrackId || !tracks.some((track) => track.track_id === selectedTrackId)) {
    selectedTrackId = tracks[0]?.track_id || '';
  }
  $: selected = tracks.find((track) => track.track_id === selectedTrackId);

  function updateTrack(trackId, patch) {
    releaseProject.update((project) => ({
      ...project,
      tracks: project.tracks.map((track) => track.track_id === trackId ? { ...track, ...patch } : track),
    }));
  }

  function setList(field, value) {
    updateTrack(selectedTrackId, {
      [field]: String(value).split(',').map((entry) => entry.trim()).filter(Boolean),
    });
  }

  function addTrack() {
    releaseProject.update((project) => {
      const track = createTrack({
        title: '',
        primary_artist: project.release.primary_artist,
        inherit_release_artist: true,
        disc_number: tracks.at(-1)?.disc_number || 1,
        track_number: tracks.length + 1,
      }, {
        releaseId: project.release.release_id,
        releaseArtist: project.release.primary_artist,
        index: project.tracks.length,
      });
      selectedTrackId = track.track_id;
      return {
        ...project,
        tracks: reorderTrack([...project.tracks, track], track.track_id, project.tracks.length),
        journey: {
          ...project.journey,
          track_journeys: [...project.journey.track_journeys, { track_id: track.track_id, moments: [] }],
        },
      };
    });
  }

  function duplicateSelected() {
    releaseProject.update((project) => {
      const next = duplicateReleaseTrack(project, selectedTrackId);
      selectedTrackId = next.tracks.at(-1)?.track_id || selectedTrackId;
      return next;
    });
  }

  function removeSelected() {
    if (!selectedTrackId) return;
    releaseProject.update((project) => removeTrack(project, selectedTrackId));
  }

  function moveSelected(offset) {
    const currentIndex = tracks.findIndex((track) => track.track_id === selectedTrackId);
    if (currentIndex < 0) return;
    releaseProject.update((project) => ({
      ...project,
      tracks: reorderTrack(project.tracks, selectedTrackId, currentIndex + offset),
    }));
  }
</script>

<div class="space-y-5">
  <div>
    <p class="t-caption mb-2">Step 2</p>
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-2xl font-black tracking-tight text-white">Tracklist</h2>
        <p class="text-sm mt-1" style="color: var(--ink-muted);">Define the musical structure before attaching files.</p>
      </div>
      <button type="button" class="btn-spectral text-xs shrink-0" on:click={addTrack}>＋ Add track</button>
    </div>
  </div>

  {#if tracks.length}
    <div class="space-y-2">
      {#each tracks as track, index (track.track_id)}
        <div class="rounded-xl flex items-center gap-2 p-2" style={selectedTrackId === track.track_id
          ? 'background: rgba(123,92,240,.12); border:1px solid rgba(123,92,240,.32);'
          : 'background: rgba(255,255,255,.025); border:1px solid var(--border-dim);'}>
          <button type="button" class="flex-1 min-w-0 flex items-center gap-3 text-left px-2 py-1" on:click={() => selectedTrackId = track.track_id}>
            <span class="font-mono text-xs shrink-0" style="color:#7B5CF0;">{track.disc_number}.{String(track.track_number).padStart(2, '0')}</span>
            <span class="min-w-0">
              <span class="block text-sm font-bold text-white truncate">{track.title || `Untitled track ${index + 1}`}</span>
              <span class="block text-xs truncate" style="color:var(--ink-muted);">{track.primary_artist || 'Artist needed'}{track.hidden ? ' · hidden' : ''}{track.bonus ? ' · bonus' : ''}</span>
            </span>
          </button>
          <div class="flex gap-1 shrink-0">
            <button type="button" aria-label="Move track up" class="w-7 h-7 rounded text-xs" style="background:rgba(255,255,255,.05);color:var(--ink-muted);" disabled={index === 0} on:click={() => { selectedTrackId = track.track_id; moveSelected(-1); }}>↑</button>
            <button type="button" aria-label="Move track down" class="w-7 h-7 rounded text-xs" style="background:rgba(255,255,255,.05);color:var(--ink-muted);" disabled={index === tracks.length - 1} on:click={() => { selectedTrackId = track.track_id; moveSelected(1); }}>↓</button>
          </div>
        </div>
      {/each}
    </div>

    {#if selected}
      <div class="glass rounded-xl p-4 space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="t-caption">Track record</p>
            <p class="font-mono text-[10px] mt-1 truncate max-w-72" style="color:var(--ink-muted);">{selected.track_id}</p>
          </div>
          <div class="flex gap-2">
            <button type="button" class="btn-ghost text-xs py-1.5 px-3" on:click={duplicateSelected}>Duplicate</button>
            <button type="button" class="btn-ghost text-xs py-1.5 px-3" style="color:#F08A9D;" on:click={removeSelected}>Remove</button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label-dark" for="disc-number">Disc<HelpTip field="disc_number" /></label>
            <input id="disc-number" class="input-dark" type="number" min="1" value={selected.disc_number} on:input={(event) => updateTrack(selectedTrackId, { disc_number: Number(event.currentTarget.value) || 1 })} />
          </div>
          <div>
            <label class="label-dark" for="track-number">Track number<HelpTip field="track_number" /></label>
            <input id="track-number" class="input-dark" type="number" min="1" value={selected.track_number} on:input={(event) => updateTrack(selectedTrackId, { track_number: Number(event.currentTarget.value) || 1 })} />
          </div>
        </div>

        <div>
          <label class="label-dark" for="track-title">Track title *<HelpTip field="track_title" /></label>
          <input id="track-title" class="input-dark" type="text" value={selected.title} on:input={(event) => updateTrack(selectedTrackId, { title: event.currentTarget.value })} placeholder="Title of this musical work" />
        </div>
        <div>
          <label class="label-dark" for="track-subtitle">Subtitle<HelpTip field="track_subtitle" /></label>
          <input id="track-subtitle" class="input-dark" type="text" value={selected.subtitle} on:input={(event) => updateTrack(selectedTrackId, { subtitle: event.currentTarget.value })} placeholder="Movement, mix, or performance subtitle" />
        </div>

        <div>
          <div class="flex items-center justify-between">
            <label class="label-dark" for="track-artist">Primary artist *<HelpTip field="track_artist" /></label>
            {#if !selected.inherit_release_artist}
              <button type="button" class="text-[10px] font-bold mb-1" style="color:#7B5CF0;" on:click={() => updateTrack(selectedTrackId, { primary_artist: $releaseProject.release.primary_artist, inherit_release_artist: true })}>Use release artist</button>
            {/if}
          </div>
          <input id="track-artist" class="input-dark" type="text" value={selected.primary_artist}
            on:input={(event) => updateTrack(selectedTrackId, { primary_artist: event.currentTarget.value, inherit_release_artist: false })} />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label-dark" for="track-featured">Featured artists<HelpTip field="track_featured" /></label>
            <input id="track-featured" class="input-dark" type="text" value={selected.featured_artists.join(', ')} on:input={(event) => setList('featured_artists', event.currentTarget.value)} placeholder="Comma-separated" />
          </div>
          <div>
            <label class="label-dark" for="track-producers">Producers<HelpTip field="track_producers" /></label>
            <input id="track-producers" class="input-dark" type="text" value={selected.producers.join(', ')} on:input={(event) => setList('producers', event.currentTarget.value)} placeholder="Comma-separated" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label-dark" for="track-writers">Writers / composers<HelpTip field="track_writers" /></label>
            <input id="track-writers" class="input-dark" type="text" value={selected.writers.join(', ')} on:input={(event) => setList('writers', event.currentTarget.value)} placeholder="Comma-separated" />
          </div>
          <div>
            <label class="label-dark" for="track-isrc">ISRC<HelpTip field="track_isrc" /></label>
            <input id="track-isrc" class="input-dark font-mono text-xs" type="text" value={selected.isrc} on:input={(event) => updateTrack(selectedTrackId, { isrc: event.currentTarget.value.toUpperCase() })} placeholder="Optional" />
          </div>
        </div>

        <div>
          <label class="label-dark" for="track-description">Track notes<HelpTip field="track_description" /></label>
          <textarea id="track-description" class="input-dark resize-none" rows="3" value={selected.description} on:input={(event) => updateTrack(selectedTrackId, { description: event.currentTarget.value })} placeholder="Context, recording notes, or movement description"></textarea>
        </div>

        <div class="space-y-2">
          <label class="flex items-center gap-2 text-xs" style="color:var(--ink-muted);">
            <input type="checkbox" checked={selected.inherit_release_credits}
              on:change={(event) => updateTrack(selectedTrackId, { inherit_release_credits: event.currentTarget.checked })} />
            Use release-level credits<HelpTip field="track_inherit_credits" />
          </label>
          {#if !selected.inherit_release_credits}
            <label class="label-dark" for="track-credits">Track-specific credits<HelpTip field="track_credits" /></label>
            <textarea id="track-credits" class="input-dark resize-none font-mono text-xs" rows="3"
              value={selected.credits?.text || ''}
              on:input={(event) => updateTrack(selectedTrackId, { credits: { ...selected.credits, text: event.currentTarget.value } })}
              placeholder="Performance, arrangement, engineering, mastering…"></textarea>
          {/if}
        </div>

        <div class="grid sm:grid-cols-3 gap-3">
          <div>
            <label class="label-dark" for="track-release-date">Track release date<HelpTip field="track_release_date" /></label>
            <input id="track-release-date" class="input-dark" type="date" value={selected.release_date} on:input={(event) => updateTrack(selectedTrackId, { release_date: event.currentTarget.value })} />
          </div>
          <div>
            <label class="label-dark" for="track-recording-date">Recording date<HelpTip field="track_recording_date" /></label>
            <input id="track-recording-date" class="input-dark" type="date" value={selected.recording_date} on:input={(event) => updateTrack(selectedTrackId, { recording_date: event.currentTarget.value })} />
          </div>
          <div>
            <label class="label-dark" for="track-recording-location">Recording location<HelpTip field="track_recording_location" /></label>
            <input id="track-recording-location" class="input-dark" type="text" value={selected.recording_location} on:input={(event) => updateTrack(selectedTrackId, { recording_location: event.currentTarget.value })} />
          </div>
        </div>
        {#if $releaseProject.release.release_type === 'compilation'}
          <div>
            <label class="label-dark" for="source-release">Source release<HelpTip field="source_release" /></label>
            <input id="source-release" class="input-dark" type="text" value={selected.source_release} on:input={(event) => updateTrack(selectedTrackId, { source_release: event.currentTarget.value })} placeholder="Original release or archive source" />
          </div>
        {/if}

        <div class="grid grid-cols-2 gap-2 text-xs">
          {#each [
            ['explicit', 'Explicit content', 'track_flag_explicit'],
            ['bonus', 'Bonus track', 'track_flag_bonus'],
            ['hidden', 'Hidden track', 'track_flag_hidden'],
            ['appears_in_journey', 'Include in Journey', 'track_flag_journey'],
            ['appears_in_archive', 'Include in Archive', 'track_flag_archive'],
          ] as [field, label, help]}
            <label class="flex items-center gap-2 rounded-lg px-3 py-2" style="background:rgba(255,255,255,.03);color:var(--ink-muted);">
              <input type="checkbox" checked={selected[field]} on:change={(event) => updateTrack(selectedTrackId, { [field]: event.currentTarget.checked })} />
              {label}<HelpTip field={help} />
            </label>
          {/each}
        </div>
      </div>
    {/if}
  {:else}
    <div class="glass rounded-xl p-8 text-center">
      <p class="text-sm text-white mb-2">No tracks yet</p>
      <p class="text-xs mb-4" style="color:var(--ink-muted);">A DJ Mix may use a continuous master; every other release starts with a track record.</p>
      <button type="button" class="btn-spectral" on:click={addTrack}>Add the first track</button>
    </div>
  {/if}
</div>
