<script>
  // Step 6 — the experience system.
  //
  // ULTRA is the default and its authoring is unchanged: choosing it renders the
  // Guide editor exactly as before. Choosing Transcendence reveals the panel that
  // measures the recording and lets the creator direct the world built from it.
  import { onDestroy } from 'svelte';
  import { releaseProject, template, transcendence } from '$lib/stores/package.js';
  import { CANONICAL_TEMPLATE, TRANSCENDENCE_TEMPLATE } from '$lib/utils/project.js';
  import { DEFAULT_ART_DIRECTION, PALETTES, QUALITY_PROFILES, normalizeArtDirection } from '$lib/utils/transcendence.js';
  import { canDecodeAudio } from '$lib/analysis/index.js';
  import { buildLyricLines, defaultLandmarks, landmarkProblems } from '$lib/experiences/transcendence/landmarks.js';
  import HelpTip from './HelpTip.svelte';
  import StepGuide from './StepGuide.svelte';
  import TerrainPreview from './TerrainPreview.svelte';

  let analysing = false;
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
  $: audioAsset = ($releaseProject.audio_assets ?? []).find((asset) =>
    asset.track_id === selectedTrackId && asset.file
    && (asset.asset_id === selectedTrack?.primary_audio_ref || asset.role === 'primary_master'));

  $: timedLines = ($releaseProject.lyrics ?? [])
    .find((entry) => entry.track_id === selectedTrackId)?.timed_lines ?? [];

  $: landmarks = $transcendence.landmarks?.length
    ? $transcendence.landmarks
    : defaultLandmarks(timedLines, { durationSeconds: duration, bands: bandCentres.length || 128 });

  $: lyricLines = analysis
    ? buildLyricLines({ timedLines, landmarks, bandCentresHz: bandCentres, durationSeconds: duration })
    : [];
  $: problems = landmarkProblems({ lyricLines, durationSeconds: duration });

  const update = (patch) => transcendence.update((value) => ({ ...value, ...patch }));
  const setArt = (patch) => update({ art_direction: { ...art, ...patch } });

  function chooseSystem(next) {
    template.set(next);
    if (next === TRANSCENDENCE_TEMPLATE && !$transcendence.track_id && selectedTrackId) {
      update({ track_id: selectedTrackId });
    }
  }

  function moveLandmark(index, patch) {
    const next = landmarks.map((landmark, i) => (i === index ? { ...landmark, ...patch } : landmark));
    update({ landmarks: next });
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
      const { analyseTrack } = await import('$lib/analysis/index.js');
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

  onDestroy(() => controller?.abort());

  const timecode = (seconds) => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };
</script>

<div class="space-y-8">
  <div>
    <h2 class="t-title mb-1">Experience</h2>
    <p class="text-xs mb-5" style="color: var(--ink-muted);">
      What a collector opens. Two systems, and they make different kinds of object.<HelpTip field="experience_system" />
    </p>

    <div class="grid gap-3 sm:grid-cols-2">
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
          A cinematic guided player. You supply the media and the words; the template
          arranges them. Works for any release, of any length.
        </p>
      </button>

      <button type="button" class="text-left rounded-2xl p-4 transition-all duration-200"
        style={$template === TRANSCENDENCE_TEMPLATE
          ? 'background: rgba(123,92,240,0.10); border: 1px solid rgba(123,92,240,0.55);'
          : 'background: rgba(255,255,255,0.02); border: 1px solid var(--border-dim);'}
        on:click={() => chooseSystem(TRANSCENDENCE_TEMPLATE)}>
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-black text-white">TRANSCENDENCE</span>
          {#if $template === TRANSCENDENCE_TEMPLATE}<span class="text-[10px] font-bold" style="color:#7B5CF0;">SELECTED</span>{/if}
        </div>
        <p class="text-xs leading-relaxed" style="color: var(--ink-secondary);">
          A landscape computed from one recording and flown through in sync with it.
          Elevation is the track's own energy, ridges its harmonics. Nothing is modelled.
        </p>
      </button>
    </div>
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
