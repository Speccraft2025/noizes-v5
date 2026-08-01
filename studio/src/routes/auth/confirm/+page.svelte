<script>
  import { enhance } from '$app/forms';
  import WaveCanvas from '$lib/components/WaveCanvas.svelte';
  export let data;
  let loading = false;
</script>

<svelte:head><title>Accept creator invitation — Noizes</title></svelte:head>

<div class="min-h-screen flex items-center justify-center px-4 relative" style="background: var(--bg-deep);">
  <WaveCanvas />
  <div class="relative z-10 w-full max-w-sm">
    <a href="/" class="flex items-center justify-center mb-10">
      <img src="/logo-wordmark.png" alt="NOIZES" class="h-11 w-auto" />
    </a>
    <div class="glass rounded-2xl p-8 text-center">
      <p class="t-caption mb-3" style="color: var(--violet);">CREATOR COLLABORATION</p>
      <h1 class="text-2xl font-black text-white mb-3">Accept your invitation</h1>
      <p class="text-sm mb-7" style="color: var(--ink-muted);">
        Confirm that you want to join this release. You’ll create a password before entering Noizes Studio.
      </p>
      <form method="POST" use:enhance={() => {
        loading = true;
        return async ({ update }) => { loading = false; await update(); };
      }}>
        <input type="hidden" name="token_hash" value={data.tokenHash} />
        <button type="submit" class="btn-spectral w-full justify-center py-3 rounded-xl" disabled={loading}>
          {loading ? 'Confirming…' : 'Accept invitation'}
        </button>
      </form>
    </div>
  </div>
</div>
