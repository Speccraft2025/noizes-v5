<script>
  import { enhance } from '$app/forms';
  import WaveCanvas from '$lib/components/WaveCanvas.svelte';
  export let form;

  let role = 'collector';
  let loading = false;
  let googleLoading = false;
</script>

<svelte:head><title>Get Access — Noizes</title></svelte:head>

<div class="min-h-screen flex items-center justify-center px-4 relative" style="background: var(--bg-deep);">
  <WaveCanvas />

  <div class="relative z-10 w-full max-w-sm">
    <a href="/" class="flex items-center justify-center gap-2 mb-10">
      <span class="font-black text-2xl tracking-tight text-white">NOIZES</span>
    </a>

    {#if form?.success}
      <div class="glass rounded-2xl p-8 text-center">
        <div class="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style="background: rgba(123,92,240,0.15);">
          <span class="text-2xl">✉</span>
        </div>
        <h2 class="text-xl font-black text-white mb-2">Check your email</h2>
        <p class="text-sm" style="color: var(--ink-muted);">We sent a confirmation link to <strong class="text-white">{form.email}</strong>. Click it to activate your account.</p>
        <a href="/auth/login" class="btn-ghost mt-6 inline-flex">Back to sign in</a>
      </div>
    {:else}
      <div class="glass rounded-2xl p-8">
        <h1 class="text-xl font-black text-white mb-1">Get access</h1>
        <p class="text-sm mb-5" style="color: var(--ink-muted);">Join Noizes as a creator or collector</p>

        <!-- Role selector -->
        <div class="grid grid-cols-2 gap-2 mb-5">
          <button type="button"
            class="py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 text-left"
            style={role === 'collector'
              ? 'background: var(--gradient-spectral); color: #fff; border: none;'
              : 'background: rgba(255,255,255,0.04); border: 1px solid var(--border-dim); color: var(--ink-secondary);'}
            on:click={() => role = 'collector'}
          >
            <div class="text-lg mb-1">◉</div>
            <div>Collector</div>
            <div class="text-xs mt-0.5 opacity-70">Browse & own editions</div>
          </button>
          <button type="button"
            class="py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 text-left"
            style={role === 'creator'
              ? 'background: var(--gradient-spectral); color: #fff; border: none;'
              : 'background: rgba(255,255,255,0.04); border: 1px solid var(--border-dim); color: var(--ink-secondary);'}
            on:click={() => role = 'creator'}
          >
            <div class="text-lg mb-1">◈</div>
            <div>Creator</div>
            <div class="text-xs mt-0.5 opacity-70">Package & release music</div>
          </button>
        </div>

        {#if form?.error}
          <div class="rounded-lg px-4 py-3 mb-4 text-sm" style="background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.2);">{form.error}</div>
        {/if}

        <!-- Google -->
        <form method="POST" action="?/google&role={role}" use:enhance={() => { googleLoading = true; return async ({ update }) => { googleLoading = false; update(); }; }}>
          <button type="submit" class="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-semibold text-sm mb-4 transition-all duration-200"
            style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-dim); color: #fff;" disabled={googleLoading}>
            {#if googleLoading}
              <span class="animate-spin">↻</span> Connecting…
            {:else}
              <svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            {/if}
          </button>
        </form>

        <div class="flex items-center gap-3 mb-4">
          <div class="flex-1 h-px" style="background: var(--border-dim);"></div>
          <span class="text-xs" style="color: var(--ink-muted);">or</span>
          <div class="flex-1 h-px" style="background: var(--border-dim);"></div>
        </div>

        <!-- Email signup -->
        <form method="POST" action="?/email" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }} class="space-y-3">
          <input type="hidden" name="role" value={role} />
          <div>
            <label class="label-dark" for="display_name">Name</label>
            <input id="display_name" name="display_name" type="text" class="input-dark" placeholder="Your name" required />
          </div>
          <div>
            <label class="label-dark" for="email">Email</label>
            <input id="email" name="email" type="email" class="input-dark" placeholder="you@example.com" required autocomplete="email" />
          </div>
          <div>
            <label class="label-dark" for="password">Password</label>
            <input id="password" name="password" type="password" class="input-dark" placeholder="8+ characters" required minlength="8" autocomplete="new-password" />
          </div>
          <button type="submit" class="btn-spectral w-full justify-center py-3 rounded-xl mt-1" disabled={loading}>
            {loading ? 'Creating account…' : `Join as ${role === 'creator' ? 'Creator' : 'Collector'}`}
          </button>
        </form>

        <p class="text-center text-sm mt-5" style="color: var(--ink-muted);">
          Have an account? <a href="/auth/login" class="text-white font-semibold hover:underline">Sign in</a>
        </p>
      </div>
    {/if}
  </div>
</div>
