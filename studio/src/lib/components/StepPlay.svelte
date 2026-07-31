<script>
  import { play, GAME_CATALOG } from '$lib/stores/package.js';

  const DIFFICULTIES = [
    { id: 'gentle',   label: 'Gentle',   desc: 'wide timing windows' },
    { id: 'standard', label: 'Standard', desc: 'balanced' },
    { id: 'sharp',    label: 'Sharp',    desc: 'for rhythm heads' },
  ];

  function toggleGame(id) {
    play.update(p => ({
      ...p,
      games: p.games.includes(id)
        ? p.games.filter(g => g !== id)
        : [...p.games, id]
    }));
  }
</script>

<div class="space-y-5">
  <div>
    <p class="t-caption mb-2">Interactive extras</p>
    <h3 class="text-xl font-black tracking-tight text-white">Games</h3>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">
      Optional add-ons that live inside the package and play to your music.
      Pick the ones that fit the song — or none for a pure listening edition.
    </p>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
    {#each GAME_CATALOG as g}
      {@const on = $play.games.includes(g.id)}
      <button
        type="button"
        class="text-left rounded-xl p-3.5 transition-all duration-200"
        style={on
          ? 'background: rgba(123,92,240,0.12); border: 1.5px solid #7B5CF0;'
          : 'background: rgba(255,255,255,0.03); border: 1.5px solid rgba(255,255,255,0.07);'}
        on:click={() => toggleGame(g.id)}
      >
        <div class="flex items-center gap-2 mb-1">
          <span class="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[10px]"
            style={on
              ? 'background: #7B5CF0; color: #fff;'
              : 'background: rgba(255,255,255,0.08); color: transparent;'}>✓</span>
          <span class="text-sm font-black tracking-widest uppercase"
            style="color: {on ? '#7B5CF0' : '#fff'};">{g.name}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded font-mono ml-auto"
            style="background: rgba(255,255,255,0.06); color: var(--ink-muted);">{g.kind}</span>
        </div>
        <p class="text-xs leading-relaxed" style="color: var(--ink-muted);">{g.hint}</p>
      </button>
    {/each}
  </div>

  {#if $play.games.length}
    <div class="rounded-2xl p-4 space-y-4"
      style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);">
      <div>
        <p class="text-xs font-bold uppercase tracking-widest mb-2" style="color: var(--ink-muted);">Difficulty</p>
        <div class="flex gap-2">
          {#each DIFFICULTIES as d}
            <button type="button"
              class="flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all duration-200"
              style={$play.difficulty === d.id
                ? 'background: rgba(123,92,240,0.15); border: 1px solid #7B5CF0; color: #fff;'
                : 'background: transparent; border: 1px solid rgba(255,255,255,0.1); color: var(--ink-muted);'}
              on:click={() => play.update(p => ({ ...p, difficulty: d.id }))}
            >
              {d.label}
              <span class="block font-normal mt-0.5" style="color: var(--ink-muted);">{d.desc}</span>
            </button>
          {/each}
        </div>
      </div>
      <div>
        <div class="flex justify-between text-xs mb-2">
          <span class="font-bold uppercase tracking-widest" style="color: var(--ink-muted);">Intensity</span>
          <span class="font-mono" style="color: #7B5CF0;">{$play.intensity.toFixed(2)}×</span>
        </div>
        <input type="range" min="0.4" max="1.4" step="0.05"
          class="w-full accent-[#7B5CF0]"
          value={$play.intensity}
          on:input={(e) => play.update(p => ({ ...p, intensity: +e.currentTarget.value }))} />
        <p class="text-xs mt-1" style="color: var(--ink-muted);">
          Particle and glow budget — turn it down for a calmer song.
        </p>
      </div>
    </div>
    <p class="text-xs" style="color: var(--ink-muted);">
      {$play.games.length} game{$play.games.length === 1 ? '' : 's'} will ship in this edition.
      Collectors get a <span style="color: #7B5CF0;">Games</span> tab; everything runs offline
      and recolors to your theme.
    </p>
  {:else}
    <p class="text-xs" style="color: var(--ink-muted);">
      No games selected — the package ships without a Games tab.
    </p>
  {/if}
</div>
