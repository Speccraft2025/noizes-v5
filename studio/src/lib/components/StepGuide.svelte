<script>
  import HelpTip from './HelpTip.svelte';
  import { assets, play, releaseProject, template } from '#lib/stores/package.js';
  import { createUuid, orderedTracks } from '#lib/domain/release.js';
  import {
    MOMENT_EFFECTS,
    RELEASE_MOMENT_TYPES,
    RELEASE_PLACEMENTS,
    TRACK_MOMENT_TYPES,
    createReleaseMoment,
    createTrackMoment,
    materializeJourney,
    releaseTimeline,
  } from '#lib/domain/journey.js';

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
  let activeMomentId = '';
  let initialized = false;

  $: tracks = orderedTracks($releaseProject.tracks);
  $: journey = $releaseProject.journey;
  $: timeline = releaseTimeline(journey, tracks);
  $: activeTrack = tracks.find((track) => track.track_id === activeScope);
  $: activeTrackJourney = journey.track_journeys.find((entry) => entry.track_id === activeScope);
  $: activeMoments = activeScope === 'release' ? journey.release_moments : (activeTrackJourney?.moments || []);
  $: activeMoment = activeMoments.find((moment) => moment.moment_id === activeMomentId) || activeMoments[0];
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
        activeMomentId = moment.moment_id;
        return { ...value, release_moments: [...value.release_moments, moment] };
      }
      const moment = createTrackMoment({ track_id: activeScope, type: 'story', title: 'New track Moment', at_ms: 0 }, { trackId: activeScope, idFactory: createUuid });
      activeMomentId = moment.moment_id;
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

  function selectScope(scope) {
    activeScope = scope;
    activeMomentId = '';
  }

  function selectMoment(momentId) {
    activeMomentId = momentId;
  }

  function moveActiveMoment(direction) {
    const index = activeMoments.findIndex((moment) => moment.moment_id === activeMoment?.moment_id);
    const next = activeMoments[index + direction];
    if (next) activeMomentId = next.moment_id;
  }
</script>

