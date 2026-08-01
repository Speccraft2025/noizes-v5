<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { identity, edition, assets, rights, releaseProject, template, play, extras } from '$lib/stores/package.js';
  import { createReleaseProject } from '$lib/domain/release.js';
  import { loadStudioDraft, saveStudioDraft } from '$lib/utils/studio-draft.js';
  import StepIdentity    from '$lib/components/StepIdentity.svelte';
  import StepTracklist   from '$lib/components/StepTracklist.svelte';
  import StepAssets      from '$lib/components/StepAssets.svelte';
  import StepLyrics      from '$lib/components/StepLyrics.svelte';
  import StepGuide       from '$lib/components/StepGuide.svelte';
  import StepExtras      from '$lib/components/StepExtras.svelte';
  import StepEdition     from '$lib/components/StepEdition.svelte';
  import StepRights      from '$lib/components/StepRights.svelte';
  import StepExport      from '$lib/components/StepExport.svelte';

  export let data;

  const steps = [
    { id: 1, label: 'Identity', icon: '◈' },
    { id: 2, label: 'Tracklist', icon: '☷' },
    { id: 3, label: 'Assets',   icon: '◉' },
    { id: 4, label: 'Lyrics',   icon: '≡' },
    { id: 5, label: 'Extras',     icon: '▦' },
    { id: 6, label: 'Experience', icon: '⬡' },
    { id: 7, label: 'Edition',    icon: '◎' },
    { id: 8, label: 'Publish',    icon: '⬟' },
  ];

  let currentStep = 1;
  let draftStatus = 'restoring';
  let draftSavedAt = '';
  let draftRestored = false;
  let draftWarning = '';
  let saveTimer;
  let saveQueue = Promise.resolve();
  let draftSubscriptions = [];
  let lastFileSignature = '';

  // Handoff from beatsunlimited: a countersigned split-sheet deal arrives as
  // ?source=beatsunlimited&deal=<token>&title=&producer=&master=&pub=.
  // Purely additive — only prefills empty Rights fields, never overwrites.
  let importedDeal = null;

  function importBeatsUnlimitedDeal() {
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
  }

  function draftSnapshot() {
    return {
      project: get(releaseProject),
      template: get(template),
      play: get(play),
      extras: get(extras),
      currentStep,
    };
  }

  function persistDraft() {
    const userId = data?.user?.id;
    if (!userId) return Promise.resolve();
    draftStatus = 'saving';
    saveQueue = saveQueue.then(async () => {
      const result = await saveStudioDraft(userId, draftSnapshot());
      draftSavedAt = result.savedAt;
      draftWarning = result.durableFiles ? '' : 'File bytes could not be stored; metadata is safe but uploads may need reselecting.';
      draftStatus = 'saved';
    }).catch((error) => {
      draftStatus = 'error';
      draftWarning = error?.message || 'This browser could not save the Studio draft.';
    });
    return saveQueue;
  }

  function fileSignature() {
    const project = get(releaseProject);
    const files = [
      ...project.audio_assets,
      ...project.release_assets,
      ...project.track_assets,
      ...(get(extras).pdfs || []),
    ];
    return files.map((asset) => {
      const file = asset.file;
      return [asset.asset_id || asset.id || '', file?.name || '', file?.size || 0, file?.lastModified || 0].join(':');
    }).join('|');
  }

  function scheduleDraftSave() {
    if (draftStatus === 'restoring') return;
    clearTimeout(saveTimer);
    const nextFileSignature = fileSignature();
    if (nextFileSignature !== lastFileSignature) {
      lastFileSignature = nextFileSignature;
      void persistDraft();
      return;
    }
    draftStatus = 'saving';
    saveTimer = setTimeout(() => void persistDraft(), 650);
  }

  function goToStep(step) {
    currentStep = Math.max(1, Math.min(steps.length, Number(step) || 1));
    scheduleDraftSave();
  }

  function savedTime(value) {
    if (!value) return '';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  onMount(() => {
    let disposed = false;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(saveTimer);
        void persistDraft();
      }
    };
    const onPageHide = () => {
      clearTimeout(saveTimer);
      void persistDraft();
    };

    async function initializeDraft() {
      try {
        const restored = await loadStudioDraft(data?.user?.id);
        if (restored?.snapshot && !disposed) {
          const snapshot = restored.snapshot;
          releaseProject.set(createReleaseProject(snapshot.project || {}));
          template.set(snapshot.template || 'ultra-v2');
          play.set(snapshot.play || { games: [], difficulty: 'standard', intensity: 1 });
          extras.set(snapshot.extras || { story: '', links: [], pdfs: [] });
          currentStep = Math.max(1, Math.min(steps.length, Number(snapshot.currentStep) || 1));
          draftSavedAt = restored.saved_at;
          draftRestored = true;
          if (!restored.durableFiles) draftWarning = 'Draft metadata was restored; uploaded files may need to be selected again.';
        }
      } catch (error) {
        draftWarning = error?.message || 'The previous Studio draft could not be restored.';
      }

      if (disposed) return;
      importBeatsUnlimitedDeal();
      draftStatus = 'saved';
      lastFileSignature = fileSignature();
      draftSubscriptions = [releaseProject, template, play, extras].map((store) => store.subscribe(() => scheduleDraftSave()));
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('pagehide', onPageHide);
    }

    void initializeDraft();
    return () => {
      disposed = true;
      clearTimeout(saveTimer);
      draftSubscriptions.forEach((unsubscribe) => unsubscribe());
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
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
          on:click={() => goToStep(step.id)}
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
      <div class="mt-3 text-[10px] font-mono leading-relaxed" style="color:{draftStatus === 'error' ? '#F08A9D' : 'var(--ink-muted)'};">
        {#if draftStatus === 'restoring'}Restoring draft…
        {:else if draftStatus === 'saving'}Saving draft…
        {:else if draftStatus === 'error'}Draft not saved
        {:else}✓ Saved {savedTime(draftSavedAt)}{/if}
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
          on:click={() => goToStep(step.id)}
        >{step.label}</button>
      {/each}
    </div>

    <div class="flex-1 px-8 py-8 max-w-3xl">
      {#if draftRestored || draftWarning}
        <div class="mb-6 rounded-xl px-4 py-3 flex items-start gap-3 text-xs"
          style="background:rgba(123,92,240,.08);border:1px solid rgba(123,92,240,.2);color:var(--ink-secondary);">
          <span style="color:#7B5CF0;">✓</span>
          <span>
            {#if draftRestored}<strong class="text-white">Draft restored.</strong> Continue from where you left off.{/if}
            {#if draftWarning}<span class="block mt-1" style="color:#F0C98A;">{draftWarning}</span>{/if}
          </span>
        </div>
      {/if}
      {#if currentStep === 1}
        <StepIdentity />
      {:else if currentStep === 2}
        <StepTracklist />
      {:else if currentStep === 3}
        <StepAssets />
      {:else if currentStep === 4}
        <StepLyrics />
      {:else if currentStep === 5}
        <StepExtras />
      {:else if currentStep === 6}
        <StepGuide />
      {:else if currentStep === 7}
        <StepEdition />
      {:else if currentStep === 8}
        <div class="space-y-8"><StepRights /><div class="border-t pt-8" style="border-color: var(--border-dim);"><StepExport /></div></div>
      {/if}
    </div>

    <!-- Nav -->
    <div class="px-8 py-5 border-t flex justify-between items-center" style="border-color: var(--border-dim);">
      <button class="btn-ghost" disabled={currentStep === 1}
        style={currentStep === 1 ? 'opacity: 0.3; cursor: not-allowed;' : ''}
        on:click={() => goToStep(currentStep - 1)}>← Back</button>
      {#if currentStep < steps.length}
        <button class="btn-spectral" on:click={() => goToStep(currentStep + 1)}>Continue →</button>
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
          <span style="color: var(--ink-muted);">Format</span>
          <span class="text-white truncate ml-4 text-right">{$releaseProject.release.release_type.replaceAll('_', ' ')}</span>
        </div>
        <div class="flex justify-between">
          <span style="color: var(--ink-muted);">Tracklist</span>
          <span class="text-white">{$releaseProject.tracks.length} track{$releaseProject.tracks.length === 1 ? '' : 's'}</span>
        </div>
        <div class="flex justify-between">
          <span style="color: var(--ink-muted);">Experience</span>
          <span class="truncate ml-4" style="color: #7B5CF0;">ULTRA V2 · {$assets.guide?.nodes?.length ?? 0} moments</span>
        </div>
        <div class="flex justify-between">
          <span style="color: var(--ink-muted);">Audio</span>
          <span class="text-white truncate ml-4 text-right">{$releaseProject.audio_assets.length} asset{$releaseProject.audio_assets.length === 1 ? '' : 's'}</span>
        </div>
        <div class="flex justify-between">
          <span style="color: var(--ink-muted);">Lyrics</span>
          <span class="text-white">{$releaseProject.lyrics.reduce((total, entry) => total + (entry.timed_lines?.length || 0), 0)} lines</span>
        </div>
        <div class="flex justify-between">
          <span style="color: var(--ink-muted);">Extras</span>
          <span class="text-white">{$play.games.length + ($extras.story ? 1 : 0) + $extras.links.length + $extras.pdfs.length}</span>
        </div>
        <div class="flex justify-between">
          <span style="color: var(--ink-muted);">Edition</span>
          <span class="text-white truncate ml-4 text-right">{$edition.edition_name || '—'}</span>
        </div>
      </div>
    </div>

    <!-- Colour preview for selected theme -->
    <div class="flex-1 flex flex-col items-center justify-center p-6 gap-4">
      {#if $template === 'ultra-v2'}
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
        <p class="text-xs text-center" style="color: var(--ink-muted);">ULTRA V2 · canonical immersive experience</p>
      {/if}
    </div>
  </div>
</div>
