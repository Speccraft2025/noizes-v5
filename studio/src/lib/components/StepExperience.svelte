<script>
  // Step 6 — the experience system.
  //
  // ULTRA is the default and its authoring is unchanged: choosing it renders the
  // Guide editor exactly as before. Choosing Transcendence reveals the panel that
  // measures the recording and lets the creator direct the world built from it.
  import { onDestroy } from 'svelte';
  import { releaseProject, template, transcendence } from '#lib/stores/package.js';
  import { CANONICAL_TEMPLATE, TRANSCENDENCE_V2_TEMPLATE, TRANSCENDENCE_V3_TEMPLATE } from '#lib/utils/project.js';
  import { DEFAULT_ART_DIRECTION, LYRIC_FONT_PRESETS, PALETTES, QUALITY_PROFILES, normalizeArtDirection, buildTranscendenceHTML } from '#lib/utils/transcendence.js';
  import { VIEWER_FRAME_BOOTSTRAP } from '#lib/utils/viewer.js';
  import { canDecodeAudio } from '#lib/analysis/decode.js';
  import { buildLyricLines, defaultLandmarks, landmarkProblems } from '#lib/experiences/transcendence/landmarks.js';
  import HelpTip from './HelpTip.svelte';
  import StepGuide from './StepGuide.svelte';
  import TerrainPreview from './TerrainPreview.svelte';

  let analysing = false;
  let showSystemPicker = false;
  let analysisError = '';
  let progress = { percent: 0, label: '' };
  let controller = null;
  let elapsedMs = 0;
  let startedAt = 0;

  $: tracks = $releaseProject.tracks ?? [];
  $: selectedTrackId = $transcendence.track_id || tracks.find((track) => !track.hidden)?.track_id || tracks[0]?.track_id || '';
  $: selectedTrack = tracks.find((track) => track.track_id === selectedTrackId) ?? null;
  $: art = { ...DEFAULT_ART_DIRECTION, ...normalizeArtDirection($transcendence.art_direction ?? {}) };
  $: analysis = $transcendence.analysis;
  $: bandCentres = analysis?.parameters?.terrain?.band_centres_hz ?? [];
  $: duration = analysis?.duration_seconds ?? 0;

  // The audio the creator actually attached to the selected track.
  // Prefer the track's explicit primary reference. Older drafts can have a
  // stale/missing `track_id` on an otherwise valid referenced asset, so only
  // use the role-and-track lookup as the compatibility fallback.
  $: audioAsset = ($releaseProject.audio_assets ?? []).find((asset) =>
    asset.asset_id === selectedTrack?.primary_audio_ref && asset.file)
    ?? ($releaseProject.audio_assets ?? []).find((asset) =>
      asset.track_id === selectedTrackId && asset.file && asset.role === 'primary_master');

  $: timedLines = ($releaseProject.lyrics ?? [])
    .find((entry) => entry.track_id === selectedTrackId)?.timed_lines ?? [];

  $: landmarks = $transcendence.landmarks?.length
    ? $transcendence.landmarks
    : defaultLandmarks(timedLines, { durationSeconds: duration, bands: bandCentres.length || 128 });

  $: lyricLines = analysis
    ? buildLyricLines({ timedLines, landmarks, bandCentresHz: bandCentres, durationSeconds: duration })
    : [];
  $: problems = landmarkProblems({ lyricLines, durationSeconds: duration });
  $: guidedPoints = $transcendence.guided_points?.length
    ? $transcendence.guided_points
    : defaultGuidedPoints(duration);

  const update = (patch) => transcendence.update((value) => ({ ...value, ...patch }));
  const setArt = (patch) => update({ art_direction: { ...art, ...patch } });

  function chooseSystem(next) {
    template.set(next);
    showSystemPicker = false;
    if ((next === TRANSCENDENCE_V2_TEMPLATE || next === TRANSCENDENCE_V3_TEMPLATE) && !$transcendence.track_id && selectedTrackId) {
      update({ track_id: selectedTrackId });
    }
  }

  function moveLandmark(index, patch) {
    const next = landmarks.map((landmark, i) => (i === index ? { ...landmark, ...patch } : landmark));
    update({ landmarks: next });
  }

  function defaultGuidedPoints(seconds) {
    const end = Math.max(1, Number(seconds) || 1);
    return [
      { id: 'p1', label: 'Start', time: 0, height: 620, pan: 0, easterEgg: 'none' },
      { id: 'p2', label: 'First trough', time: end * .22, height: 260, pan: -18, easterEgg: 'none' },
      { id: 'p3', label: 'Peak traverse', time: end * .44, height: 420, pan: 12, easterEgg: 'none' },
      { id: 'p4', label: 'Pinned note', time: end * .63, height: 360, pan: -10, easterEgg: 'note' },
      { id: 'p5', label: 'Video trough', time: end * .82, height: 240, pan: 16, easterEgg: 'video' },
      { id: 'p6', label: 'Finish', time: end, height: 520, pan: 0, easterEgg: 'none' },
    ].map((point) => ({ ...point, time: Number(point.time.toFixed(2)) }));
  }

  function ensureGuidedPoints() {
    if (!$transcendence.guided_points?.length) update({ guided_points: defaultGuidedPoints(duration) });
  }

  function updateGuidedPoint(index, patch) {
    const next = guidedPoints.map((point, pointIndex) => pointIndex === index ? { ...point, ...patch } : point);
    update({ guided_points: next });
  }

  function addHiddenPoint() {
    const index = guidedPoints.length - 5;
    update({ guided_points: [...guidedPoints, { id: `hidden-${Date.now()}`, label: `Hidden ${Math.max(1, index)}`, time: duration * .5, height: 300, pan: 0, easterEgg: 'note', hidden: true }] });
  }

  async function analyse() {
    if (!audioAsset?.file) {
      analysisError = 'Attach audio to this track in the Assets step first.';
      return;
    }
    analysisError = '';
    analysing = true;
    startedAt = Date.now();
    elapsedMs = 0;
    controller = new AbortController();
    progress = { percent: 0, label: 'Starting' };

    try {
      // Imported here rather than at module scope so the DSP and the 850 KB of
      // runtime source only load for a creator who actually chose this system.
      const { analyseTrack } = await import('#lib/analysis/index.js');
      const result = await analyseTrack(audioAsset.file, {
        signal: controller.signal,
        source: {
          title: selectedTrack?.title ?? '',
          performer: selectedTrack?.primary_artist ?? '',
        },
        onProgress: (update) => {
          progress = { percent: update.percent, label: update.label };
          elapsedMs = Date.now() - startedAt;
        },
      });
      update({
        terrain: result.terrain,
        analysis: result.analysis,
        terrain_data: result.terrainData,
        track_id: selectedTrackId,
        // Placements from a previous analysis of a different track would be
        // meaningless; a re-analysis of the same track keeps them.
        landmarks: $transcendence.track_id === selectedTrackId ? $transcendence.landmarks : [],
      });
      elapsedMs = Date.now() - startedAt;
    } catch (error) {
      if (error?.name !== 'AbortError') analysisError = error?.message || String(error);
    } finally {
      analysing = false;
      controller = null;
    }
  }

  function cancel() {
    controller?.abort();
  }

  onDestroy(() => {
    controller?.abort();
    closeNedPreview();
  });

  let nedPreview = null;
  let nedPreviewFrame = null;
  let nedPreviewSent = false;
  let nedPreviewReady = false;
  let nedPreviewLoading = false;
  let nedPreviewError = '';

  $: if (nedPreviewFrame && nedPreviewReady) {
    nedPreviewFrame.contentWindow?.postMessage({ type: 'ned:visual-update', artDirection: art }, '*');
  }

  const DIRECTION_TARGETS = [
    { key: 'exposure', label: 'Exposure', min: 0, max: 2, step: 0.05, initial: 1 },
    { key: 'relief', label: 'Relief', min: 0, max: 2, step: 0.05, initial: 1 },
    { key: 'atmosphere', label: 'Atmosphere', min: 0, max: 2, step: 0.05, initial: 1 },
    { key: 'ahead', label: 'Ahead', min: 0, max: 2, step: 0.05, initial: 1 },
    { key: 'air', label: 'Air', min: 0, max: 2, step: 0.05, initial: 1 },
  ];

  $: directionTracks = $transcendence.direction_tracks ?? {};

  $: if (nedPreviewFrame && nedPreviewReady && directionTracks) {
    nedPreviewFrame.contentWindow?.postMessage({ type: 'ned:direction-tracks', tracks: directionTracks }, '*');
  }

  function addKeyframe(target, time, value) {
    const tracks = { ...$transcendence.direction_tracks };
    const existing = [...(tracks[target] || [])];
    existing.push({ time: Number(time), value: Number(value) });
    existing.sort((a, b) => a.time - b.time);
    tracks[target] = existing;
    update({ direction_tracks: tracks });
  }

  function removeKeyframe(target, index) {
    const tracks = { ...$transcendence.direction_tracks };
    const existing = [...(tracks[target] || [])];
    existing.splice(index, 1);
    tracks[target] = existing.length ? existing : undefined;
    const cleaned = Object.fromEntries(Object.entries(tracks).filter(([, v]) => v));
    update({ direction_tracks: Object.keys(cleaned).length ? cleaned : {} });
  }

  function updateKeyframe(target, index, patch) {
    const tracks = { ...$transcendence.direction_tracks };
    const existing = [...(tracks[target] || [])];
    existing[index] = { ...existing[index], ...patch };
    existing.sort((a, b) => a.time - b.time);
    tracks[target] = existing;
    update({ direction_tracks: tracks });
  }

  async function launchNedPreview() {
    if (!analysis || !audioAsset?.file || !$transcendence.terrain) return;
    nedPreviewLoading = true;
    nedPreviewError = '';
    nedPreviewSent = false;
    nedPreviewReady = false;
    try {
      const audioPath = 'preview/audio';
      const terrainPath = 'preview/terrain.png';
      const buildPreview = $template === TRANSCENDENCE_V3_TEMPLATE
        ? (await import('#lib/utils/transcendence-v3.js')).buildTranscendenceV3HTML
        : $template === TRANSCENDENCE_V2_TEMPLATE
          ? (await import('#lib/utils/transcendence-v2.js')).buildTranscendenceV2HTML
          : buildTranscendenceHTML;
      const result = await buildPreview({
        identity: { title: selectedTrack?.title || 'Preview', artist: selectedTrack?.primary_artist || '', release_id: 'ned-preview' },
        edition: {},
        analysis,
        track: {
          track_id: selectedTrackId,
          title: selectedTrack?.title || '',
          primary_artist: selectedTrack?.primary_artist || '',
          audio: { src: audioPath, mime: audioAsset.file.type || 'audio/mpeg' },
          terrain: terrainPath,
        },
        timedLines,
        landmarks,
        artDirection: art,
        terrainData: $transcendence.terrain_data,
        directionTracks,
        qualityProfile: $transcendence.quality_preview,
      });
      const [audioBytes, terrainBytes] = await Promise.all([
        audioAsset.file.arrayBuffer(),
        $transcendence.terrain.arrayBuffer(),
      ]);
      nedPreview = {
        html: result.html,
        resources: [
          { path: audioPath, mime: audioAsset.file.type || 'audio/mpeg', bytes: audioBytes },
          { path: terrainPath, mime: 'image/png', bytes: terrainBytes },
        ],
      };
    } catch (err) {
      nedPreviewError = err?.message || String(err);
    } finally {
      nedPreviewLoading = false;
    }
  }

  function loadNedPreviewFrame() {
    if (!nedPreviewFrame?.contentWindow || !nedPreview || nedPreviewSent) return;
    const resources = nedPreview.resources.map((r) => ({ ...r }));
    nedPreviewFrame.contentWindow.postMessage({
      type: 'noizes:viewer:load',
      html: nedPreview.html,
      resources,
    }, '*', resources.map((r) => r.bytes));
    nedPreviewSent = true;
    nedPreviewReady = true;
  }

  function closeNedPreview() {
    nedPreview = null;
    nedPreviewSent = false;
    nedPreviewReady = false;
  }

  const timecode = (seconds) => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };
