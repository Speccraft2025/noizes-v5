<script>
  import { enhance } from '$app/forms';
  import WaveCanvas from '$lib/components/WaveCanvas.svelte';
  export let form;
  let loading = false;
</script>

<svelte:head><title>Reset your password — Noizes</title></svelte:head>

<div class="min-h-screen flex items-center justify-center px-4 relative" style="background: var(--bg-deep);">
  <WaveCanvas />

  <div class="relative z-10 w-full max-w-sm">
    <a href="/" class="flex items-center justify-center mb-10">
      <img src="/logo-wordmark.png" alt="NOIZES" class="h-11 w-auto" />
    </a>

    <div class="glass rounded-2xl p-8">
      {#if form?.sent}
        <h1 class="text-xl font-black text-white mb-1">Check your email</h1>
        <p class="text-sm" style="color: var(--ink-muted);">
          If <strong class="text-white">{form.email}</strong> has an account, a reset link is on its way.
          Open it on this device to set a new password. The link expires shortly.
        </p>
        <a href="/auth/login" class="block text-center text-xs mt-6 text-white hover:underline">Back to sign in</a>
      {:else}
        <h1 class="text-xl font-black text-white mb-1">Reset your password</h1>
        <p class="text-sm mb-6" style="color: var(--ink-muted);">We'll email you a secure link to set a new one.</p>

        {#if form?.error}
          <div class="rounded-lg px-4 py-3 mb-4 text-sm"
            style="background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.2);">
            {form.error}
          </div>
        {/if}

        <form method="POST"
          use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }}
          class="space-y-3">
          <div>
            <label class="label-dark" for="email">Email</label>
            <input id="email" name="email" type="email" class="input-dark" placeholder="you@example.com"
              required autocomplete="email" />
          </div>
          <button type="submit" class="btn-spectral w-full justify-center py-3 rounded-xl mt-1" disabled={loading}>
            {loading ? 'Sending…' : 'Email me a reset link'}
          </button>
        </form>

        <p class="text-center text-xs mt-5" style="color: var(--ink-muted);">
          Remembered it? <a href="/auth/login" class="text-white hover:underline">Back to sign in</a>
        </p>
      {/if}
    </div>
  </div>
</div>
