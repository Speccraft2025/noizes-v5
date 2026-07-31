<script>
  import { releaseProject } from '$lib/stores/package.js';
  import { orderedTracks } from '$lib/domain/release.js';
  import { onDestroy } from 'svelte';

  // ── state ──────────────────────────────────────────────────────────────────
  let rawText   = '';
  let lines     = [];
  let stamps    = [];
  let mode      = 'edit';       // 'edit' | 'sync' | 'review'
  let syncIdx   = 0;
  let audioEl;
  let audioUrl  = '';
  let playing   = false;
  let currentMs = 0;
  let duration  = 0;
  let animFrame;
  let selectedTrackId = '';
  let loadedAudioFile = null;

  $: tracks = orderedTracks($releaseProject.tracks);
  $: if (tracks.length && (!selectedTrackId || !tracks.some((track) => track.track_id === selectedTrackId))) {
    selectTrack(tracks[0].track_id);
  }
  $: selectedTrack = tracks.find((track) => track.track_id === selectedTrackId);
  $: lyricRecord = $releaseProject.lyrics.find((entry) => entry.track_id === selectedTrackId) ?? {
    track_id: selectedTrackId,
    language: '',
    instrumental: false,
    spoken_word: false,
    plain_text: '',
    timed_lines: [],
    translations: [],
    transliterations: [],
    credits: {},
  };
  $: selectedAudio = $releaseProject.audio_assets.find((asset) => asset.asset_id === selectedTrack?.primary_audio_ref)
    ?? $releaseProject.audio_assets.find((asset) => asset.track_id === selectedTrackId && asset.role === 'primary_master');

  // ── audio from selected track ──────────────────────────────────────────────
  $: if ((selectedAudio?.file ?? null) !== loadedAudioFile) {
    loadAudio(selectedAudio?.file ?? null);
  }

  onDestroy(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    cancelAnimationFrame(animFrame);
  });

  function loadAudio(file) {
    if (audioEl) audioEl.pause();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    loadedAudioFile = file;
    audioUrl = file ? URL.createObjectURL(file) : '';
    currentMs = 0;
    duration = 0;
    playing = false;
  }

  function selectTrack(trackId) {
    if (!trackId) return;
    if (audioEl) audioEl.pause();
    selectedTrackId = trackId;
    const record = $releaseProject.lyrics.find((entry) => entry.track_id === trackId);
    const timed = record?.timed_lines ?? [];
    lines = timed.map((line) => line.text);
    stamps = timed.map((line) => Number(line.t) || 0);
    rawText = record?.plain_text || lines.join('\n');
    mode = timed.length ? 'review' : 'edit';
    syncIdx = 0;
    currentMs = 0;
    playing = false;
  }

  function updateLyricRecord(patch) {
    releaseProject.update((project) => {
      const current = project.lyrics.find((entry) => entry.track_id === selectedTrackId) ?? {
        track_id: selectedTrackId,
        language: '',
        instrumental: false,
        spoken_word: false,
        plain_text: '',
        timed_lines: [],
        translations: [],
        transliterations: [],
        credits: {},
      };
      return {
        ...project,
        lyrics: [
          ...project.lyrics.filter((entry) => entry.track_id !== selectedTrackId),
          { ...current, ...patch, track_id: selectedTrackId },
        ],
      };
    });
  }

  async function importLrc(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = text.split(/\r?\n/).flatMap((row) => {
      const match = row.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
      if (!match) return [];
      return [{ t: Math.round((Number(match[1]) * 60 + Number(match[2])) * 1000), text: match[3].trim() }];
    });
    if (!imported.length) return;
    lines = imported.map((line) => line.text);
    stamps = imported.map((line) => line.t);
    rawText = lines.join('\n');
    mode = 'review';
    updateLyricRecord({ plain_text: rawText, timed_lines: imported });
    event.currentTarget.value = '';
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  function fmt(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const frac = Math.floor((ms % 1000) / 100);
    return `${m}:${sec < 10 ? '0' : ''}${sec}.${frac}`;
  }

  function tick() {
    if (audioEl && !audioEl.paused) {
      currentMs = audioEl.currentTime * 1000;
      animFrame = requestAnimationFrame(tick);
    } else {
      playing = false;
    }
  }

  function togglePlay() {
    if (!audioEl) return;
    if (audioEl.paused) {
      audioEl.play(); playing = true;
      animFrame = requestAnimationFrame(tick);
    } else {
      audioEl.pause(); playing = false;
      cancelAnimationFrame(animFrame);
    }
  }

  function seek(e) {
    if (!audioEl || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    audioEl.currentTime = p * (duration / 1000);
    currentMs = p * duration;
  }

  // ── MANUAL SYNC ────────────────────────────────────────────────────────────
  function startSync() {
    lines  = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    stamps = new Array(lines.length).fill(-1);
    syncIdx = 0;
    mode = 'sync';
    if (audioEl) {
      audioEl.currentTime = 0;
      audioEl.play(); playing = true;
      animFrame = requestAnimationFrame(tick);
    }
  }

  function markLine() {
    if (syncIdx >= lines.length) return;
    stamps[syncIdx] = Math.round(currentMs);
    stamps = [...stamps];
    syncIdx++;
    if (syncIdx >= lines.length) {
      mode = 'review';
      if (audioEl) audioEl.pause();
      playing = false;
      saveToStore();
    }
  }

  function skipLine() {
    if (syncIdx >= lines.length) return;
    stamps[syncIdx] = stamps[syncIdx - 1] ?? Math.round(currentMs);
    stamps = [...stamps];
    syncIdx++;
    if (syncIdx >= lines.length) {
      mode = 'review';
      if (audioEl) audioEl.pause();
      playing = false;
      saveToStore();
    }
  }

  function onKeydown(e) {
    if (mode !== 'sync') return;
    if (e.code === 'Space') { e.preventDefault(); markLine(); }
    if (e.code === 'Enter') { e.preventDefault(); markLine(); }
    if (e.code === 'KeyS')  { e.preventDefault(); skipLine(); }
  }

  // ── REVIEW fine-tune ───────────────────────────────────────────────────────
  function nudge(i, ms) {
    stamps[i] = Math.max(0, stamps[i] + ms);
    stamps = [...stamps];
    saveToStore();
  }

  function setStamp(i, val) {
    const parts = val.split(':');
    if (parts.length !== 2) return;
    const [min, rest] = parts;
    const [sec, frac = '0'] = rest.split('.');
    const ms = (parseInt(min) * 60 + parseFloat(`${sec}.${frac}`)) * 1000;
    if (!isNaN(ms)) stamps[i] = Math.round(ms);
    stamps = [...stamps];
    saveToStore();
  }

  function saveToStore() {
    const result = lines
      .map((text, i) => ({ t: stamps[i] >= 0 ? stamps[i] : 0, text }))
      .filter((_, i) => stamps[i] >= 0);
    updateLyricRecord({ plain_text: rawText, timed_lines: result });
  }

  function restart() {
    mode      = 'edit';
    syncIdx   = 0;
    stamps    = [];
    if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; }
    playing = false;
    cancelAnimationFrame(animFrame);
  }

  function previewFrom(i) {
    if (!audioEl || stamps[i] < 0) return;
    audioEl.currentTime = stamps[i] / 1000;
    audioEl.play(); playing = true;
    animFrame = requestAnimationFrame(tick);
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if audioUrl}
  <audio bind:this={audioEl} src={audioUrl} preload="metadata"
    on:loadedmetadata={() => duration = audioEl.duration * 1000}
    on:ended={() => { playing = false; cancelAnimationFrame(animFrame); }}
    style="display:none"
  ></audio>
{/if}

<div class="space-y-5">
  <div>
    <p class="t-caption mb-2">Step 4</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Lyrics by track</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">
      Sync lyric timestamps against the audio in your browser.
    </p>
  </div>

  {#if tracks.length}
    <div class="flex gap-2 overflow-x-auto pb-1">
      {#each tracks as track}
        <button type="button" class="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold" style={selectedTrackId === track.track_id
          ? 'background:#7B5CF0;color:white;'
          : 'background:rgba(255,255,255,.05);color:var(--ink-muted);'} on:click={() => selectTrack(track.track_id)}>
          {track.disc_number}.{track.track_number} {track.title || 'Untitled'}
        </button>
      {/each}
    </div>

    <div class="glass rounded-xl p-4 space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label-dark" for="lyric-language">Language</label>
          <input id="lyric-language" class="input-dark" type="text" value={lyricRecord.language} placeholder="e.g. sw, en"
            on:input={(event) => updateLyricRecord({ language: event.currentTarget.value })} />
        </div>
        <div class="flex items-end pb-2 gap-4 text-xs" style="color:var(--ink-muted);">
          <label class="flex items-center gap-2"><input type="checkbox" checked={lyricRecord.instrumental} on:change={(event) => updateLyricRecord({ instrumental: event.currentTarget.checked })} /> Instrumental</label>
          <label class="flex items-center gap-2"><input type="checkbox" checked={lyricRecord.spoken_word} on:change={(event) => updateLyricRecord({ spoken_word: event.currentTarget.checked })} /> Spoken word</label>
        </div>
      </div>
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs" style="color:var(--ink-muted);">Plain text and timed lines are stored against this stable track ID.</p>
        <label class="btn-ghost text-xs py-1.5 px-3 cursor-pointer shrink-0">Import LRC<input class="hidden" type="file" accept=".lrc,text/plain" on:change={importLrc} /></label>
      </div>
    </div>
  {/if}

  {#if !selectedTrack}
    <div class="glass rounded-xl p-6 text-center">
      <p class="text-sm" style="color: var(--ink-muted);">Add a track in Step 2 before authoring lyrics.</p>
    </div>
  {:else if lyricRecord.instrumental}
    <div class="glass rounded-xl p-6 text-center">
      <p class="text-sm text-white font-bold">Marked instrumental</p>
      <p class="text-xs mt-1" style="color:var(--ink-muted);">The Journey and Archive will identify this intentionally; it is not treated as missing content.</p>
    </div>
  {:else if !selectedAudio?.file}
    <div class="glass rounded-xl p-6 text-center">
      <p class="text-sm" style="color: var(--ink-muted);">Upload this track’s primary master in Step 3 before synchronizing. Plain lyrics can still be saved below.</p>
    </div>

    <div>
      <label class="label-dark" for="lyrics-input-no-audio">Plain lyrics</label>
      <textarea id="lyrics-input-no-audio" class="input-dark resize-none font-mono text-sm" rows="10" bind:value={rawText}
        on:blur={() => updateLyricRecord({ plain_text: rawText })} placeholder="One line per line"></textarea>
    </div>

  {:else if mode === 'edit'}
    <div>
      <label class="label-dark" for="lyrics-input">Paste lyrics — one line per line</label>
      <textarea
        id="lyrics-input"
        class="w-full rounded-xl p-4 text-sm font-mono leading-relaxed resize-none"
        style="background: rgba(255,255,255,0.04); border: 1px solid var(--border-dim); color: #fff; min-height: 220px; outline: none;"
        placeholder={"I never thought I'd see the day\nI thought that I had finally moved along\n..."}
        bind:value={rawText}
        on:blur={() => updateLyricRecord({ plain_text: rawText })}
      ></textarea>
      <p class="text-xs mt-1" style="color: var(--ink-muted);">
        {rawText.split('\n').filter(l => l.trim()).length} lines
      </p>
    </div>

    <button class="btn-spectral w-full py-3.5 text-base rounded-xl" disabled={!rawText.trim()} on:click={startSync}>
      Start lyric sync →
    </button>

    {#if lyricRecord.timed_lines && lyricRecord.timed_lines.length}
      <p class="text-xs text-center" style="color: var(--ink-muted);">
        ✓ {lyricRecord.timed_lines.length} lines already synced — re-run to replace
      </p>
    {/if}

  {:else if mode === 'sync'}
    <!-- ── MANUAL SYNC ── -->
    <div class="glass rounded-xl p-4 space-y-3">
      <button type="button" aria-label="Seek audio" class="relative h-1.5 rounded-full cursor-pointer w-full" style="background: rgba(255,255,255,0.1);" on:click={seek}>
        <div class="absolute inset-y-0 left-0 rounded-full" style="background: var(--gradient-spectral); width: {duration ? (currentMs/duration*100) : 0}%;"></div>
      </button>
      <div class="flex items-center justify-between">
        <span class="font-mono text-xs" style="color: var(--ink-muted);">{fmt(currentMs)}</span>
        <button on:click={togglePlay} class="w-9 h-9 rounded-full flex items-center justify-center border" style="border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); color: #fff;">
          {#if playing}⏸{:else}▶{/if}
        </button>
        <span class="font-mono text-xs" style="color: var(--ink-muted);">{fmt(duration)}</span>
      </div>
    </div>

    <div class="text-center">
      <p class="text-xs mb-2" style="color: var(--ink-muted);">Line {syncIdx + 1} of {lines.length}</p>
      {#if syncIdx > 0}
        <p class="text-sm mb-3" style="color: rgba(255,255,255,0.25);">{lines[syncIdx - 1]}</p>
      {/if}
      <div class="rounded-xl px-6 py-4 mb-3" style="background: rgba(123,92,240,0.12); border: 1px solid rgba(123,92,240,0.3);">
        <p class="text-lg font-semibold text-white leading-snug">{lines[syncIdx]}</p>
      </div>
      {#if syncIdx + 1 < lines.length}
        <p class="text-sm" style="color: rgba(255,255,255,0.25);">{lines[syncIdx + 1]}</p>
      {/if}
    </div>

    <button class="w-full py-5 rounded-2xl font-black text-lg tracking-widest uppercase transition-transform active:scale-95"
      style="background: var(--gradient-spectral); color: #fff; letter-spacing: .15em;" on:click={markLine}>
      ▶ MARK  <span class="text-sm font-normal opacity-60 ml-2">Space / Enter</span>
    </button>

    <div class="flex gap-3">
      <button class="flex-1 btn-ghost text-sm py-2" on:click={skipLine}>Skip (S)</button>
      <button class="flex-1 btn-ghost text-sm py-2" on:click={restart}>Start over</button>
    </div>

    {#if syncIdx > 0}
      <div class="space-y-1 mt-2">
        <p class="text-xs" style="color: var(--ink-muted);">Stamped so far</p>
        {#each lines.slice(0, syncIdx) as line, i}
          <div class="flex items-center gap-3 py-1">
            <span class="font-mono text-xs w-14 shrink-0" style="color: var(--ink-muted);">{fmt(stamps[i])}</span>
            <span class="text-xs truncate" style="color: rgba(255,255,255,0.5);">{line}</span>
          </div>
        {/each}
      </div>
    {/if}

  {:else}
    <!-- ── REVIEW ── -->
    <div class="flex items-center justify-between mb-1">
      <p class="text-sm font-semibold text-white">Review &amp; fine-tune</p>
      <button class="text-xs btn-ghost py-1 px-3" on:click={restart}>Re-sync</button>
    </div>

    <div class="glass rounded-xl p-4 space-y-3">
      <button type="button" aria-label="Seek audio" class="relative h-1.5 rounded-full cursor-pointer w-full" style="background: rgba(255,255,255,0.1);" on:click={seek}>
        <div class="absolute inset-y-0 left-0 rounded-full" style="background: var(--gradient-spectral); width: {duration ? (currentMs/duration*100) : 0}%;"></div>
      </button>
      <div class="flex items-center justify-between">
        <span class="font-mono text-xs" style="color: var(--ink-muted);">{fmt(currentMs)}</span>
        <button on:click={togglePlay} class="w-9 h-9 rounded-full flex items-center justify-center border" style="border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); color: #fff;">
          {#if playing}⏸{:else}▶{/if}
        </button>
        <span class="font-mono text-xs" style="color: var(--ink-muted);">{fmt(duration)}</span>
      </div>
    </div>

    <div class="space-y-2 max-h-96 overflow-y-auto pr-1">
      {#each lines as line, i}
        <div class="glass rounded-xl px-4 py-3">
          <div class="flex items-center gap-2 mb-2">
            <input type="text" class="font-mono text-xs w-16 rounded px-1.5 py-1 text-center"
              style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-dim); color: #7B5CF0;"
              value={fmt(stamps[i])} on:change={e => setStamp(i, e.target.value)} />
            <button class="text-xs px-2 py-1 rounded" style="background: rgba(255,255,255,0.06); color: var(--ink-muted);" on:click={() => nudge(i, -500)}>−0.5s</button>
            <button class="text-xs px-2 py-1 rounded" style="background: rgba(255,255,255,0.06); color: var(--ink-muted);" on:click={() => nudge(i, -100)}>−0.1s</button>
            <button class="text-xs px-2 py-1 rounded" style="background: rgba(255,255,255,0.06); color: var(--ink-muted);" on:click={() => nudge(i, +100)}>+0.1s</button>
            <button class="text-xs px-2 py-1 rounded" style="background: rgba(255,255,255,0.06); color: var(--ink-muted);" on:click={() => nudge(i, +500)}>+0.5s</button>
            <button class="text-xs px-2 py-1 rounded ml-auto" style="background: rgba(123,92,240,0.12); color: #7B5CF0; border: 1px solid rgba(123,92,240,0.2);" on:click={() => previewFrom(i)}>▶</button>
          </div>
          <p class="text-sm text-white leading-snug">{line}</p>
        </div>
      {/each}
    </div>

    <div class="glass rounded-xl px-4 py-3 flex items-center gap-3">
      <span class="text-green-400 text-lg">✓</span>
      <p class="text-sm text-white">{lines.length} lines synced — ready to compile</p>
    </div>
  {/if}
</div>
