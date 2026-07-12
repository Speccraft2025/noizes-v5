<script>
  import { onMount } from 'svelte';
  import { identity, edition, assets, rights, template } from '$lib/stores/package.js';
  import StepIdentity    from '$lib/components/StepIdentity.svelte';
  import StepAssets      from '$lib/components/StepAssets.svelte';
  import StepLyrics      from '$lib/components/StepLyrics.svelte';
  import StepTheme       from '$lib/components/StepTheme.svelte';
  import StepEdition     from '$lib/components/StepEdition.svelte';
  import StepRights      from '$lib/components/StepRights.svelte';
  import StepExport      from '$lib/components/StepExport.svelte';

  const steps = [
    { id: 1, label: 'Identity', icon: '◈' },
    { id: 2, label: 'Assets',   icon: '◉' },
    { id: 3, label: 'Lyrics',   icon: '≡' },
    { id: 4, label: 'Theme',    icon: '⬡' },
    { id: 5, label: 'Edition',  icon: '◎' },
    { id: 6, label: 'Rights',   icon: '◈' },
    { id: 7, label: 'Compile',    icon: '⬟' },
  ];

  let currentStep = 1;

  // Handoff from beatsunlimited: a countersigned split-sheet deal arrives as
  // ?source=beatsunlimited&deal=<token>&title=&producer=&master=&pub=.
  // Purely additive — only prefills empty Rights fields, never overwrites.
  let importedDeal = null;

  onMount(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('source') !== 'beatsunlimited' || !p.get('producer')) return;
    importedDeal = {
      title: p.get('title') || 'a licensed beat',
      producer: p.get('producer'),
      master: p.get('master'),
      pub: p.get('pub'),
      deal: p.get('deal')
    };
    const creditLine =
      `Producer — ${importedDeal.producer} (master ${importedDeal.master ?? '?'}% / ` +
      `publishing ${importedDeal.pub ?? '?'}% via beatsunlimited split sheet` +
      `${importedDeal.deal ? ' ' + importedDeal.deal.slice(0, 8) : ''})`;
    rights.update((v) => ({
      ...v,
      producer: v.producer || importedDeal.producer,
      credits: v.credits
        ? (v.credits.includes(creditLine) ? v.credits : v.credits + '\n' + creditLine)
        : creditLine
    }));
  });
</script>

