<script>
  import { identity, edition, assets, rights, manifest } from '$lib/stores/package.js';
  import { buildExperienceHTML } from '$lib/utils/experience.js';
  import StepIdentity from '$lib/components/StepIdentity.svelte';
  import StepAssets from '$lib/components/StepAssets.svelte';
  import StepEdition from '$lib/components/StepEdition.svelte';
  import StepRights from '$lib/components/StepRights.svelte';
  import StepExport from '$lib/components/StepExport.svelte';

  const steps = [
    { id: 1, label: 'Identity', icon: '◈' },
    { id: 2, label: 'Assets', icon: '◉' },
    { id: 3, label: 'Edition', icon: '⬡' },
    { id: 4, label: 'Rights', icon: '◎' },
    { id: 5, label: 'Forge', icon: '⬟' },
  ];

  let currentStep = 1;
  let previewMode = 'manifest';

  $: manifestJSON = JSON.stringify($manifest, null, 2);
  $: experienceHTML = buildExperienceHTML({
    identity: $identity,
    edition: $edition,
    rights: $rights,
    audioName: $assets.audioName,
    coverBase64: '',
    coverMime: ''
  });
  $: iframeSrc = `data:text/html;charset=utf-8,${encodeURIComponent(experienceHTML)}`;
</script>

<div class="flex min-h-[calc(100vh-56px)]">
  <!-- Left step rail -->
  <aside class="w-52 shrink-0 border-r hidden lg:flex flex-col pt-8 pb-6 px-4" style="background: rgba(5,5,5,0.6); border-color: var(--border-dim);">
    <p class="t-caption mb-6 px-2">Package Builder</p>
    <nav class="space-y-1 flex-1">
      {#each steps as step}
        <button
          type="button"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 text-left"
          style={currentStep === step.id
            ? 'background: rgba(123,92,240,0.15); color: #fff; border: 1px solid rgba(123,92,240,0.25);'
            : 'color: var(--ink-tertiary); border: 1px solid transparent;'}
          on:click={() => currentStep = step.id}
        >
          <span
            class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
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
        <span>{Math.round((currentStep - 1) / 4 * 100)}%</span>
      </div>
      <div class="h-0.5 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.06);">
        <div
          class="h-full rounded-full transition-all duration-500"
          style="width: {Math.round((currentStep - 1) / 4 * 100)}%; background: var(--gradient-spectral);"
        ></div>
      </div>
    </div>
  </aside>

  <!-- Center form -->
  <div class="flex-1 min-w-0 flex flex-col">
    <!-- Mobile step tabs -->
    <div class="flex border-b lg:hidden" style="border-color: var(--border-dim); background: rgba(5,5,5,0.6);">
      {#each steps as step}
        <button
          type="button"
          class="flex-1 py-3 text-xs font-bold transition-all duration-200 border-b-2"
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
        <StepEdition />
      {:else if currentStep === 4}
        <StepRights />
      {:else}
        <StepExport />
      {/if}
    </div>

    <!-- Nav -->
    <div class="px-8 py-5 border-t flex justify-between items-center" style="border-color: var(--border-dim);">
      <button
        class="btn-ghost"
        disabled={currentStep === 1}
        on:click={() => currentStep--}
        style={currentStep === 1 ? 'opacity: 0.3; cursor: not-allowed;' : ''}
      >← Back</button>
      {#if currentStep < 5}
        <button class="btn-spectral" on:click={() => currentStep++}>
          Continue →
        </button>
      {/if}
    </div>
  </div>

  <!-- Right sidebar preview -->
  <div class="w-80 shrink-0 border-l hidden lg:flex flex-col" style="border-color: var(--border-dim); background: rgba(5,5,5,0.4);">
    <div class="flex border-b" style="border-color: var(--border-dim);">
      <button
        class="flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-200 border-b-2 -mb-px"
        style={previewMode === 'manifest'
          ? 'border-color: #7B5CF0; color: #fff;'
          : 'border-color: transparent; color: var(--ink-muted);'}
        on:click={() => previewMode = 'manifest'}
      >manifest.json</button>
      <button
        class="flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-200 border-b-2 -mb-px"
        style={previewMode === 'preview'
          ? 'border-color: #7B5CF0; color: #fff;'
          : 'border-color: transparent; color: var(--ink-muted);'}
        on:click={() => previewMode = 'preview'}
      >experience</button>
    </div>

    <div class="flex-1 overflow-hidden">
      {#if previewMode === 'manifest'}
        <div class="p-4 overflow-auto h-full" style="background: #030303;">
          <pre class="font-mono text-xs leading-relaxed whitespace-pre-wrap" style="color: rgba(139,92,246,0.9);">{manifestJSON}</pre>
        </div>
      {:else}
        <iframe
          title="experience.html preview"
          src={iframeSrc}
          sandbox="allow-scripts"
          class="w-full h-full border-0"
        ></iframe>
      {/if}
    </div>
  </div>
</div>
