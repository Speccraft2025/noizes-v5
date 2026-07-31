<script>
  import { assets } from '$lib/stores/package.js';

  function handleAudio(e) {
    const file = e.target.files?.[0]; if (!file) return;
    assets.update(a => ({ ...a, audioFile: file, audioName: file.name }));
  }
  function handleCover(e) {
    const file = e.target.files?.[0]; if (!file) return;
    assets.update(a => ({ ...a, coverFile: file, coverName: file.name }));
  }
  function dropAudio(e) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0]; if (!file) return;
    assets.update(a => ({ ...a, audioFile: file, audioName: file.name }));
  }
  function dropCover(e) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0]; if (!file) return;
    assets.update(a => ({ ...a, coverFile: file, coverName: file.name }));
  }
</script>

<div class="space-y-5">
  <div>
    <p class="t-caption mb-2">Step 2</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Assets</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">Upload your audio and cover art.</p>
  </div>

  <!-- Audio -->
  <div>
    <p class="label-dark">Audio File *</p>
    {#if $assets.audioName}
      <div class="flex items-center justify-between rounded-lg px-4 py-3 glass">
        <div class="flex items-center gap-3">
          <span class="text-violet text-lg">♫</span>
          <span class="text-sm text-white font-medium truncate">{$assets.audioName}</span>
        </div>
        <button class="text-xs font-semibold" style="color: var(--ink-muted);"
          on:click={() => assets.update(a => ({ ...a, audioFile: null, audioName: '' }))}>remove</button>
      </div>
    {:else}
      <label class="glass rounded-lg flex flex-col items-center justify-center py-10 cursor-pointer"
        on:dragover|preventDefault on:drop={dropAudio} style="border-style: dashed;">
        <div class="w-10 h-10 rounded-full mb-3 flex items-center justify-center" style="background: var(--spectral-violet-glow);">
          <span class="text-violet text-xl">♫</span>
        </div>
        <span class="t-caption mb-1">WAV · MP3 · FLAC</span>
        <span class="text-sm" style="color: var(--ink-muted);">Drop file or <span class="text-white underline">browse</span></span>
        <input type="file" class="hidden" accept=".wav,.mp3,.flac,audio/*" on:change={handleAudio} />
      </label>
    {/if}
  </div>

  <!-- Cover -->
  <div>
    <p class="label-dark">Cover Image *</p>
    {#if $assets.coverName}
      <div class="flex items-center justify-between rounded-lg px-4 py-3 glass">
        <div class="flex items-center gap-3">
          <span class="text-violet text-lg">◼</span>
          <span class="text-sm text-white font-medium truncate">{$assets.coverName}</span>
        </div>
        <button class="text-xs font-semibold" style="color: var(--ink-muted);"
          on:click={() => assets.update(a => ({ ...a, coverFile: null, coverName: '' }))}>remove</button>
      </div>
    {:else}
      <label class="glass rounded-lg flex flex-col items-center justify-center py-10 cursor-pointer"
        on:dragover|preventDefault on:drop={dropCover} style="border-style: dashed;">
        <div class="w-10 h-10 rounded-full mb-3 flex items-center justify-center" style="background: rgba(75,107,240,0.15);">
          <span class="text-cobalt text-xl">◼</span>
        </div>
        <span class="t-caption mb-1">JPG · PNG · WEBP</span>
        <span class="text-sm" style="color: var(--ink-muted);">Drop file or <span class="text-white underline">browse</span></span>
        <input type="file" class="hidden" accept="image/*" on:change={handleCover} />
      </label>
    {/if}
  </div>
</div>