{#if importedDeal}
  <div class="px-6 py-3 text-sm flex items-center gap-3 border-b"
    style="background: rgba(255,90,31,0.08); border-color: rgba(255,90,31,0.25); color: #ffb599;">
    <span class="font-black" style="color: #ff5a1f;">beatsunlimited</span>
    <span>
      Deal imported — "{importedDeal.title}" by {importedDeal.producer}.
      Split terms were added to the Rights step.
    </span>
    <button type="button" class="ml-auto text-xs font-bold" style="color: var(--ink-muted);"
      on:click={() => importedDeal = null}>Dismiss</button>
  </div>
{/if}

<div class="flex min-h-[calc(100vh-56px)]">
  <!-- Left step rail -->
  <aside class="w-52 shrink-0 border-r hidden lg:flex flex-col pt-8 pb-6 px-4"
    style="background: rgba(5,5,5,0.6); border-color: var(--border-dim);">
    <p class="t-caption mb-6 px-2">Package Builder</p>
    <nav class="space-y-1 flex-1">
      {#each steps as step}
        <button type="button"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 text-left"
          style={currentStep === step.id
            ? 'background: rgba(123,92,240,0.15); color: #fff; border: 1px solid rgba(123,92,240,0.25);'
            : 'color: var(--ink-tertiary); border: 1px solid transparent;'}
          on:click={() => currentStep = step.id}
        >
          <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
            style={currentStep === step.id
              ? 'background: var(--gradient-spectral); color: #fff;'
              : currentStep > step.id
                ? 'background: rgba(123,92,240,0.2); color: #7B5CF0;'
                : 'background: rgba(255,255,255,0.06); color: var(--ink-muted);'}
          >{currentStep > step.id ? '✓' : step.id}</span>
          {step.label}
        </button>
      {/each}
    </nav>

    <!-- Progress -->
    <div class="px-2 mt-4">
      <div class="flex justify-between text-xs font-mono mb-2" style="color: var(--ink-muted);">
        <span>Progress</span>
        <span>{Math.round((currentStep - 1) / (steps.length - 1) * 100)}%</span>
      </div>
      <div class="h-0.5 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.06);">
        <div class="h-full rounded-full transition-all duration-500"
          style="width: {Math.round((currentStep - 1) / (steps.length - 1) * 100)}%; background: var(--gradient-spectral);">
        </div>
      </div>
    </div>
  </aside>

  <!-- Center form -->
  <div class="flex-1 min-w-0 flex flex-col">
    <!-- Mobile step tabs -->
    <div class="flex border-b overflow-x-auto lg:hidden" style="border-color: var(--border-dim); background: rgba(5,5,5,0.6);">
      {#each steps as step}
        <button type="button"
          class="shrink-0 px-3 py-3 text-xs font-bold transition-all duration-200 border-b-2"
          style={currentStep === step.id
            ? 'border-color: #7B5CF0; color: #fff;'
            : 'border-color: transparent; color: var(--ink-muted);'}
          on:click={() => currentStep = step.id}
        >{step.label}</button>
      {/each}
    </div>

    <div class="flex-1 px-8 py-8 max-w-xl">
      {#if currentStep === 1}
        <StepIdentity />
      {:else if currentStep === 2}
        <StepAssets />
      {:else if currentStep === 3}
        <StepLyrics />
      {:else if currentStep === 4}
        <StepTheme />
      {:else if currentStep === 5}
        <StepEdition />
      {:else if currentStep === 6}
        <StepRights />
      {:else}
        <StepExport />
      {/if}
    </div>

    <!-- Nav -->
    <div class="px-8 py-5 border-t flex justify-between items-center" style="border-color: var(--border-dim);">
      <button class="btn-ghost" disabled={currentStep === 1}
        style={currentStep === 1 ? 'opacity: 0.3; cursor: not-allowed;' : ''}
        on:click={() => currentStep--}>← Back</button>
      {#if currentStep < steps.length}
        <button class="btn-spectral" on:click={() => currentStep++}>Continue →</button>
      {/if}
    </div>
  </div>

  <!-- Right sidebar — theme preview swatch + summary -->
  <div class="w-72 shrink-0 border-l hidden lg:flex flex-col" style="border-color: var(--border-dim); background: rgba(5,5,5,0.4);">
    <div class="p-5 border-b" style="border-color: var(--border-dim);">
      <p class="t-caption mb-3">Package Summary</p>
      <div class="space-y-2 text-xs font-mono">
        <div class="flex justify-between">
          <span style="color: var(--ink-muted);">Artist</span>
          <span class="text-white truncate ml-4 text-right">{$identity.artist || '—'}</span>
        </div>
        <div class="flex justify-between">
          <span style="color: var(--ink-muted);">Title</span>
          <span class="text-white truncate ml-4 text-right">{$identity.title || '—'}</span>
        </div>
        <div class="flex justify-between">
          <span style="color: var(--ink-muted);">Template</span>
          <span class="truncate ml-4" style="color: #7B5CF0;">{$template}</span>
        </div>
        <div class="flex justify-between">
          <span style="color: var(--ink-muted);">Audio</span>
          <span class="text-white truncate ml-4 text-right">{$assets.audioName || '—'}</span>
        </div>
        <div class="flex justify-between">
          <span style="color: var(--ink-muted);">Lyrics</span>
          <span class="text-white">{$assets.lyrics?.length ?? 0} lines</span>
        </div>
        <div class="flex justify-between">
          <span style="color: var(--ink-muted);">Edition</span>
          <span class="text-white truncate ml-4 text-right">{$edition.edition_type || '—'}</span>
        </div>
      </div>
    </div>

    <!-- Colour preview for selected theme -->
    <div class="flex-1 flex flex-col items-center justify-center p-6 gap-4">
      {#if $template === 'ultra'}
        <div class="w-full rounded-2xl overflow-hidden" style="background: #030303; border: 1px solid rgba(123,92,240,0.3); aspect-ratio: 9/16; max-height: 300px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; padding: 20px;">
          <div class="w-12 h-12 rounded-xl mb-3" style="background: rgba(123,92,240,0.2); border: 1px solid rgba(123,92,240,0.4);"></div>
          <div class="h-2 rounded w-20 mb-2" style="background: #7B5CF0; opacity:0.8;"></div>
          <div class="h-1.5 rounded w-28 mb-4" style="background: rgba(255,255,255,0.2);"></div>
          <div class="w-full h-10 rounded-xl" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);"></div>
          <div class="flex gap-8 mt-4">
            <div class="h-1 w-5 rounded" style="background: #7B5CF0;"></div>
            <div class="h-1 w-5 rounded" style="background: rgba(255,255,255,0.2);"></div>
          </div>
        </div>
        <p class="text-xs text-center" style="color: var(--ink-muted);">ULTRA v2 — violet / pink</p>
      {:else if $template === 'codex'}
        <div class="w-full rounded-2xl overflow-hidden" style="background: #030608; border: 1px solid rgba(75,107,240,0.3); aspect-ratio: 9/16; max-height: 300px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; padding: 20px;">
          <div class="w-12 h-12 rounded-xl mb-3" style="background: rgba(75,107,240,0.2); border: 1px solid rgba(75,107,240,0.4);"></div>
          <div class="h-2 rounded w-20 mb-2" style="background: #4B6BF0; opacity:0.8;"></div>
          <div class="h-1.5 rounded w-28 mb-4" style="background: rgba(255,255,255,0.2);"></div>
          <div class="w-full h-10 rounded-xl" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(75,107,240,0.2);"></div>
        </div>
        <p class="text-xs text-center" style="color: var(--ink-muted);">CODEX — cobalt / cyan</p>
      {:else if $template === 'transmission'}
        <div class="w-full rounded-2xl overflow-hidden" style="background: #060300; border: 1px solid rgba(240,168,75,0.3); aspect-ratio: 9/16; max-height: 300px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; padding: 20px;">
          <div class="w-12 h-12 rounded-xl mb-3" style="background: rgba(240,168,75,0.15); border: 1px solid rgba(240,168,75,0.4);"></div>
          <div class="h-2 rounded w-20 mb-2" style="background: #F0A84B; opacity:0.8;"></div>
          <div class="h-1.5 rounded w-28 mb-4" style="background: rgba(255,255,255,0.2);"></div>
          <div class="w-full h-10 rounded-xl" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(240,168,75,0.2);"></div>
        </div>
        <p class="text-xs text-center" style="color: var(--ink-muted);">TRANSMISSION — amber / red</p>
      {:else}
        <div class="w-full rounded-2xl overflow-hidden" style="background: #050403; border: 1px solid rgba(200,169,110,0.3); aspect-ratio: 9/16; max-height: 300px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; padding: 20px;">
          <div class="w-12 h-12 rounded-xl mb-3" style="background: rgba(200,169,110,0.15); border: 1px solid rgba(200,169,110,0.4);"></div>
          <div class="h-2 rounded w-20 mb-2" style="background: #C8A96E; opacity:0.8;"></div>
          <div class="h-1.5 rounded w-28 mb-4" style="background: rgba(255,255,255,0.2);"></div>
          <div class="w-full h-10 rounded-xl" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(200,169,110,0.2);"></div>
        </div>
        <p class="text-xs text-center" style="color: var(--ink-muted);">MONUMENT — gold / warmth</p>
      {/if}
    </div>
  </div>
</div>
