<script>
  import { enhance } from '$app/forms';
  import WaveCanvas from '$lib/components/WaveCanvas.svelte';
  export let form;
  export let data;
  let loading = false;
</script>

<svelte:head><title>{data?.invite || data?.setup ? 'Create your password' : 'Set a new password'} — Noizes</title></svelte:head>

<div class="min-h-screen flex items-center justify-center px-4 relative" style="background: var(--bg-deep);">
  <WaveCanvas />

  <div class="relative z-10 w-full max-w-sm">
    <a href="/" class="flex items-center justify-center mb-10">
      <img src="/logo-wordmark.png" alt="NOIZES" class="h-11 w-auto" />
    </a>

    <div class="glass rounded-2xl p-8">
      <h1 class="text-xl font-black text-white mb-1">{data?.invite || data?.setup ? 'Create your password' : 'Set a new password'}</h1>
      <p class="text-sm mb-6" style="color: var(--ink-muted);">
        {#if data?.invite}
          Your creator invitation is confirmed. Create a password to enter Studio.
        {:else if data?.setup}
          Set a password so you can sign in directly next time. 10+ characters.
        {:else}
          Choose something long and unique. 10+ characters.
        {/if}
      </p>

      {#if form?.error}
        <div class="rounded-lg px-4 py-3 mb-4 text-sm"
          style="background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.2);">
          {form.error}
        </div>
      {/if}

      <form method="POST"
        use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }}
        class="space-y-3">
        <input type="hidden" name="next" value={data?.next || '/exchange'} />
        <div>
          <label class="label-dark" for="password">New password</label>
          <input id="password" name="password" type="password" class="input-dark" placeholder="••••••••••"
            required minlength="10" autocomplete="new-password" />
        </div>
        <div>
          <label class="label-dark" for="confirm">Confirm password</label>
          <input id="confirm" name="confirm" type="password" class="input-dark" placeholder="••••••••••"
            required minlength="10" autocomplete="new-password" />
        </div>
        <button type="submit" class="btn-spectral w-full justify-center py-3 rounded-xl mt-1" disabled={loading}>
          {loading ? 'Saving…' : data?.invite ? 'Create password & enter Studio' : data?.setup ? 'Set password & continue' : 'Save new password'}
        </button>
      </form>
    </div>
  </div>
</div>
