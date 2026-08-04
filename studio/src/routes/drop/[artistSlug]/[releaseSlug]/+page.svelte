<script>
  import { goto } from '$app/navigation';
  import { page as pageStore } from '$app/stores';

  import DropHero from '$lib/components/drop/DropHero.svelte';
  import DropContents from '$lib/components/drop/DropContents.svelte';
  import DropExperiencePreview from '$lib/components/drop/DropExperiencePreview.svelte';
  import DropEditionInfo from '$lib/components/drop/DropEditionInfo.svelte';
  import DropAuthenticity from '$lib/components/drop/DropAuthenticity.svelte';
  import DropProvenance from '$lib/components/drop/DropProvenance.svelte';
  import DropSharePanel from '$lib/components/drop/DropSharePanel.svelte';
  import DropCreatorLinks from '$lib/components/drop/DropCreatorLinks.svelte';
  import DropCreatorControls from '$lib/components/drop/DropCreatorControls.svelte';
  import DropAnalyticsTracker from '$lib/components/drop/DropAnalyticsTracker.svelte';

  export let data;

  $: release = data.release;
  $: base = `/drop/${release.artist_slug}/${release.slug}`;
  $: experienceAvailable = Boolean(data.package && release.nz_path);

  let tracker;
  let busy = false;
  let message = '';
  let creatorBusy = false;
  let creatorMessage = '';

  function track(event) {
    tracker?.track(event);
  }

  async function acquire() {
    if (!data.user) {
      return goto(`/auth/login?next=${encodeURIComponent(base)}`);
    }
    busy = true;
    message = '';
    track('acquire_start');
    try {
      const res = await fetch('/exchange/acquire', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ release_id: release.id }),
      });
      if (res.status === 409) {
        message = 'The last copy went while you were reading. Nothing was charged.';
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        message = body.message || 'Checkout could not be started. Nothing was charged — try again.';
        return;
      }
      const { authorization_url } = await res.json();
      window.location.href = authorization_url;
    } catch {
      message = 'Checkout could not be started. Nothing was charged — try again.';
    } finally {
      busy = false;
    }
  }

  async function download() {
    busy = true;
    message = '';
    try {
      const res = await fetch(`${base}/download`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        message = body.message || 'This package is not available to download from here.';
        return;
      }
      track('download');
      window.location.href = body.url;
    } catch {
      message = 'The download could not be started just now.';
    } finally {
      busy = false;
    }
  }

  function openExperience(anchor = '') {
    track('experience_open');
    const suffix = anchor ? `#${anchor}` : '';
    goto(`/experience/${release.artist_slug}/${release.slug}${suffix}`);
  }

  function onAction(event) {
    const action = event.detail;
    if (action === 'acquire') return acquire();
    if (action === 'download') return download();
    if (action === 'experience') return openExperience();
    if (action === 'offer') return goto('/exchange#secondary-market-heading');
    if (action === 'manage') return goto('/studio');
  }

  async function saveCreatorChanges(event) {
    creatorBusy = true;
    creatorMessage = '';
    try {
      const res = await fetch(`${base}/manage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'update', ...event.detail }),
      });
      const body = await res.json().catch(() => ({}));
      creatorMessage = res.ok ? 'Saved.' : (body.message || 'Could not save those changes.');
      if (res.ok) location.reload();
    } catch {
      creatorMessage = 'Could not save those changes.';
    } finally {
      creatorBusy = false;
    }
  }

  async function saveLinks(event) {
    creatorBusy = true;
    creatorMessage = '';
    try {
      const res = await fetch(`${base}/manage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'links', links: event.detail }),
      });
      const body = await res.json().catch(() => ({}));
      creatorMessage = res.ok ? 'Links saved.' : (body.message || 'Could not save those links.');
      if (res.ok) location.reload();
    } catch {
      creatorMessage = 'Could not save those links.';
    } finally {
      creatorBusy = false;
    }
  }

  async function setPublication(action) {
    creatorBusy = true;
    creatorMessage = '';
    try {
      const res = await fetch(`${base}/manage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      creatorMessage = res.ok ? 'Done.' : (body.message || 'Could not change publication state.');
      if (res.ok) location.reload();
    } catch {
      creatorMessage = 'Could not change publication state.';
    } finally {
      creatorBusy = false;
    }
  }
</script>

<svelte:head>
  <title>{data.meta.title}</title>
  <meta name="description" content={data.meta.description} />
  <link rel="canonical" href={data.meta.canonical} />
  {#each data.meta.tags as tag}
    {#if tag.property}
      <meta property={tag.property} content={tag.content} />
    {:else}
      <meta name={tag.name} content={tag.content} />
    {/if}
  {/each}
  {#if release.visibility !== 'public' || release.status !== 'published'}
    <meta name="robots" content="noindex" />
  {/if}
</svelte:head>

<DropAnalyticsTracker bind:this={tracker} releaseId={release.id} />

<div class="min-h-screen" style="background: var(--bg-deep);">
  <!-- Minimal header. A shared link should open onto the object, not onto a
       product navigation bar. -->
  <header
    class="sticky top-0 z-40 border-b"
    style="background: rgba(3,3,3,0.9); backdrop-filter: blur(20px); border-color: var(--border-dim);"
  >
    <div class="max-w-6xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0">
        <a href="/" class="shrink-0"><img src="/logo-wordmark.png" alt="Noizes" class="h-7 w-auto" /></a>
        <span class="hidden sm:inline text-[10px] font-bold tracking-[0.2em] uppercase" style="color: var(--ink-muted);">
          Drop Page
        </span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <a class="btn-ghost rounded-full px-4 py-1.5 text-xs hidden sm:inline-flex" href="/exchange">← Exchange</a>
        <a class="btn-ghost rounded-full px-4 py-1.5 text-xs" href="#drop-share-heading">Share</a>
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-5 md:px-8 py-10 md:py-16 space-y-16 md:space-y-20">
    {#if data.isCreator}
      <DropCreatorControls
        {release}
        analytics={data.analytics}
        links={data.links}
        busy={creatorBusy}
        message={creatorMessage}
        on:save={saveCreatorChanges}
        on:links={saveLinks}
        on:withdraw={() => setPublication('withdraw')}
        on:republish={() => setPublication('republish')}
      />
    {/if}

    <DropHero
      {release}
      availability={data.availability}
      trust={data.trust}
      {busy}
      {message}
      on:action={onAction}
    />

    <DropContents contents={data.contents} packageSize={data.package?.file_size || release.package_size} />

    <DropExperiencePreview
      sections={data.sections}
      available={experienceAvailable}
      on:open={(event) => openExperience(event.detail)}
    />

    <DropEditionInfo {release} packageRecord={data.package} />

    <DropAuthenticity
      authenticity={data.authenticity}
      packageRecord={data.package}
      {release}
      certificateHref={`${base}/certificate`}
      manifestHref={`${base}/manifest`}
    />

    <DropProvenance
      timeline={data.timeline}
      transfers={data.transfers}
      historyHref={`/provenance/${release.id}/0`}
    />

    <DropSharePanel share={data.share} title={release.title} on:shared={() => track('share')} />

    <DropCreatorLinks links={data.links} />

    <footer class="pt-8 border-t text-xs leading-relaxed" style="border-color: var(--border-dim); color: var(--ink-muted);">
      <p class="max-w-prose">
        This page presents a Noizes release. The .nz package itself is independent of it: once downloaded it opens
        offline, needs no account, and does not call home. If this page disappears, the object does not.
      </p>
      <p class="mt-3 tracking-[0.16em] uppercase font-semibold">Format first · Ecosystem second</p>
    </footer>
  </main>
</div>