<div class="journey-editor">
  <header class="journey-heading">
    <p class="t-caption">Release timeline overview</p>
    <p>Choose a moment to edit its attributes, or select a track to direct its own timeline.</p>
  </header>

  <section class="timeline-shell" aria-label="Release timeline">
    <div class="timeline-strip">
      {#each timeline as item, index}
        {#if item.kind === 'track'}
          <button type="button" class:active={activeScope === item.track.track_id} class="timeline-card track-card" on:click={() => selectScope(item.track.track_id)}>
            <b>{index + 1}</b><span>{item.track.title || `Track ${item.track.track_number}`}</span>
          </button>
        {:else if item.kind === 'moment'}
          <button type="button" class:active={activeScope === 'release' && activeMomentId === item.moment.moment_id} class="timeline-card moment-card" on:click={() => { selectScope('release'); selectMoment(item.moment.moment_id); }}>
            <b>{index + 1}</b><span>{item.moment.title || LABELS[item.moment.type]}</span>
          </button>
        {:else}
          <button type="button" class="timeline-card transition-card" title="Set a transition override" on:click={() => addTransitionOverride(item.from_track_id, item.to_track_id)}>
            <b>→</b><span>Transition</span>
          </button>
        {/if}
      {/each}
      <button type="button" class="timeline-card add-card" on:click={addMoment}><b>+</b><span>Add moment</span></button>
    </div>
  </section>

  <section class="editor-layout" aria-labelledby="direction-heading">
    <div class="moment-stage">
      <div class="stage-title">
        <div>
          <p class="t-caption" id="direction-heading">{activeScope === 'release' ? 'Release-level direction' : `Track ${String(activeTrack?.track_number || '').padStart(2, '0')} direction`}</p>
          <h2>{activeScope === 'release' ? $releaseProject.release.title || 'Complete release' : activeTrack?.title || 'Untitled track'}</h2>
        </div>
        <button type="button" class="add-moment" on:click={addMoment}>+ Add moment</button>
      </div>

      {#if activeMoments.length}
        <div class="moment-carousel" aria-label="Moments in this direction">
          <button class="carousel-arrow" type="button" on:click={() => moveActiveMoment(-1)} disabled={activeMoments[0]?.moment_id === activeMoment?.moment_id} aria-label="Previous moment">←</button>
          <div class="moment-cards">
            {#each activeMoments as moment, index (moment.moment_id)}
              <button type="button" class:chosen={moment.moment_id === activeMoment?.moment_id} class="moment-tile" on:click={() => selectMoment(moment.moment_id)}>
                <small>{index + 1}</small>
                <strong>{moment.title || LABELS[moment.type]}</strong>
                <span>{activeScope === 'release' ? LABELS[moment.placement] : formatTime(moment.at_ms)}</span>
              </button>
            {/each}
          </div>
          <button class="carousel-arrow" type="button" on:click={() => moveActiveMoment(1)} disabled={activeMoments.at(-1)?.moment_id === activeMoment?.moment_id} aria-label="Next moment">→</button>
        </div>
      {:else}
        <button type="button" class="empty-stage" on:click={addMoment}>Add the first Moment for this {activeScope === 'release' ? 'release' : 'track'}.</button>
      {/if}
    </div>

    <aside class="attributes-panel" aria-label="Edit moment attributes">
      {#if activeMoment}
        <div class="attributes-heading">
          <p class="t-caption">Edit moment’s attributes</p>
          <button type="button" class="remove-moment" aria-label="Remove Moment" on:click={() => removeMoment(activeMoment.moment_id)}>Remove</button>
        </div>
        <label class="editor-label" for="moment-title-{activeMoment.moment_id}">Title<HelpTip field="moment_title" /></label>
        <input class="input-dark editor-input" id="moment-title-{activeMoment.moment_id}" value={activeMoment.title} on:input={(event) => updateMoment(activeMoment.moment_id, { title: event.currentTarget.value })} />
        <div class="attribute-grid">
          <div><label class="editor-label" for="moment-type-{activeMoment.moment_id}">Type<HelpTip field="moment_type" /></label><select class="input-dark editor-input" id="moment-type-{activeMoment.moment_id}" value={activeMoment.type} on:change={(event) => updateMoment(activeMoment.moment_id, { type: event.currentTarget.value })}>{#each activeScope === 'release' ? RELEASE_MOMENT_TYPES : TRACK_MOMENT_TYPES as type}<option value={type}>{LABELS[type] || type.replaceAll('_', ' ')}</option>{/each}</select></div>
          {#if activeScope === 'release'}
            <div><label class="editor-label" for="moment-placement-{activeMoment.moment_id}">Placement<HelpTip field="moment_placement" /></label><select class="input-dark editor-input" id="moment-placement-{activeMoment.moment_id}" value={activeMoment.placement} on:change={(event) => updateMoment(activeMoment.moment_id, { placement: event.currentTarget.value })}>{#each RELEASE_PLACEMENTS as placement}<option value={placement}>{LABELS[placement]}</option>{/each}</select></div>
          {:else}
            <div><label class="editor-label" for="moment-time-{activeMoment.moment_id}">Time (seconds)<HelpTip field="moment_time" /></label><input class="input-dark editor-input" id="moment-time-{activeMoment.moment_id}" type="number" min="0" step="0.1" value={activeMoment.at_ms / 1000} on:input={(event) => updateMoment(activeMoment.moment_id, { at_ms: Math.round((Number(event.currentTarget.value) || 0) * 1000) })} /></div>
          {/if}
        </div>
        {#if activeScope === 'release' && ['before_track', 'after_track', 'during_transition'].includes(activeMoment.placement)}
          <label class="editor-label" for="moment-anchor-{activeMoment.moment_id}">Anchor track<HelpTip field="moment_anchor" /></label><select class="input-dark editor-input" id="moment-anchor-{activeMoment.moment_id}" value={activeMoment.anchor_track_id} on:change={(event) => updateMoment(activeMoment.moment_id, { anchor_track_id: event.currentTarget.value })}><option value="">Choose a track</option>{#each tracks as track}<option value={track.track_id}>T{track.track_number} — {track.title}</option>{/each}</select>
        {/if}
        <div class="attribute-grid">
          <div><label class="editor-label" for="moment-effect-{activeMoment.moment_id}">Atmosphere<HelpTip field="moment_effect" /></label><select class="input-dark editor-input" id="moment-effect-{activeMoment.moment_id}" value={activeMoment.effect} on:change={(event) => updateMoment(activeMoment.moment_id, { effect: event.currentTarget.value })}>{#each MOMENT_EFFECTS as effect}<option value={effect}>{effect.replaceAll('_', ' ')}</option>{/each}</select></div>
          <div><label class="editor-label" for="moment-duration-{activeMoment.moment_id}">Duration (seconds)<HelpTip field="moment_duration" /></label><input class="input-dark editor-input" id="moment-duration-{activeMoment.moment_id}" type="number" min="0" step="0.5" value={activeMoment.duration_ms / 1000} on:input={(event) => updateMoment(activeMoment.moment_id, { duration_ms: Math.max(0, Math.round((Number(event.currentTarget.value) || 0) * 1000)) })} /></div>
        </div>
        <label class="editor-label" for="moment-body-{activeMoment.moment_id}">Words or direction<HelpTip field="moment_body" /></label><textarea class="input-dark editor-input editor-textarea" id="moment-body-{activeMoment.moment_id}" value={activeMoment.body} on:input={(event) => updateMoment(activeMoment.moment_id, { body: event.currentTarget.value })}></textarea>
        <label class="editor-label" for="moment-asset-{activeMoment.moment_id}">Visual<HelpTip field="moment_asset" /></label><select class="input-dark editor-input" id="moment-asset-{activeMoment.moment_id}" value={activeMoment.asset_ref} on:change={(event) => updateMoment(activeMoment.moment_id, { asset_ref: event.currentTarget.value })}><option value="">Cover / automatic</option>{#each scopedAssets as asset}<option value={asset.asset_id}>{asset.title || asset.filename || asset.role}</option>{/each}</select>
      {:else}
        <p class="empty-attributes">Select a moment to edit it, or add a new one.</p>
      {/if}
    </aside>
  </section>

  <details class="playback-details">
    <summary>Playback & navigation</summary>
    <div class="playback-controls">
      <label class="editor-label" for="playback-mode">Transition mode<HelpTip field="track_crossfade" /></label><select id="playback-mode" class="input-dark editor-input" value={journey.playback_mode} on:change={(event) => setPlayback({ playback_mode: event.currentTarget.value })}><option value="sequential">Sequential</option><option value="gapless">Gapless</option><option value="crossfade">Crossfade</option></select>
      {#if journey.playback_mode === 'crossfade'}<div><label class="editor-label" for="crossfade-duration">Global crossfade (ms)<HelpTip field="crossfade_duration" /></label><input id="crossfade-duration" class="input-dark editor-input" type="number" min="250" max="12000" step="250" value={journey.transitions.find((transition) => !transition.from_track_id && transition.type === 'crossfade')?.duration_ms || 1500} on:input={(event) => setCrossfadeDuration(event.currentTarget.value)} /></div>{/if}
      {#each [['allow_track_skip', 'Allow track selection', 'nav_track_skip'], ['allow_seek', 'Allow seeking', 'nav_seek'], ['allow_shuffle', 'Allow shuffle', 'nav_shuffle'], ['allow_repeat', 'Allow repeat', 'nav_repeat'], ['resume_enabled', 'Remember listening position', 'nav_resume'], ['allow_archive_during_journey', 'Archive during Journey', 'nav_archive']] as [field, label, help]}
        <label class="navigation-toggle"><input type="checkbox" checked={journey.navigation[field]} on:change={(event) => setNavigation(field, event.currentTarget.checked)} />{label}<HelpTip field={help} /></label>
      {/each}
    </div>
  </details>
</div>

<style>
  .journey-editor { --violet:#7142ee; --lilac:#b964e0; --surface:#0c0c10; --surface-raised:#13131a; --line:rgba(255,255,255,.11); color:white; max-width:100%; min-width:0; overflow:hidden; }
  .journey-heading { margin-bottom:12px; } .journey-heading p:last-child { color:var(--ink-muted); font-size:12px; margin-top:4px; }
  .timeline-shell { max-width:100%; background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:8px; overflow-x:auto; overscroll-behavior-x:contain; }
  .timeline-strip { display:flex; gap:6px; min-width:max-content; }
  .timeline-card { width:clamp(84px, 8vw, 108px); min-height:72px; border-radius:8px; text-align:left; padding:8px; display:flex; flex-direction:column; justify-content:space-between; color:#100719; background:#4d4f58; transition:transform .15s, outline-color .15s; }
  .timeline-card:hover, .timeline-card.active { outline:2px solid #fff; outline-offset:1px; transform:translateY(-1px); }
  .timeline-card b { font-size:17px; line-height:1; } .timeline-card span { font-size:11px; font-weight:800; line-height:1.18; }
  .moment-card { background:linear-gradient(135deg,#bd6de0,#8748f2); } .track-card { background:#5f20dc; color:#fff; } .transition-card { background:#353741; color:#e1e3e9; width:60px; } .add-card { background:transparent; border:1px dashed #5e6069; color:#b4bac2; width:78px; }
  .editor-layout { display:grid; grid-template-columns:minmax(0,1fr) minmax(290px,340px); margin-top:14px; min-height:0; overflow:hidden; border:1px solid var(--line); border-radius:16px; background:var(--surface); }
  .moment-stage { padding:18px; min-width:0; background:var(--surface); } .stage-title { display:flex; align-items:start; justify-content:space-between; gap:12px; } .stage-title h2 { font-size:18px; font-weight:900; margin-top:4px; } .add-moment { border-radius:8px; background:var(--violet); color:white; padding:8px 11px; font-size:12px; font-weight:800; white-space:nowrap; }
  .moment-carousel { display:grid; grid-template-columns:36px minmax(0,1fr) 36px; align-items:center; gap:8px; min-height:245px; } .moment-cards { display:flex; min-width:0; gap:10px; overflow-x:auto; overscroll-behavior-x:contain; scroll-snap-type:x mandatory; padding:10px 2px; }
  .moment-tile { scroll-snap-align:start; flex:0 0 clamp(180px,25%,230px); min-height:185px; border-radius:10px; padding:13px; display:flex; flex-direction:column; text-align:left; justify-content:space-between; background:linear-gradient(135deg,#a75ccb,#6231c9); color:#0b0610; opacity:.56; transition:opacity .15s, transform .15s, outline-color .15s; } .moment-tile:nth-child(3n+2) { background:linear-gradient(135deg,#8752d8,#5832ae); } .moment-tile:nth-child(3n) { background:linear-gradient(135deg,#6522c8,#3f178b); color:white; } .moment-tile.chosen { opacity:1; transform:translateY(-2px); outline:2px solid white; } .moment-tile small { font-size:23px; font-weight:900; } .moment-tile strong { font-size:17px; line-height:1.08; } .moment-tile span { font-size:10px; font-weight:800; text-transform:uppercase; }
  .carousel-arrow { border-radius:50%; width:36px; height:36px; background:#5aaee6; color:#103f72; font-size:23px; font-weight:900; } .carousel-arrow:disabled { opacity:.25; } .empty-stage { width:100%; margin-top:40px; padding:42px 20px; border:1px dashed #4c5057; border-radius:10px; color:#b8bec7; }
  .attributes-panel { min-width:0; background:var(--surface-raised); border-left:1px solid var(--line); color:#f4f1ff; padding:18px; } .attributes-heading { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:14px; } .attributes-heading .t-caption { color:#b9b2ca; } .remove-moment { color:#f19aaa; font-size:11px; font-weight:800; } .editor-label { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.08em; font-weight:900; margin:11px 0 5px; color:#aca9b5; } .editor-input { width:100%; min-width:0; color:white; background:#1a1a23; border-color:rgba(255,255,255,.12); } .attribute-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; } .editor-textarea { min-height:64px; resize:vertical; } .empty-attributes { margin-top:90px; text-align:center; color:#a9a8af; font-size:13px; }
  .playback-details { margin-top:14px; padding:13px 16px; background:rgba(255,255,255,.03); color:var(--ink-muted); font-size:13px; } .playback-details summary { cursor:pointer; color:white; font-weight:800; } .playback-controls { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:9px 14px; margin-top:10px; } .navigation-toggle { display:flex; align-items:center; gap:7px; font-size:12px; }
  @media (max-width: 900px) { .editor-layout { grid-template-columns:1fr; } .attributes-panel { border-left:0; border-top:1px solid var(--line); min-height:0; } }
  @media (max-width: 560px) { .moment-stage { padding:14px 10px; } .moment-carousel { grid-template-columns:32px minmax(0,1fr) 32px; gap:5px; min-height:230px; } .carousel-arrow { width:32px; height:32px; font-size:21px; } .moment-tile { flex-basis:82%; min-height:170px; } .attribute-grid { grid-template-columns:1fr; } .attributes-panel { padding:16px; } }
</style>
