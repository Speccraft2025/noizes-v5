<script>
  import { template } from '$lib/stores/package.js';

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  const themes = [
    {
      id: 'ultra',
      name: 'ULTRA',
      tag: 'v2',
      desc: 'Play + time-synced lyrics. Clean, immersive.',
      primary: '#7B5CF0',
      accent:  '#F04BD8',
      bg:      '#030303',
    },
    {
      id: 'codex',
      name: 'CODEX',
      tag: 'theme',
      desc: 'Deep blue archival tone. Scholarly, minimal.',
      primary: '#4B6BF0',
      accent:  '#6BE0F0',
      bg:      '#030608',
    },
    {
      id: 'transmission',
      name: 'TRANSMISSION',
      tag: 'theme',
      desc: 'Warm amber broadcast. Raw, urgent energy.',
      primary: '#F0A84B',
      accent:  '#F04B6B',
      bg:      '#060300',
    },
    {
      id: 'monument',
      name: 'MONUMENT',
      tag: 'theme',
      desc: 'Gold on dark. Timeless, ceremonial weight.',
      primary: '#C8A96E',
      accent:  '#E8C88E',
      bg:      '#050403',
    },
  ];
</script>

<div class="space-y-5">
  <div>
    <p class="t-caption mb-2">Step 4</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Theme</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">
      Choose the visual identity for your .nz package.
    </p>
  </div>

  <div class="space-y-3">
    {#each themes as t}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <button
        type="button"
        class="w-full text-left rounded-2xl p-4 transition-all duration-200"
        style={$template === t.id
          ? `background: rgba(${hexToRgb(t.primary)},0.12); border: 1.5px solid ${t.primary};`
          : 'background: rgba(255,255,255,0.03); border: 1.5px solid rgba(255,255,255,0.07);'}
        on:click={() => template.set(t.id)}
      >
        <div class="flex items-center gap-4">
          <!-- Colour swatch -->
          <div class="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center text-xs font-black"
            style="background: {t.bg}; border: 1.5px solid {t.primary}; color: {t.primary};">
            <div class="flex gap-0.5">
              <div class="w-2 h-8 rounded-sm" style="background: {t.primary};"></div>
              <div class="w-2 h-5 rounded-sm self-end" style="background: {t.accent}; opacity: 0.7;"></div>
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-sm font-black tracking-widest" style="color: {$template === t.id ? t.primary : '#fff'};">{t.name}</span>
              <span class="text-xs px-1.5 py-0.5 rounded font-mono" style="background: rgba(255,255,255,0.06); color: var(--ink-muted);">{t.tag}</span>
            </div>
            <p class="text-xs leading-relaxed" style="color: var(--ink-muted);">{t.desc}</p>
          </div>

          <!-- Checkmark -->
          <div class="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
            style={$template === t.id
              ? `background: ${t.primary}; color: #fff;`
              : 'background: rgba(255,255,255,0.06); color: transparent;'}>
            <span class="text-xs">✓</span>
          </div>
        </div>
      </button>
    {/each}
  </div>
</div>