</script>

<div class="experience-editor space-y-8">
  <div>
    <h2 class="t-title mb-1">Experience</h2>
    <p class="text-xs mb-5" style="color: var(--ink-muted);">
      What a collector opens. Two systems, and they make different kinds of object.<HelpTip field="experience_system" />
    </p>

    {#if $template === CANONICAL_TEMPLATE && !showSystemPicker}
      <div class="flex items-center justify-between gap-4 mb-5 rounded-xl px-3 py-2" style="background:rgba(123,92,240,.07);border:1px solid rgba(123,92,240,.20);">
        <p class="text-xs" style="color:var(--ink-secondary);"><strong class="text-white">ULTRA</strong> · cinematic release experience</p>
        <button type="button" class="text-[11px] font-bold shrink-0" style="color:#a991ff;" on:click={() => showSystemPicker = true}>Change system</button>
      </div>
    {:else}
    <div class="grid gap-3 sm:grid-cols-2 mb-5">
      <button type="button" class="text-left rounded-2xl p-4 transition-all duration-200"
        style={$template === CANONICAL_TEMPLATE
          ? 'background: rgba(123,92,240,0.10); border: 1px solid rgba(123,92,240,0.55);'
          : 'background: rgba(255,255,255,0.02); border: 1px solid var(--border-dim);'}
        on:click={() => chooseSystem(CANONICAL_TEMPLATE)}>
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-black text-white">ULTRA</span>
          {#if $template === CANONICAL_TEMPLATE}<span class="text-[10px] font-bold" style="color:#7B5CF0;">SELECTED</span>{/if}
        </div>
          <p class="text-xs leading-relaxed" style="color: var(--ink-secondary);">
          A ready-made cinematic player. Add your media, lyrics and cover art; ULTRA handles the presentation for you.
        </p>
        <p class="text-[10px] mt-3 uppercase tracking-widest" style="color:#9a82ff;">Fast path · no visual setup required</p>
      </button>

      <button type="button" class="text-left rounded-2xl p-4 transition-all duration-200"
        style={$template === TRANSCENDENCE_V3_TEMPLATE
          ? 'background: rgba(123,92,240,0.10); border: 1px solid rgba(123,92,240,0.55);'
          : 'background: rgba(255,255,255,0.02); border: 1px solid var(--border-dim);'}
        on:click={() => chooseSystem(TRANSCENDENCE_V3_TEMPLATE)}>
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-black text-white">TRANSCENDENCE V3</span>
          {#if $template === TRANSCENDENCE_V3_TEMPLATE}<span class="text-[10px] font-bold" style="color:#7B5CF0;">SELECTED</span>{/if}
        </div>
        <p class="text-xs leading-relaxed" style="color: var(--ink-secondary);">
          A continuous landscape whose ranges, peaks, troughs and surface are derived from
          the recording's real time-frequency structure, with a comfort-directed flight.
        </p>
      </button>
    </div>
    {/if}
  </div>

  {#if $template === CANONICAL_TEMPLATE}
    <div class="border-t pt-8" style="border-color: var(--border-dim);">
      <StepGuide />
    </div>
  {:else}
    <div class="border-t pt-8 space-y-8" style="border-color: var(--border-dim);">

      <!-- 1. Which recording becomes the world -->
      <section>
        <p class="t-caption mb-2">The recording<HelpTip field="terrain_track" /></p>
        <p class="text-xs mb-3" style="color: var(--ink-muted);">
          One track becomes the terrain. The rest of the release still ships in the package.
        </p>
        {#if !tracks.length}
          <p class="text-xs" style="color:#F0C98A;">Add a track in the Tracklist step first.</p>
        {:else}
          <select class="input-field w-full" bind:value={selectedTrackId}
            on:change={(event) => update({ track_id: event.currentTarget.value })}>
            {#each tracks as track}
              <option value={track.track_id}>{track.position}. {track.title || 'Untitled'}</option>
            {/each}
          </select>
        {/if}
        {#if selectedTrack && !audioAsset}
          <p class="text-xs mt-2" style="color:#F0C98A;">
            This track has no audio yet. Attach it in the Assets step — the terrain is measured from the file itself.
          </p>
        {/if}
      </section>

      <!-- 2. Measure it -->
      <section>
        <p class="t-caption mb-2">Analysis<HelpTip field="terrain_analyse" /></p>
        {#if !canDecodeAudio()}
          <p class="text-xs" style="color:#F0C98A;">This browser cannot decode audio, so the terrain cannot be measured here.</p>
        {:else if analysing}
          <div class="rounded-xl p-4" style="background: rgba(123,92,240,0.06); border: 1px solid rgba(123,92,240,0.25);">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-white">{progress.label}</span>
              <span class="text-xs font-mono" style="color: var(--ink-muted);">{progress.percent}% · {(elapsedMs / 1000).toFixed(1)}s</span>
            </div>
            <div class="h-1.5 rounded-full overflow-hidden mb-3" style="background: rgba(255,255,255,0.08);">
              <div class="h-full rounded-full transition-all duration-200" style="width: {progress.percent}%; background: #7B5CF0;"></div>
            </div>
            <button type="button" class="btn-ghost text-xs" on:click={cancel}>Cancel</button>
          </div>
        {:else}
          <div class="flex items-center gap-3 flex-wrap">
            <button type="button" class="btn-spectral" disabled={!audioAsset} on:click={analyse}>
              {analysis ? 'Re-analyse' : 'Analyse the recording'}
            </button>
            {#if analysis}
              <span class="text-xs font-mono" style="color: var(--ink-muted);">
                {timecode(duration)} · {analysis.frames} frames · {analysis.parameters.terrain.bands} bands
                {#if elapsedMs}· measured in {(elapsedMs / 1000).toFixed(1)}s{/if}
              </span>
            {/if}
          </div>
        {/if}
        {#if analysisError}
          <p class="text-xs mt-2" style="color:#F08A8A;">{analysisError}</p>
        {/if}
        {#if analysis}
          <p class="text-[11px] mt-3 leading-relaxed" style="color: var(--ink-muted);">
            Measured entirely in your browser — nothing was uploaded. The terrain and this
            analysis ship as their own hashed components inside the package.
          </p>
        {/if}
      </section>

      {#if analysis}
        <!-- 3. The world, and how it is presented -->
        <section>
          <p class="t-caption mb-2">Art direction</p>
          <p class="text-xs mb-4" style="color: var(--ink-muted);">
            How the measured landscape is lit and scaled. None of this changes its shape,
            so you never need to re-analyse after changing it.
          </p>

          <TerrainPreview terrain={$transcendence.terrain} {art} landmarks={lyricLines.map((line) => ({ time: line.aligned_seconds, band: line.terrain_band }))}
            bands={bandCentres.length || 128} durationSeconds={duration} />

          <div class="grid gap-4 sm:grid-cols-2 mt-4">
            <label class="block">
              <span class="text-xs font-bold text-white">Height <span class="font-mono font-normal" style="color:var(--ink-muted);">{art.heightScale.toFixed(2)}×</span><HelpTip field="terrain_height" /></span>
              <input type="range" min="0.4" max="2.2" step="0.05" class="w-full mt-1"
                value={art.heightScale} on:input={(e) => setArt({ heightScale: Number(e.currentTarget.value) })}>
            </label>
            <label class="block">
              <span class="text-xs font-bold text-white">Ridge emphasis <span class="font-mono font-normal" style="color:var(--ink-muted);">{art.ridgeEmphasis.toFixed(2)}×</span><HelpTip field="terrain_ridge" /></span>
              <input type="range" min="0" max="2.5" step="0.05" class="w-full mt-1"
                value={art.ridgeEmphasis} on:input={(e) => setArt({ ridgeEmphasis: Number(e.currentTarget.value) })}>
            </label>
            <label class="block">
              <span class="text-xs font-bold text-white">Sun elevation <span class="font-mono font-normal" style="color:var(--ink-muted);">{art.sunElevation.toFixed(0)}°</span><HelpTip field="terrain_sun_elevation" /></span>
              <input type="range" min="8" max="88" step="1" class="w-full mt-1"
                value={art.sunElevation} on:input={(e) => setArt({ sunElevation: Number(e.currentTarget.value) })}>
            </label>
            <label class="block">
              <span class="text-xs font-bold text-white">Sun azimuth <span class="font-mono font-normal" style="color:var(--ink-muted);">{art.sunAzimuth.toFixed(0)}°</span><HelpTip field="terrain_sun_azimuth" /></span>
              <input type="range" min="-180" max="180" step="1" class="w-full mt-1"
                value={art.sunAzimuth} on:input={(e) => setArt({ sunAzimuth: Number(e.currentTarget.value) })}>
            </label>
            <label class="block">
              <span class="text-xs font-bold text-white">Flight altitude <span class="font-mono font-normal" style="color:var(--ink-muted);">{art.flightAltitude.toFixed(2)}×</span><HelpTip field="terrain_flight_altitude" /></span>
              <input type="range" min="0.5" max="2.5" step="0.05" class="w-full mt-1"
                value={art.flightAltitude} on:input={(e) => setArt({ flightAltitude: Number(e.currentTarget.value) })}>
            </label>
            <label class="block">
              <span class="text-xs font-bold text-white">Time scale <span class="font-mono font-normal" style="color:var(--ink-muted);">{art.timeScale.toFixed(2)}×</span><HelpTip field="terrain_time_scale" /></span>
              <input type="range" min="0.5" max="2" step="0.05" class="w-full mt-1"
                value={art.timeScale} on:input={(e) => setArt({ timeScale: Number(e.currentTarget.value) })}>
            </label>
          </div>

          <div class="mt-7 pt-5" style="border-top:1px solid var(--border-dim);">
            <div class="flex items-start justify-between gap-4 mb-3">
              <div>
                <p class="text-xs font-bold text-white">Guided route</p>
                <p class="text-[11px] mt-1" style="color:var(--ink-muted);">Set the six stops for autoplay. Start and finish are fixed; the middle four shape the ride through peaks and troughs.</p>
              </div>
              <button type="button" class="btn-ghost text-[11px] shrink-0" on:click={ensureGuidedPoints}>Reset route</button>
            </div>
            <div class="space-y-2">
              {#each guidedPoints.slice(0, 6) as point, index}
                <div class="rounded-xl p-3" style="background:rgba(255,255,255,.025);border:1px solid {index === 0 || index === 5 ? 'rgba(123,92,240,.35)' : 'var(--border-dim)'};">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black" style="background:rgba(123,92,240,.2);color:#c8bdff;">{index + 1}</span>
                    <input class="input-field flex-1 text-xs" value={point.label} aria-label={`Point ${index + 1} label`} on:change={(e) => updateGuidedPoint(index, { label: e.currentTarget.value })} />
                    <span class="text-[10px] uppercase tracking-wider" style="color:var(--ink-muted);">{index === 0 || index === 5 ? 'fixed' : 'route'}</span>
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <label class="text-[10px]" style="color:var(--ink-muted);">Time
                      <input class="input-field w-full mt-1 text-xs font-mono" type="number" min="0" max={duration} step="0.1" value={point.time} disabled={index === 0 || index === 5} on:change={(e) => updateGuidedPoint(index, { time: Number(e.currentTarget.value) })} />
                    </label>
                    <label class="text-[10px]" style="color:var(--ink-muted);">Camera height
                      <input class="input-field w-full mt-1 text-xs font-mono" type="number" min="80" max="1400" step="10" value={point.height} on:change={(e) => updateGuidedPoint(index, { height: Number(e.currentTarget.value) })} />
                    </label>
                    <label class="text-[10px]" style="color:var(--ink-muted);">Easter egg
                      <select class="input-field w-full mt-1 text-xs" value={point.easterEgg} on:change={(e) => updateGuidedPoint(index, { easterEgg: e.currentTarget.value })}>
                        <option value="none">None</option><option value="note">Pinned note</option><option value="video">Video player</option><option value="voice">Voice recording</option>
                      </select>
                    </label>
                  </div>
                </div>
              {/each}
            </div>
            <button type="button" class="btn-ghost text-xs mt-3" on:click={addHiddenPoint}>+ Add hidden explore point</button>
            <p class="text-[11px] mt-2" style="color:var(--ink-muted);">After the route, visitors can switch to Explore and roam freely. Hidden points stay off the guided path.</p>
          </div>

          <div class="mt-4">
            <span class="text-xs font-bold text-white block mb-2">Palette<HelpTip field="terrain_palette" /></span>
            <div class="flex gap-2 flex-wrap">
              {#each PALETTES as palette}
                <button type="button" class="px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all duration-200"
                  style={art.palette === palette
                    ? 'background: rgba(123,92,240,0.15); border: 1px solid rgba(123,92,240,0.55); color:#fff;'
                    : 'background: rgba(255,255,255,0.03); border: 1px solid var(--border-dim); color: var(--ink-secondary);'}
                  on:click={() => setArt({ palette })}>{palette}</button>
              {/each}
            </div>
          </div>

          <div class="mt-4 flex items-center gap-4 flex-wrap">
            <label class="flex items-center gap-2 text-xs font-bold text-white">
              <input type="checkbox" checked={art.terracing} on:change={(e) => setArt({ terracing: e.currentTarget.checked })}>
              Contour terracing<HelpTip field="terrain_terracing" />
            </label>
            {#if art.terracing}
              <label class="flex items-center gap-2 text-xs" style="color: var(--ink-secondary);">
                Step
                <input type="range" min="0.5" max="6" step="0.1" style="width: 120px;"
                  value={art.terraceStep} on:input={(e) => setArt({ terraceStep: Number(e.currentTarget.value) })}>
                <span class="font-mono" style="color:var(--ink-muted);">{art.terraceStep.toFixed(1)}</span>
              </label>
            {/if}
          </div>

          <div class="mt-6 pt-5" style="border-top: 1px solid var(--border-dim);">
            <span class="text-xs font-bold text-white block mb-1">Lyric typography</span>
            <p class="text-[11px] mb-4" style="color: var(--ink-muted);">
              These settings apply to synced lyrics in Studio preview and the offline package.
            </p>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="text-xs font-bold text-white block mb-1">Typeface</span>
                <select class="input-field w-full" value={art.lyricFont} on:change={(e) => setArt({ lyricFont: e.currentTarget.value })}>
                  {#each LYRIC_FONT_PRESETS as preset}
                    <option value={preset.id}>{preset.label}</option>
                  {/each}
                </select>
              </label>
              <label class="block">
                <span class="text-xs font-bold text-white block mb-1">Color</span>
                <div class="flex items-center gap-2">
                  <input type="color" value={art.lyricColor} on:input={(e) => setArt({ lyricColor: e.currentTarget.value })}
                    class="h-10 w-14 rounded-lg p-1" style="background: rgba(255,255,255,0.04); border: 1px solid var(--border-dim);">
                  <input type="text" value={art.lyricColor} maxlength="7" class="input-field flex-1 font-mono"
                    on:change={(e) => setArt({ lyricColor: e.currentTarget.value })}>
                </div>
              </label>
              <label class="block">
                <span class="text-xs font-bold text-white">Size <span class="font-mono font-normal" style="color:var(--ink-muted);">{art.lyricSize.toFixed(0)}px</span></span>
                <input type="range" min="14" max="64" step="1" class="w-full mt-1"
                  value={art.lyricSize} on:input={(e) => setArt({ lyricSize: Number(e.currentTarget.value) })}>
              </label>
              <label class="block">
                <span class="text-xs font-bold text-white">Line width <span class="font-mono font-normal" style="color:var(--ink-muted);">{art.lyricWidth.toFixed(0)}%</span></span>
                <input type="range" min="24" max="76" step="1" class="w-full mt-1"
                  value={art.lyricWidth} on:input={(e) => setArt({ lyricWidth: Number(e.currentTarget.value) })}>
              </label>
              <label class="block">
                <span class="text-xs font-bold text-white block mb-1">Weight</span>
                <select class="input-field w-full" value={art.lyricWeight} on:change={(e) => setArt({ lyricWeight: Number(e.currentTarget.value) })}>
                  <option value="300">Light</option>
                  <option value="400">Regular</option>
                  <option value="600">Semibold</option>
                  <option value="700">Bold</option>
                </select>
              </label>
              <label class="block">
                <span class="text-xs font-bold text-white block mb-1">Alignment</span>
                <select class="input-field w-full" value={art.lyricAlign} on:change={(e) => setArt({ lyricAlign: e.currentTarget.value })}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <!-- NED Live Preview -->
        <section>
          <p class="t-caption mb-2">Live preview</p>
          <p class="text-xs mb-3" style="color: var(--ink-muted);">
            The real Transcendence world running in-place. Art direction changes above update the terrain instantly.
          </p>
          {#if nedPreviewLoading}
            <div class="rounded-xl p-4" style="background: rgba(123,92,240,0.06); border: 1px solid rgba(123,92,240,0.25);">
              <span class="text-xs font-bold text-white">Building preview…</span>
            </div>
          {:else if nedPreview}
            <div class="relative rounded-xl overflow-hidden" style="aspect-ratio: 16/9; border: 1px solid rgba(123,92,240,0.35);">
              <iframe
                bind:this={nedPreviewFrame}
                title="NED live preview"
                srcdoc={VIEWER_FRAME_BOOTSTRAP}
                on:load={loadNedPreviewFrame}
                allow="autoplay"
                sandbox="allow-scripts"
                class="absolute inset-0 w-full h-full border-0"
              ></iframe>
            </div>
            <div class="flex items-center gap-3 mt-2">
              <span class="text-[11px]" style="color: var(--ink-muted);">
                {nedPreviewReady ? 'Art direction and direction tracks update the world in real time.' : 'Loading…'}
              </span>
              <button type="button" class="btn-ghost text-xs ml-auto" on:click={closeNedPreview}>Close</button>
            </div>
          {:else}
            <button type="button" class="btn-spectral" disabled={!audioAsset} on:click={launchNedPreview}>
              Launch live preview
            </button>
          {/if}
          {#if nedPreviewError}
            <p class="text-xs mt-2" style="color:#F08A8A;">{nedPreviewError}</p>
          {/if}
        </section>

        <!-- NED Direction Tracks -->
        <section>
          <p class="t-caption mb-2">Direction</p>
          <p class="text-xs mb-4" style="color: var(--ink-muted);">
            Time-varying controls. Each track overrides its property at the given time during playback.
            Add keyframes to shape how the world changes through the recording.
          </p>
          {#each DIRECTION_TARGETS as target}
            {@const keyframes = directionTracks[target.key] || []}
            <div class="mb-4 rounded-xl p-3" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-dim);">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-white">{target.label}</span>
                <button type="button" class="text-[10px] px-2 py-0.5 rounded-lg"
                  style="background: rgba(123,92,240,0.15); color: rgba(123,92,240,0.9); border: 1px solid rgba(123,92,240,0.3);"
                  on:click={() => addKeyframe(target.key, duration * 0.5, target.initial)}>+ keyframe</button>
              </div>
              {#if keyframes.length === 0}
                <p class="text-[11px]" style="color: var(--ink-muted);">No keyframes — using default choreography.</p>
              {:else}
                <!-- Visual timeline bar -->
                <button type="button" class="relative block w-full h-6 rounded-lg mb-2 cursor-pointer"
                  aria-label={`Add a ${target.label.toLowerCase()} keyframe on the timeline`}
                  style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);"
                  on:click={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const t = ((e.clientX - rect.left) / rect.width) * duration;
                    addKeyframe(target.key, Math.max(0, Math.min(duration, t)), target.initial);
                  }}>
                  {#each keyframes as kf, i}
                    <div class="absolute top-0.5 w-2.5 h-5 rounded-sm"
                      style="left: {duration > 0 ? (kf.time / duration) * 100 : 0}%; transform: translateX(-50%);
                        background: rgba(123,92,240,{0.4 + kf.value * 0.3});"
                      title="{timecode(kf.time)} → {kf.value.toFixed(2)}"></div>
                  {/each}
                </button>
                <!-- Keyframe list -->
                <div class="space-y-1.5">
                  {#each keyframes as kf, i}
                    <div class="flex items-center gap-2">
                      <label class="flex items-center gap-1 text-[11px] shrink-0" style="color: var(--ink-muted); width: 70px;">
                        <input type="number" min="0" max={duration} step="0.1" class="w-14 text-[11px] rounded px-1 py-0.5"
                          style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: white;"
                          value={kf.time.toFixed(1)}
                          on:change={(e) => updateKeyframe(target.key, i, { time: Number(e.currentTarget.value) })}>
                        s
                      </label>
                      <input type="range" min={target.min} max={target.max} step={target.step} class="flex-1"
                        value={kf.value}
                        on:input={(e) => updateKeyframe(target.key, i, { value: Number(e.currentTarget.value) })}>
                      <span class="text-[11px] font-mono shrink-0 w-8 text-right" style="color: var(--ink-muted);">{kf.value.toFixed(2)}</span>
                      <button type="button" class="text-[11px] px-1.5 py-0.5 rounded"
                        style="color: rgba(240,138,138,0.8);"
                        on:click={() => removeKeyframe(target.key, i)}>x</button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </section>

        <!-- 4. Where the words are cut -->
        <section>
          <p class="t-caption mb-2">Lyric landmarks</p>
          {#if !timedLines.length}
            <p class="text-xs" style="color: var(--ink-muted);">
              No timed lyrics for this track. Add them in the Lyrics step and they will appear here to place.
            </p>
          {:else}
            <p class="text-xs mb-4" style="color: var(--ink-muted);">
              Drag each line along the track and choose the frequency band it is cut into.
              These positions are your decision, not a measurement — the package records them as such.
            </p>
            <div class="space-y-3">
              {#each lyricLines as line, index}
                <div class="rounded-xl p-3" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-dim);">
                  <div class="flex items-baseline justify-between gap-3 mb-2">
                    <span class="text-xs text-white truncate">{line.text || `Line ${index + 1}`}</span>
                    <span class="text-[11px] font-mono shrink-0" style="color: var(--ink-muted);">
                      {timecode(line.aligned_seconds)} · {line.terrain_band_hz} Hz
                    </span>
                  </div>
                  <label class="block mb-1">
                    <span class="sr-only">Time for line {index + 1}<HelpTip field="landmark_time" /></span>
                    <input type="range" min="0" max={duration} step="0.05" class="w-full"
                      value={line.aligned_seconds}
                      on:input={(e) => moveLandmark(index, { time: Number(e.currentTarget.value) })}>
                  </label>
                  <label class="block">
                    <span class="sr-only">Frequency band for line {index + 1}<HelpTip field="landmark_band" /></span>
                    <input type="range" min="0" max={(bandCentres.length || 128) - 1} step="1" class="w-full"
                      value={line.terrain_band}
                      on:input={(e) => moveLandmark(index, { band: Number(e.currentTarget.value) })}>
                  </label>
                </div>
              {/each}
            </div>
            {#if problems.length}
              <ul class="mt-3 space-y-1">
                {#each problems as problem}
                  <li class="text-xs" style="color:#F0C98A;">{problem}</li>
                {/each}
              </ul>
            {/if}
          {/if}
        </section>

        <!-- 5. What a collector's machine will run -->
        <section>
          <p class="t-caption mb-2">Quality<HelpTip field="quality_preview" /></p>
          <p class="text-xs mb-3" style="color: var(--ink-muted);">
            The package ships all four. A collector's machine picks one and can override it;
            this only sets where the experience opens.
          </p>
          <div class="flex gap-2 flex-wrap">
            {#each QUALITY_PROFILES as profile}
              <button type="button" class="px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all duration-200"
                style={$transcendence.quality_preview === profile
                  ? 'background: rgba(123,92,240,0.15); border: 1px solid rgba(123,92,240,0.55); color:#fff;'
                  : 'background: rgba(255,255,255,0.03); border: 1px solid var(--border-dim); color: var(--ink-secondary);'}
                on:click={() => update({ quality_preview: profile })}>{profile}</button>
            {/each}
          </div>
          <p class="text-[11px] mt-3 leading-relaxed" style="color: var(--ink-muted);">
            Essential renders the terrain without WebGL at all, and the lyric stays live
            document text — so the object still opens on a machine that cannot run the world.
          </p>
        </section>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Studio centers slot content; without a definite width the horizontal Journey
     rails contribute their max-content size and can widen the whole workspace. */
  .experience-editor {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }
</style>
