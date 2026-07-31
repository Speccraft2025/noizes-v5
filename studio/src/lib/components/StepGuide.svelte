<script>
  import { assets, play, releaseProject, template } from '$lib/stores/package.js';
  import { createUuid, orderedTracks } from '$lib/domain/release.js';
  import {
    MOMENT_EFFECTS,
    RELEASE_MOMENT_TYPES,
    RELEASE_PLACEMENTS,
    TRACK_MOMENT_TYPES,
    createReleaseMoment,
    createTrackMoment,
    materializeJourney,
    releaseTimeline,
  } from '$lib/domain/journey.js';

  const LABELS = {
    opening: 'Opening encounter', release_identity: 'Release identity', release_introduction: 'Release introduction',
    tracklist_reveal: 'Tracklist reveal', interlude: 'Interlude', chapter_card: 'Chapter card', disc_change: 'Disc change',
    story: 'Story', artwork: 'Artwork', gallery: 'Gallery', credits: 'Credits', closing_reflection: 'Closing reflection',
    collector_message: 'Collector message', archive_invitation: 'Archive invitation', history_invitation: 'History invitation',
    title_reveal: 'Track title reveal', lyrics: 'Lyrics', image: 'Image', video: 'Video', note: 'Note', effect: 'Effect',
    track_ending: 'Track ending', transition: 'Transition', before_first_track: 'Before the first track',
    before_track: 'Before a track', after_track: 'After a track', disc_start: 'At the start of a disc',
    disc_end: 'At the end of a disc', during_transition: 'During a transition', after_final_track: 'After the final track',
  };

  let activeScope = 'release';
  let initialized = false;

  $: tracks = orderedTracks($releaseProject.tracks);
  $: journey = $releaseProject.journey;
  $: timeline = releaseTimeline(journey, tracks);
  $: activeTrack = tracks.find((track) => track.track_id === activeScope);
  $: activeTrackJourney = journey.track_journeys.find((entry) => entry.track_id === activeScope);
  $: activeMoments = activeScope === 'release' ? journey.release_moments : (activeTrackJourney?.moments || []);
  $: scopedAssets = activeScope === 'release'
    ? $releaseProject.release_assets
    : [...$releaseProject.release_assets, ...$releaseProject.track_assets.filter((asset) => asset.track_id === activeScope)];

  // Theme variants are archived for now; the Journey always authors the ULTRA experience.
  $: if ($template !== 'ultra-v2') template.set('ultra-v2');
  $: if (!initialized && tracks.length) {
    initialized = true;
    releaseProject.update((project) => ({
      ...project,
      journey: materializeJourney(project.journey, orderedTracks(project.tracks), { idFactory: createUuid }),
    }));
  }
  $: if (activeScope !== 'release' && !tracks.some((track) => track.track_id === activeScope)) activeScope = 'release';

  function setJourney(updater) {
    releaseProject.update((project) => ({ ...project, journey: updater(project.journey, project) }));
  }

  function setPlayback(patch) {
    setJourney((value) => ({ ...value, ...patch }));
  }

  function setNavigation(field, value) {
    setJourney((journeyValue) => ({
      ...journeyValue,
      navigation: { ...journeyValue.navigation, [field]: value },
    }));
  }

  function setCrossfadeDuration(duration) {
    setJourney((value) => {
      const existing = value.transitions.find((transition) => !transition.from_track_id && !transition.to_track_id);
      const globalTransition = { ...existing, type: 'crossfade', duration_ms: Math.max(250, Number(duration) || 1500) };
      return {
        ...value,
        transitions: [globalTransition, ...value.transitions.filter((transition) => transition !== existing && (transition.from_track_id || transition.to_track_id))],
      };
    });
  }

  function addMoment() {
    setJourney((value) => {
      if (activeScope === 'release') {
        const moment = createReleaseMoment({ type: 'story', title: 'New release Moment', order: value.release_moments.length + 1 }, { idFactory: createUuid });
        return { ...value, release_moments: [...value.release_moments, moment] };
      }
      const moment = createTrackMoment({ track_id: activeScope, type: 'story', title: 'New track Moment', at_ms: 0 }, { trackId: activeScope, idFactory: createUuid });
      return {
        ...value,
        track_journeys: value.track_journeys.map((entry) => entry.track_id === activeScope
          ? { ...entry, moments: [...entry.moments, moment].sort((left, right) => left.at_ms - right.at_ms) }
          : entry),
      };
    });
  }

  function updateMoment(momentId, patch) {
    setJourney((value) => {
      if (activeScope === 'release') {
        return { ...value, release_moments: value.release_moments.map((moment) => moment.moment_id === momentId ? { ...moment, ...patch } : moment) };
      }
      return {
        ...value,
        track_journeys: value.track_journeys.map((entry) => entry.track_id === activeScope
          ? { ...entry, moments: entry.moments.map((moment) => moment.moment_id === momentId ? { ...moment, ...patch } : moment).sort((left, right) => left.at_ms - right.at_ms) }
          : entry),
      };
    });
  }

  function removeMoment(momentId) {
    setJourney((value) => activeScope === 'release'
      ? { ...value, release_moments: value.release_moments.filter((moment) => moment.moment_id !== momentId).map((moment, index) => ({ ...moment, order: index + 1 })) }
      : {
          ...value,
          track_journeys: value.track_journeys.map((entry) => entry.track_id === activeScope
            ? { ...entry, moments: entry.moments.filter((moment) => moment.moment_id !== momentId) }
            : entry),
        });
  }

  function moveReleaseMoment(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= activeMoments.length) return;
    setJourney((value) => {
      const moments = [...value.release_moments];
      [moments[index], moments[target]] = [moments[target], moments[index]];
      return { ...value, release_moments: moments.map((moment, itemIndex) => ({ ...moment, order: itemIndex + 1 })) };
    });
  }

  function addTransitionOverride(fromTrackId, toTrackId) {
    setJourney((value) => ({
      ...value,
      transitions: [
        ...value.transitions.filter((transition) => !(transition.from_track_id === fromTrackId && transition.to_track_id === toTrackId)),
        { from_track_id: fromTrackId, to_track_id: toTrackId, type: value.playback_mode, duration_ms: value.playback_mode === 'crossfade' ? 1500 : 0 },
      ],
    }));
  }

  function setTransitionDuration(fromTrackId, toTrackId, duration) {
    setJourney((value) => ({
      ...value,
      transitions: [
        ...value.transitions.filter((transition) => !(transition.from_track_id === fromTrackId && transition.to_track_id === toTrackId)),
        { from_track_id: fromTrackId, to_track_id: toTrackId, type: 'crossfade', duration_ms: Math.max(250, Number(duration) || 1500) },
      ],
    }));
  }

  function formatTime(ms) {
    const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
</script>

<div class="space-y-6">
  <div>
    <p class="t-caption mb-2">Step 6</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Journey</h2>
    <p class="text-sm mt-1 max-w-2xl" style="color: var(--ink-muted);">
      Direct the complete release encounter, then place track Moments against the music. The overview keeps the album visible as one authored work.
    </p>
  </div>

  <section class="glass rounded-2xl p-4 space-y-4" aria-labelledby="playback-heading">
    <div>
      <p class="t-caption" id="playback-heading">Release playback</p>
      <p class="text-xs mt-1" style="color:var(--ink-muted);">One playback engine carries the collector across every track and Journey timeline.</p>
    </div>
    <div class="grid sm:grid-cols-2 gap-3">
      <div>
        <label class="label-dark" for="playback-mode">Transition mode</label>
        <select id="playback-mode" class="input-dark" value={journey.playback_mode}
          on:change={(event) => setPlayback({ playback_mode: event.currentTarget.value })}>
          <option value="sequential">Sequential</option>
          <option value="gapless">Gapless</option>
          <option value="crossfade">Crossfade</option>
        </select>
      </div>
      {#if journey.playback_mode === 'crossfade'}
        <div>
          <label class="label-dark" for="crossfade-duration">Global crossfade (ms)</label>
          <input id="crossfade-duration" class="input-dark" type="number" min="250" max="12000" step="250"
            value={journey.transitions.find((transition) => !transition.from_track_id && transition.type === 'crossfade')?.duration_ms || 1500}
            on:input={(event) => setCrossfadeDuration(event.currentTarget.value)} />
        </div>
      {:else}
        <div class="rounded-xl px-3 py-2 flex items-center" style="background:rgba(255,255,255,.03);">
          <p class="text-xs" style="color:var(--ink-muted);">{journey.playback_mode === 'gapless' ? 'The next master is preloaded for a continuous handoff.' : 'Each track completes before the next begins.'}</p>
        </div>
      {/if}
    </div>
    <div class="grid sm:grid-cols-2 gap-2 text-xs">
      {#each [
        ['allow_track_skip', 'Allow track selection'], ['allow_seek', 'Allow seeking'], ['allow_shuffle', 'Allow shuffle'],
        ['allow_repeat', 'Allow repeat'], ['resume_enabled', 'Remember listening position'],
        ['allow_archive_during_journey', 'Archive during Journey'],
      ] as [field, label]}
        <label class="flex items-center gap-2 rounded-lg px-3 py-2" style="background:rgba(255,255,255,.03);color:var(--ink-muted);">
          <input type="checkbox" checked={journey.navigation[field]} on:change={(event) => setNavigation(field, event.currentTarget.checked)} />
          {label}
        </label>
      {/each}
    </div>
    {#if journey.navigation.allow_shuffle}
      <p class="text-xs" style="color:#F0B06B;">Shuffle can break an authored Journey. It remains off by default.</p>
    {/if}
    {#if journey.playback_mode === 'crossfade' && tracks.length > 1}
      <div class="pt-3" style="border-top:1px solid rgba(255,255,255,.07);">
        <p class="text-[10px] uppercase tracking-widest mb-2" style="color:var(--ink-muted);">Optional transition overrides</p>
        <div class="space-y-2">
          {#each tracks.slice(0, -1) as track, index (track.track_id)}
            {@const nextTrack = tracks[index + 1]}
            {@const override = journey.transitions.find((transition) => transition.from_track_id === track.track_id && transition.to_track_id === nextTrack.track_id)}
            <div class="grid grid-cols-[minmax(0,1fr)_110px] gap-3 items-center">
              <p class="text-xs truncate" style="color:var(--ink-muted);">{track.title || `Track ${index + 1}`} → {nextTrack.title || `Track ${index + 2}`}</p>
              <input class="input-dark" aria-label="Crossfade from {track.title} to {nextTrack.title}" type="number" min="250" max="12000" step="250"
                value={override?.duration_ms || journey.transitions.find((transition) => !transition.from_track_id && transition.type === 'crossfade')?.duration_ms || 1500}
                on:change={(event) => setTransitionDuration(track.track_id, nextTrack.track_id, event.currentTarget.value)} />
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </section>

  <section aria-labelledby="overview-heading">
    <div class="flex items-end justify-between gap-3 mb-3">
      <div>
        <p class="t-caption" id="overview-heading">Release timeline overview</p>
        <p class="text-xs mt-1" style="color:var(--ink-muted);">Select a track to direct its synchronized timeline.</p>
      </div>
      <span class="text-xs font-mono" style="color:var(--ink-muted);">{tracks.length} track{tracks.length === 1 ? '' : 's'}</span>
    </div>
    <div class="overflow-x-auto pb-2">
      <div class="flex items-stretch gap-2 min-w-max">
        {#each timeline as item}
          {#if item.kind === 'track'}
            <button type="button" class="w-36 text-left rounded-xl p-3 transition-colors"
              style="background:{activeScope === item.track.track_id ? 'rgba(123,92,240,.2)' : 'rgba(255,255,255,.045)'};border:1px solid {activeScope === item.track.track_id ? '#7B5CF0' : 'rgba(255,255,255,.09)'};"
              on:click={() => activeScope = item.track.track_id}>
              <span class="text-[10px] font-mono" style="color:#9a82ff;">D{item.track.disc_number} · T{String(item.track.track_number).padStart(2, '0')}</span>
              <span class="block text-sm text-white font-bold mt-1 truncate">{item.track.title || 'Untitled track'}</span>
              <span class="block text-[10px] mt-1" style="color:var(--ink-muted);">{journey.track_journeys.find((entry) => entry.track_id === item.track.track_id)?.moments.length || 0} Moments</span>
            </button>
          {:else if item.kind === 'transition'}
            <button type="button" class="w-20 rounded-xl px-2 flex flex-col items-center justify-center" title="Create or replace a transition override"
              style="background:rgba(255,255,255,.025);border:1px dashed rgba(255,255,255,.1);color:var(--ink-muted);"
              on:click={() => addTransitionOverride(item.from_track_id, item.to_track_id)}>
              <span class="text-lg">→</span><span class="text-[9px] uppercase tracking-wider">Transition</span>
            </button>
          {:else}
            <button type="button" class="w-28 text-left rounded-xl p-3" style="background:rgba(240,75,216,.07);border:1px solid rgba(240,75,216,.18);"
              on:click={() => activeScope = 'release'}>
              <span class="text-[9px] uppercase tracking-wider" style="color:#F04BD8;">{LABELS[item.moment.placement]}</span>
              <span class="block text-xs text-white font-bold mt-1 line-clamp-2">{item.moment.title}</span>
            </button>
          {/if}
        {/each}
      </div>
    </div>
  </section>

  <section class="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-4" aria-labelledby="direction-heading">
    <aside class="rounded-2xl p-3 h-fit" style="background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);">
      <p class="t-caption px-2 mb-2">Journey hierarchy</p>
      <button type="button" class="w-full text-left rounded-xl px-3 py-3 mb-1"
        style="background:{activeScope === 'release' ? 'rgba(123,92,240,.18)' : 'transparent'};color:#fff;"
        on:click={() => activeScope = 'release'}>
        <span class="text-sm font-bold">Release Journey</span>
        <span class="block text-[10px] mt-1" style="color:var(--ink-muted);">{journey.release_moments.length} release Moments</span>
      </button>
      {#each tracks as track, index (track.track_id)}
        <button type="button" class="w-full text-left rounded-xl px-3 py-2.5 mb-1"
          style="background:{activeScope === track.track_id ? 'rgba(123,92,240,.18)' : 'transparent'};color:#fff;"
          on:click={() => activeScope = track.track_id}>
          <span class="text-[10px] font-mono" style="color:#9a82ff;">TRACK {String(index + 1).padStart(2, '0')}</span>
          <span class="block text-xs font-bold truncate">{track.title || 'Untitled track'}</span>
        </button>
      {/each}
    </aside>

    <div class="space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="t-caption" id="direction-heading">{activeScope === 'release' ? 'Release-level direction' : `Track ${String(activeTrack?.track_number || '').padStart(2, '0')} direction`}</p>
          <h3 class="text-lg text-white font-black mt-1">{activeScope === 'release' ? $releaseProject.release.title || 'Complete release' : activeTrack?.title || 'Untitled track'}</h3>
          <p class="text-xs mt-1" style="color:var(--ink-muted);">{activeScope === 'release' ? 'Moments may sit outside song timestamps.' : 'Moments fire against this track’s own clock.'}</p>
        </div>
        <button type="button" class="px-3 py-2 rounded-lg text-xs font-bold shrink-0"
          style="background:#7B5CF0;color:white;" on:click={addMoment}>＋ Add Moment</button>
      </div>

      {#if !activeMoments.length}
        <div class="rounded-2xl p-8 text-center" style="border:1px dashed rgba(255,255,255,.13);color:var(--ink-muted);">
          No authored Moments yet. Playback still works, but the generated default will be used.
        </div>
      {/if}

      {#each activeMoments as moment, index (moment.moment_id)}
        <article class="rounded-2xl p-4 space-y-3" style="background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.09);">
          <div class="flex items-center gap-3">
            <span class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style="background:rgba(123,92,240,.2);color:#a995ff;">{index + 1}</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-white truncate">{moment.title || LABELS[moment.type]}</p>
              <p class="text-[10px] uppercase tracking-wider mt-0.5" style="color:var(--ink-muted);">
                {activeScope === 'release' ? LABELS[moment.placement] : formatTime(moment.at_ms)} · {LABELS[moment.type] || moment.type}
              </p>
            </div>
            {#if activeScope === 'release'}
              <button type="button" class="w-7 h-7 rounded-lg disabled:opacity-20" disabled={index === 0} aria-label="Move Moment up" on:click={() => moveReleaseMoment(index, -1)}>↑</button>
              <button type="button" class="w-7 h-7 rounded-lg disabled:opacity-20" disabled={index === activeMoments.length - 1} aria-label="Move Moment down" on:click={() => moveReleaseMoment(index, 1)}>↓</button>
            {/if}
            <button type="button" class="w-7 h-7 rounded-lg" style="color:#F06B82;" aria-label="Remove Moment" on:click={() => removeMoment(moment.moment_id)}>×</button>
          </div>

          <div class="grid sm:grid-cols-2 gap-3">
            <div>
              <label class="label-dark" for="moment-type-{moment.moment_id}">Moment type</label>
              <select class="input-dark" id="moment-type-{moment.moment_id}" value={moment.type} on:change={(event) => updateMoment(moment.moment_id, { type: event.currentTarget.value })}>
                {#each activeScope === 'release' ? RELEASE_MOMENT_TYPES : TRACK_MOMENT_TYPES as type}
                  <option value={type}>{LABELS[type] || type.replaceAll('_', ' ')}</option>
                {/each}
              </select>
            </div>
            {#if activeScope === 'release'}
              <div>
                <label class="label-dark" for="moment-placement-{moment.moment_id}">Placement</label>
                <select class="input-dark" id="moment-placement-{moment.moment_id}" value={moment.placement} on:change={(event) => updateMoment(moment.moment_id, { placement: event.currentTarget.value })}>
                  {#each RELEASE_PLACEMENTS as placement}<option value={placement}>{LABELS[placement]}</option>{/each}
                </select>
              </div>
            {:else}
              <div>
                <label class="label-dark" for="moment-time-{moment.moment_id}">Track time (seconds)</label>
                <input class="input-dark" id="moment-time-{moment.moment_id}" type="number" min="0" step="0.1" value={moment.at_ms / 1000}
                  on:input={(event) => updateMoment(moment.moment_id, { at_ms: Math.round((Number(event.currentTarget.value) || 0) * 1000) })} />
              </div>
            {/if}
          </div>

          {#if activeScope === 'release' && ['before_track', 'after_track', 'during_transition'].includes(moment.placement)}
            <div>
              <label class="label-dark" for="moment-anchor-{moment.moment_id}">Anchor track</label>
              <select class="input-dark" id="moment-anchor-{moment.moment_id}" value={moment.anchor_track_id} on:change={(event) => updateMoment(moment.moment_id, { anchor_track_id: event.currentTarget.value })}>
                <option value="">Choose a track</option>
                {#each tracks as track}<option value={track.track_id}>Disc {track.disc_number} · Track {track.track_number} — {track.title}</option>{/each}
              </select>
            </div>
          {/if}

          <div class="grid sm:grid-cols-2 gap-3">
            <div>
              <label class="label-dark" for="moment-title-{moment.moment_id}">Title</label>
              <input class="input-dark" id="moment-title-{moment.moment_id}" value={moment.title} on:input={(event) => updateMoment(moment.moment_id, { title: event.currentTarget.value })} />
            </div>
            <div>
              <label class="label-dark" for="moment-effect-{moment.moment_id}">Atmosphere</label>
              <select class="input-dark" id="moment-effect-{moment.moment_id}" value={moment.effect} on:change={(event) => updateMoment(moment.moment_id, { effect: event.currentTarget.value })}>
                {#each MOMENT_EFFECTS as effect}<option value={effect}>{effect.replaceAll('_', ' ')}</option>{/each}
              </select>
            </div>
          </div>
          <div>
            <label class="label-dark" for="moment-body-{moment.moment_id}">Words or direction</label>
            <textarea class="input-dark min-h-20 resize-y" id="moment-body-{moment.moment_id}" value={moment.body} on:input={(event) => updateMoment(moment.moment_id, { body: event.currentTarget.value })}></textarea>
          </div>
          <div class="grid sm:grid-cols-2 gap-3">
            <div>
              <label class="label-dark" for="moment-asset-{moment.moment_id}">Visual or document</label>
              <select class="input-dark" id="moment-asset-{moment.moment_id}" value={moment.asset_ref} on:change={(event) => updateMoment(moment.moment_id, { asset_ref: event.currentTarget.value })}>
                <option value="">Cover / automatic</option>
                {#each scopedAssets as asset}<option value={asset.asset_id}>{asset.title || asset.filename || asset.role}</option>{/each}
              </select>
            </div>
            <div>
              <label class="label-dark" for="moment-duration-{moment.moment_id}">Display duration (ms)</label>
              <input class="input-dark" id="moment-duration-{moment.moment_id}" type="number" min="0" step="250" value={moment.duration_ms}
                on:input={(event) => updateMoment(moment.moment_id, { duration_ms: Math.max(0, Number(event.currentTarget.value) || 0) })} />
            </div>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <div class="rounded-2xl p-4" style="background:rgba(123,92,240,.08);border:1px solid rgba(123,92,240,.25);">
    <p class="text-sm font-bold text-white">Generated album Journey</p>
    <p class="text-xs mt-1 leading-relaxed" style="color:var(--ink-muted);">
      New releases begin with an object encounter, identity and tracklist reveal; each track receives a brief title reveal; the release closes with reflection, credits, collector message, Archive and History invitations. Your edits above replace that direction without adding repetitive introductions between songs.
    </p>
    {#if !$releaseProject.lyrics.some((entry) => entry.timed_lines?.length) && !$play.games?.length && !$assets.guide?.nodes?.length}
      <p class="text-xs mt-2" style="color:var(--ink-muted);">Add lyrics, extras or games to give the Journey more material to reveal.</p>
    {/if}
  </div>
</div>
