<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { createReleaseProject } from '#lib/domain/release.js';
  import { clearStudioDraft, loadStudioDraft, saveStudioDraft } from '#lib/utils/studio-draft.js';
  import { releaseProject, template, play, extras, rights, transcendence, draftableTranscendence } from '#lib/stores/package.js';
  import { currentStepIndex, currentSectionIndex, sectionCompletion, navigateToSection } from '#lib/stores/studio-nav.js';
  import StudioShell from '#lib/components/studio/StudioShell.svelte';
  import StepIdentity from '#lib/components/studio/StepIdentityNew.svelte';
  import StepAssets from '#lib/components/studio/StepAssetsNew.svelte';
  import StepLyrics from '#lib/components/studio/StepLyricsNew.svelte';
  import StepExtras from '#lib/components/studio/StepExtrasNew.svelte';
  import StepEdition from '#lib/components/studio/StepEditionNew.svelte';
  import StepRightsExport from '#lib/components/studio/StepRightsExportNew.svelte';

  export let data;

  let draftStatus = 'restoring';
  let draftSavedAt = '';
  let draftWarning = '';
  let saveTimer;
  let saveQueue = Promise.resolve();
  let subscriptions = [];
  let lastFileSignature = '';
  let StepExperience = null;
  let experienceLoadError = '';
  let importedDeal = null;

  // A countersigned BeatSunlimited split-sheet only fills empty rights fields;
  // it never replaces decisions the creator has already made.
  function importBeatsUnlimitedDeal() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('source') !== 'beatsunlimited' || !params.get('producer')) return;
    importedDeal = {
      title: params.get('title') || 'a licensed beat',
      producer: params.get('producer'),
      master: params.get('master'),
      pub: params.get('pub'),
      deal: params.get('deal'),
    };
    const creditLine = `Producer — ${importedDeal.producer} (master ${importedDeal.master ?? '?'}% / publishing ${importedDeal.pub ?? '?'}% via beatsunlimited split sheet${importedDeal.deal ? ` ${importedDeal.deal.slice(0, 8)}` : ''})`;
    rights.update((value) => ({
      ...value,
      producer: value.producer || importedDeal.producer,
      credits: value.credits ? (value.credits.includes(creditLine) ? value.credits : `${value.credits}\n${creditLine}`) : creditLine,
    }));
  }

  function snapshot() {
    return {
      project: get(releaseProject),
      template: get(template),
      play: get(play),
      extras: get(extras),
      transcendence: draftableTranscendence(get(transcendence)),
      currentStepIndex: get(currentStepIndex),
      currentSectionIndex: get(currentSectionIndex),
      sectionCompletion: get(sectionCompletion),
    };
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

  function persistDraft() {
    const userId = data?.user?.id;
    if (!userId) return Promise.resolve();
    draftStatus = 'saving';
    saveQueue = saveQueue.then(async () => {
      const result = await saveStudioDraft(userId, snapshot());
      draftSavedAt = result.savedAt;
      draftWarning = result.durableFiles ? '' : 'Your choices are saved, but uploaded files may need to be selected again.';
      draftStatus = 'saved';
    }).catch((error) => {
      draftStatus = 'error';
      draftWarning = error?.message || 'This browser could not save the Studio draft.';
    });
    return saveQueue;
  }

  function scheduleDraftSave() {
    if (draftStatus === 'restoring') return;
    clearTimeout(saveTimer);
    const nextSignature = fileSignature();
    if (nextSignature !== lastFileSignature) {
      lastFileSignature = nextSignature;
      void persistDraft();
      return;
    }
    draftStatus = 'saving';
    saveTimer = setTimeout(() => void persistDraft(), 650);
  }

  async function loadExperience() {
    if (StepExperience || experienceLoadError) return;
    try {
      StepExperience = (await import('#lib/components/StepExperience.svelte')).default;
    } catch (error) {
      console.error('[studio] experience editor failed to load:', error);
      experienceLoadError = 'The experience editor could not load. Refresh and try again.';
    }
  }

  function legacyStepIndex(value) {
    // Former Tracklist work now belongs to Assets.
    return [0, 0, 1, 1, 2, 3, 4, 5, 6][Math.max(1, Math.min(8, Number(value) || 1))];
  }

  function watchDraft() {
    return [releaseProject, template, play, extras, transcendence, currentStepIndex, currentSectionIndex, sectionCompletion]
      .map((store) => store.subscribe(scheduleDraftSave));
  }

  async function resetAfterPublish() {
    const userId = data?.user?.id;
    clearTimeout(saveTimer);
    subscriptions.forEach((unsubscribe) => unsubscribe());
    subscriptions = [];
    if (userId) await clearStudioDraft(userId);
    releaseProject.set(createReleaseProject({}));
    template.set('ultra-v2');
    play.set({ games: [], difficulty: 'standard', intensity: 1 });
    extras.set({ story: '', links: [], pdfs: [] });
    transcendence.set({ track_id: '', terrain: null, analysis: null, terrain_data: null, landmarks: [], art_direction: {}, arc_end_seconds: null, quality_preview: 'balanced' });
    sectionCompletion.set({});
    navigateToSection(0, 0);
    lastFileSignature = fileSignature();
    draftStatus = 'saved';
    draftSavedAt = '';
    draftWarning = '';
    subscriptions = watchDraft();
  }

  onMount(() => {
    let disposed = false;
    const saveBeforeLeaving = () => {
      clearTimeout(saveTimer);
      void persistDraft();
    };

    async function restore() {
      try {
        const restored = await loadStudioDraft(data?.user?.id);
        if (restored?.snapshot && !disposed) {
          const saved = restored.snapshot;
          releaseProject.set(createReleaseProject(saved.project || {}));
          template.set(saved.template || 'ultra-v2');
          play.set(saved.play || { games: [], difficulty: 'standard', intensity: 1 });
          extras.set(saved.extras || { story: '', links: [], pdfs: [] });
          transcendence.set({ track_id: '', landmarks: [], art_direction: {}, arc_end_seconds: null, quality_preview: 'balanced', ...(saved.transcendence || {}), terrain: null, analysis: null, terrain_data: null });
          sectionCompletion.set(saved.sectionCompletion || {});
          navigateToSection(
            Number.isInteger(saved.currentStepIndex) ? saved.currentStepIndex : legacyStepIndex(saved.currentStep),
            Number.isInteger(saved.currentSectionIndex) ? saved.currentSectionIndex : 0,
          );
          draftSavedAt = restored.saved_at;
          if (!restored.durableFiles) draftWarning = 'Your release details were restored, but uploaded files may need to be selected again.';
        }
      } catch (error) {
        draftWarning = error?.message || 'The previous Studio draft could not be restored.';
      }

      if (disposed) return;
      importBeatsUnlimitedDeal();
      draftStatus = 'saved';
      lastFileSignature = fileSignature();
      subscriptions = watchDraft();
      if (get(currentStepIndex) === 4) void loadExperience();
      window.addEventListener('pagehide', saveBeforeLeaving);
    }

    void restore();
    return () => {
      disposed = true;
      clearTimeout(saveTimer);
      subscriptions.forEach((unsubscribe) => unsubscribe());
      window.removeEventListener('pagehide', saveBeforeLeaving);
    };
  });

  $: if ($currentStepIndex === 4) void loadExperience();
</script>

<StudioShell {draftStatus} draftSavedAt={draftSavedAt} on:save-exit={persistDraft}>
  {#if importedDeal}
    <div class="deal-import">
      <span><strong>BeatSunlimited deal imported.</strong> Rights notes for “{importedDeal.title}” were added.</span>
      <button type="button" on:click={() => importedDeal = null}>Dismiss</button>
    </div>
  {/if}
  {#if draftWarning}
    <p class="draft-warning" role="status">{draftWarning}</p>
  {/if}

  {#if $currentStepIndex === 0}
    <StepIdentity />
  {:else if $currentStepIndex === 1}
    <StepAssets />
  {:else if $currentStepIndex === 2}
    <StepLyrics />
  {:else if $currentStepIndex === 3}
    <StepExtras />
  {:else if $currentStepIndex === 4}
    {#if StepExperience}
      <svelte:component this={StepExperience} />
    {:else if experienceLoadError}
      <p class="draft-warning">{experienceLoadError}</p>
    {:else}
      <p class="loading-editor">Loading experience editor…</p>
    {/if}
  {:else if $currentStepIndex === 5}
    <StepEdition />
  {:else if $currentStepIndex === 6}
    <StepRightsExport on:published={resetAfterPublish} />
  {/if}
</StudioShell>

<style>
  .deal-import {
    width: 100%;
    max-width: 800px;
    margin: 0 auto 24px;
    padding: 11px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border: 1px solid rgba(123, 92, 240, 0.28);
    border-radius: 10px;
    background: rgba(123, 92, 240, 0.08);
    color: var(--ink-secondary);
    font-size: 0.78rem;
  }

  .deal-import strong { color: #fff; }
  .deal-import button { border: 0; background: none; color: #a991ff; cursor: pointer; font: inherit; }

  .draft-warning {
    width: 100%;
    max-width: 620px;
    margin: 0 auto 24px;
    padding: 12px 14px;
    border: 1px solid rgba(240, 201, 138, 0.28);
    border-radius: 10px;
    background: rgba(240, 201, 138, 0.08);
    color: #f0c98a;
    font-size: 0.78rem;
    line-height: 1.45;
  }

  .loading-editor {
    color: var(--ink-muted);
    font-size: 0.9rem;
  }
</style>
