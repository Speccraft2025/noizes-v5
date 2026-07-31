<script>
  import { assets } from '$lib/stores/package.js';
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

  // ── audio from store ───────────────────────────────────────────────────────
  $: if ($assets.audioFile && !audioUrl) {
    audioUrl = URL.createObjectURL($assets.audioFile);
  }

  onDestroy(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    cancelAnimationFrame(animFrame);
  });

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
    assets.update(a => ({ ...a, lyrics: result }));
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
    <p class="t-caption mb-2">Step 3</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Lyrics Sync</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">
      Sync lyric timestamps against the audio in your browser.
    </p>
  </div>

  {#if !$assets.audioFile}
    <div class="glass rounded-xl p-6 text-center">
      <p class="text-sm" style="color: var(--ink-muted);">Upload an audio file in Step 2 first.</p>
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
      ></textarea>
      <p class="text-xs mt-1" style="color: var(--ink-muted);">
        {rawText.split('\n').filter(l => l.trim()).length} lines
      </p>
    </div>

    <button class="btn-spectral w-full py-3.5 text-base rounded-xl" disabled={!rawText.trim()} on:click={startSync}>
      Start lyric sync →
    </button>

    {#if $assets.lyrics && $assets.lyrics.length}
      <p class="text-xs text-center" style="color: var(--ink-muted);">
        ✓ {$assets.lyrics.length} lines already synced — re-run to replace
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
