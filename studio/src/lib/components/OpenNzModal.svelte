<script>
  import { onMount } from 'svelte';
  import JSZip from 'jszip';

  export let open = false;
  export let item = null;        // the collection item being opened
  export let onClose = () => {};

  let platform = 'desktop';      // 'ios' | 'android' | 'desktop'
  let standalone = false;
  let deferredPrompt = null;     // Android/desktop beforeinstallprompt
  let downloadState = 'idle';    // idle | downloading | done | error
  let downloadName = '';
  let downloadError = '';

  function personalizedHistory(existing, snapshot) {
    return {
      ...(existing || {}),
      scope: 'release_copy',
      release: { ...(existing?.release || {}), ...snapshot.release },
      edition: { ...(existing?.edition || {}), ...snapshot.edition, applies_to: 'release' },
      copy: {
        copy_id: snapshot.copy_id,
        copy_number: snapshot.copy_number,
        current_identity: snapshot.copy_number
          ? `Copy ${snapshot.copy_number}${snapshot.edition.edition_size ? ` of ${snapshot.edition.edition_size}` : ''}`
          : `Authenticated copy ${snapshot.copy_id}`,
      },
      ownership_history: snapshot.events,
      collector_note: { storage: 'package_snapshot', body: snapshot.collector_note },
      offline_snapshot: {
        ...(existing?.offline_snapshot || {}),
        generated_at: snapshot.generated_at,
        provenance_event_count: snapshot.events.length,
        latest_event: snapshot.events.at(-1) || null,
      },
      ownership_policy: 'Ownership and transfer provenance applies to the complete authenticated release copy. Tracks do not have independent ownership chains.',
    };
  }

  function injectHistory(html, history) {
    const match = html.match(/window\.NZ_CONFIG = (\{[\s\S]*?\});\n<\/script>/);
    if (!match) return html;
    const config = JSON.parse(match[1]);
    config.history = history;
    const encoded = JSON.stringify(config, null, 2).replace(/</g, '\\u003c');
    return html.replace(match[1], encoded);
  }

  onMount(() => {
    const ua = navigator.userAgent || '';
    if (/iphone|ipad|ipod/i.test(ua)) platform = 'ios';
    else if (/android/i.test(ua)) platform = 'android';
    else platform = 'desktop';
    standalone = window.navigator.standalone === true
      || window.matchMedia('(display-mode: standalone)').matches;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
    });
  });

  // When the modal opens for an item, kick off the package download immediately.
  $: if (open && item && downloadState === 'idle') startDownload();

  async function startDownload() {
    downloadState = 'downloading';
    downloadError = '';
    try {
      const res = await fetch(`/collection/download/${item.id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Download failed');
      downloadName = j.filename;

      // Personalize only ownership metadata in-browser. Media components and
      // their signed checksum inventory stay byte-for-byte unchanged, while
      // the delivered .nz receives this acquisition's copy identity and
      // offline provenance snapshot.
      const packageResponse = await fetch(j.url);
      if (!packageResponse.ok) throw new Error('Could not retrieve package bytes');
      const zip = await JSZip.loadAsync(await packageResponse.arrayBuffer());
      const existingHistory = zip.file('history.json')
        ? JSON.parse(await zip.file('history.json').async('string'))
        : {};
      const history = personalizedHistory(existingHistory, j.snapshot);
      const provenance = {
        scope: 'release_copy',
        release_id: j.snapshot.release.release_id,
        edition_id: history.edition.edition_id || null,
        copy_id: j.snapshot.copy_id,
        copy_number: j.snapshot.copy_number,
        events: j.snapshot.events,
        snapshot_at: j.snapshot.generated_at,
      };
      zip.file('history.json', JSON.stringify(history, null, 2));
      zip.file('provenance.json', JSON.stringify(provenance, null, 2));
      if (zip.file('experience.html')) {
        zip.file('experience.html', injectHistory(await zip.file('experience.html').async('string'), history));
      }
      if (zip.file('manifest.json')) {
        const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
        manifest.delivery = { scope: 'release_copy', copy_id: j.snapshot.copy_id, copy_number: j.snapshot.copy_number, snapshot_at: j.snapshot.generated_at };
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      }
      const personalized = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url = URL.createObjectURL(personalized);
      const a = document.createElement('a');
      a.href = url;
      a.download = j.filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      downloadState = 'done';
    } catch (e) {
      downloadState = 'error';
      downloadError = e.message;
    }
  }

  async function installNow() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  }

  function close() {
    downloadState = 'idle';
    downloadName = '';
    downloadError = '';
    onClose();
  }
</script>

{#if open}
  <div class="scrim" on:click|self={close} role="presentation">
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Open your Noizes object">
      <button class="x" on:click={close} aria-label="Close">×</button>

      <p class="kicker">Open your object</p>
      <h2 class="title">{item?.title ?? 'Your .nz'}</h2>
      <p class="sub">
        Your package plays in the <strong>Noizes</strong> app — a tiny viewer that runs
        <strong>completely offline</strong>. Your .nz files never leave your device.
      </p>

      <!-- Download status -->
      <div class="dl {downloadState}">
        {#if downloadState === 'downloading'}
          <span class="dot spin"></span> Downloading your package…
        {:else if downloadState === 'done'}
          <span class="dot ok">✓</span> Saved <strong>{downloadName}</strong> to your device
        {:else if downloadState === 'error'}
          <span class="dot err">!</span> {downloadError}
          <button class="retry" on:click={startDownload}>Retry</button>
        {/if}
      </div>

      <!-- Platform-specific install + open steps -->
      {#if standalone}
        <ol class="steps">
          <li><span class="ic">⬟</span><p>You're in the Noizes app. Tap <strong>Choose File</strong> and pick the package you just downloaded.</p></li>
        </ol>
      {:else if platform === 'ios'}
        <p class="section">Get the Noizes app (once)</p>
        <ol class="steps">
          <li><span class="ic">1</span><p>Tap the <strong>Share</strong> button <span class="gl">⬆</span> in Safari's toolbar</p></li>
          <li><span class="ic">2</span><p>Choose <strong>Add to Home Screen</strong> <span class="gl">＋</span></p></li>
          <li><span class="ic">3</span><p>Open <strong>Noizes</strong> from your home screen</p></li>
          <li><span class="ic">4</span><p>Tap <strong>Choose File</strong> and pick <strong>{downloadName || 'the .nz'}</strong> from your Downloads</p></li>
        </ol>
        <p class="note">Safari is required for “Add to Home Screen”. After that it works with no internet, forever.</p>
      {:else if platform === 'android'}
        <p class="section">Get the Noizes app (once)</p>
        {#if deferredPrompt}
          <button class="install" on:click={installNow}>⬟ Install Noizes</button>
        {/if}
        <ol class="steps">
          <li><span class="ic">1</span><p>{deferredPrompt ? 'Tap Install above' : 'Open the browser menu ⋮ and tap'} <strong>{deferredPrompt ? '' : 'Install app / Add to Home screen'}</strong></p></li>
          <li><span class="ic">2</span><p>Open <strong>Noizes</strong> from your home screen</p></li>
          <li><span class="ic">3</span><p>Tap <strong>Choose File</strong> and pick <strong>{downloadName || 'the .nz'}</strong> from your Downloads</p></li>
        </ol>
      {:else}
        <p class="section">Open it now</p>
        {#if deferredPrompt}
          <button class="install" on:click={installNow}>⬟ Install the Noizes app</button>
        {/if}
        <ol class="steps">
          <li><span class="ic">1</span><p>Open the viewer: <a href="/viewer.html" target="_blank" rel="noopener">noizes viewer →</a>{#if deferredPrompt} (or install it above for one-tap access){/if}</p></li>
          <li><span class="ic">2</span><p>Drag <strong>{downloadName || 'your .nz'}</strong> onto the viewer, or click to browse to it</p></li>
        </ol>
        <p class="note">Once loaded, the viewer works with no internet. Nothing is uploaded.</p>
      {/if}

      <button class="done" on:click={close}>Got it</button>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed; inset: 0; z-index: 200;
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    background: rgba(3, 3, 3, 0.55);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  }
  .sheet {
    position: relative; width: 100%; max-width: 420px; max-height: 90vh; overflow-y: auto;
    background: #0e0e0e; border: 1px solid rgba(255,255,255,0.1); border-radius: 22px;
    padding: 28px 24px 22px; color: #f5f2ec;
    box-shadow: 0 24px 80px rgba(0,0,0,0.6);
  }
  .x { position: absolute; top: 14px; right: 16px; background: none; border: none; color: #555; font-size: 24px; cursor: pointer; line-height: 1; }
  .kicker { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #7B5CF0; margin-bottom: 6px; }
  .title { font-size: 22px; font-weight: 800; margin-bottom: 10px; }
  .sub { font-size: 13px; color: rgba(245,242,236,.55); line-height: 1.6; margin-bottom: 18px; }
  .dl { font-size: 13px; display: flex; align-items: center; gap: 8px; margin-bottom: 18px; min-height: 20px; color: rgba(245,242,236,.7); }
  .dl.done { color: #4ade80; }
  .dl.error { color: #f87171; }
  .dot { width: 16px; height: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
  .dot.ok { background: rgba(74,222,128,.15); color: #4ade80; }
  .dot.err { background: rgba(248,113,113,.15); color: #f87171; }
  .dot.spin { border: 2px solid rgba(123,92,240,.25); border-top-color: #7B5CF0; animation: sp .8s linear infinite; }
  @keyframes sp { to { transform: rotate(360deg); } }
  .retry { margin-left: auto; font-size: 12px; background: none; border: 1px solid rgba(255,255,255,.15); color: #fff; border-radius: 99px; padding: 3px 12px; cursor: pointer; }
  .section { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: rgba(245,242,236,.4); margin-bottom: 12px; }
  .steps { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 14px; }
  .steps li { display: flex; align-items: flex-start; gap: 12px; }
  .steps p { font-size: 14px; line-height: 1.45; margin: 0; color: rgba(245,242,236,.9); }
  .ic { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; background: rgba(123,92,240,.15); color: #7B5CF0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
  .gl { font-size: 16px; }
  .steps a { color: #fff; text-decoration: underline; }
  .note { font-size: 11px; color: rgba(245,242,236,.35); line-height: 1.5; margin-bottom: 16px; }
  .install { width: 100%; background: linear-gradient(135deg,#7B5CF0,#4B6BF0); color: #fff; border: none; border-radius: 12px; padding: 12px; font-size: 14px; font-weight: 700; cursor: pointer; margin-bottom: 16px; }
  .done { width: 100%; background: rgba(255,255,255,.06); color: #fff; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; padding: 11px; font-size: 13px; font-weight: 600; cursor: pointer; }
</style>
