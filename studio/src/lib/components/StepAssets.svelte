<script>
  import { assets } from '$lib/stores/package.js';

  function handleFile(field, nameField, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    assets.update(a => ({ ...a, [field]: file, [nameField]: file.name }));
  }

  function handleDrop(field, nameField, event) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    assets.update(a => ({ ...a, [field]: file, [nameField]: file.name }));
  }

  function clearFile(field, nameField) {
    assets.update(a => ({ ...a, [field]: null, [nameField]: '' }));
  }
</script>

<div class="space-y-5">
  <div>
    <p class="t-caption mb-2">Step 2</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Assets</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">Upload audio, cover art, and optional lyrics.</p>
  </div>

  <!-- Audio -->
  <div>
    <label class="label-dark">Audio File *</label>
    {#if $assets.audioName}
      <div class="flex items-center justify-between rounded-lg px-4 py-3 glass">
        <div class="flex items-center gap-3">
          <span class="text-violet text-lg">♫</span>
          <span class="text-sm text-white font-medium truncate">{$assets.audioName}</span>
        </div>
        <button class="text-xs font-semibold transition-colors" style="color: var(--ink-muted);" on:click={() => clearFile('audioFile', 'audioName')}>remove</button>
      </div>
    {:else}
      <label
        class="glass rounded-lg flex flex-col items-center justify-center py-10 cursor-pointer transition-all duration-200 hover:border-violet-500"
        on:dragover|preventDefault
        on:drop={(e) => handleDrop('audioFile', 'audioName', e)}
        style="border-style: dashed;"
      >
        <div class="w-10 h-10 rounded-full mb-3 flex items-center justify-center" style="background: var(--spectral-violet-glow);">
          <span class="text-violet text-xl">♫</span>
        </div>
        <span class="t-caption mb-1">WAV · MP3 · FLAC</span>
        <span class="text-sm" style="color: var(--ink-muted);">Drop file or <span class="text-white underline">browse</span></span>
        <input type="file" class="hidden" accept=".wav,.mp3,.flac,audio/*" on:change={(e) => handleFile('audioFile', 'audioName', e)} />
      </label>
    {/if}
  </div>

  <!-- Cover -->
  <div>
    <label class="label-dark">Cover Image *</label>
    {#if $assets.coverName}
      <div class="flex items-center justify-between rounded-lg px-4 py-3 glass">
        <div class="flex items-center gap-3">
          <span class="text-violet text-lg">◼</span>
          <span class="text-sm text-white font-medium truncate">{$assets.coverName}</span>
        </div>
        <button class="text-xs font-semibold transition-colors" style="color: var(--ink-muted);" on:click={() => clearFile('coverFile', 'coverName')}>remove</button>
      </div>
    {:else}
      <label
        class="glass rounded-lg flex flex-col items-center justify-center py-10 cursor-pointer transition-all duration-200"
        on:dragover|preventDefault
        on:drop={(e) => handleDrop('coverFile', 'coverName', e)}
        style="border-style: dashed;"
      >
        <div class="w-10 h-10 rounded-full mb-3 flex items-center justify-center" style="background: rgba(75,107,240,0.15);">
          <span class="text-cobalt text-xl">◼</span>
        </div>
        <span class="t-caption mb-1">JPG · PNG · WEBP</span>
        <span class="text-sm" style="color: var(--ink-muted);">Drop file or <span class="text-white underline">browse</span></span>
        <input type="file" class="hidden" accept="image/*" on:change={(e) => handleFile('coverFile', 'coverName', e)} />
      </label>
    {/if}
  </div>

  <!-- Lyrics -->
  <div>
    <label class="label-dark">Lyrics <span class="normal-case font-normal tracking-normal" style="color: var(--ink-muted);">(optional)</span></label>
    {#if $assets.lyricsName}
      <div class="flex items-center justify-between rounded-lg px-4 py-3 glass">
        <span class="text-sm text-white font-medium">{$assets.lyricsName}</span>
        <button class="text-xs font-semibold" style="color: var(--ink-muted);" on:click={() => clearFile('lyricsFile', 'lyricsName')}>remove</button>
      </div>
    {:else}
      <label
        class="glass rounded-lg flex flex-col items-center justify-center py-8 cursor-pointer transition-all duration-200"
        on:dragover|preventDefault
        on:drop={(e) => handleDrop('lyricsFile', 'lyricsName', e)}
        style="border-style: dashed;"
      >
        <span class="t-caption mb-1">.LRC · .TXT</span>
        <span class="text-sm" style="color: var(--ink-muted);">Drop file or <span class="text-white underline">browse</span></span>
        <input type="file" class="hidden" accept=".lrc,.txt,text/*" on:change={(e) => handleFile('lyricsFile', 'lyricsName', e)} />
      </label>
    {/if}
  </div>
</div>
