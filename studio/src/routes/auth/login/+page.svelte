<script>
  import { onMount } from 'svelte';
  import { enhance } from '$app/forms';
  import WaveCanvas from '$lib/components/WaveCanvas.svelte';
  export let form;
  export let data;

  let loading = false;
  let hashNotice = null;
  // Default to the passwordless path: nothing to forget, nothing to phish.
  let mode = 'magic'; // 'magic' | 'password'

  // If a password attempt just failed, keep the user on the password tab.
  $: if (form?.mode === 'password') mode = 'password';

  // Supabase reports provider failures in the URL fragment, which never reaches
  // the server — so the specific reason is only recoverable here on the client.
  onMount(() => {
    if (!window.location.hash) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const desc = params.get('error_description') ?? '';
    if (/invite|saving new user/i.test(desc)) hashNotice = 'not_invited';
    else if (params.get('error')) hashNotice = 'auth_failed';
    history.replaceState(null, '', window.location.pathname + window.location.search);
  });

  $: notice = hashNotice ?? data?.notice;
</script>

<svelte:head><title>Sign in — Noizes</title></svelte:head>

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
          If <strong class="text-white">{form.email}</strong> is on the list, a one-tap sign-in link is on its way.
          Open it on this device. The link expires shortly and works once.
        </p>
        <a href="/auth/login" class="block text-center text-xs mt-6 text-white hover:underline">Use a different method</a>
      {:else}
        <h1 class="text-xl font-black text-white mb-1">Welcome back</h1>
        <p class="text-sm mb-6" style="color: var(--ink-muted);">Sign in to your account</p>

        {#if notice === 'invite_only'}
          <div class="rounded-xl px-4 py-3 mb-5 text-sm"
            style="background: rgba(123,92,240,0.08); border: 1px solid rgba(123,92,240,0.25); color: var(--ink-secondary);">
            <strong class="text-white">Access is by invitation only.</strong><br />
            <span style="color: var(--ink-muted);">Request access on the <a href="/" class="text-white hover:underline">homepage</a> and we'll be in touch.</span>
          </div>
        {:else if notice === 'not_invited'}
          <div class="rounded-xl px-4 py-3 mb-5 text-sm"
            style="background: rgba(123,92,240,0.08); border: 1px solid rgba(123,92,240,0.25); color: var(--ink-secondary);">
            <strong class="text-white">That account isn't on the invite list.</strong><br />
            <span style="color: var(--ink-muted);">Noizes is invite-only while we're in early access. Join the waiting list on the
              <a href="/" class="text-white hover:underline">homepage</a> and we'll be in touch when a spot opens.</span>
          </div>
        {:else if notice === 'auth_failed'}
          <div class="rounded-xl px-4 py-3 mb-5 text-sm"
            style="background: rgba(123,92,240,0.08); border: 1px solid rgba(123,92,240,0.25); color: var(--ink-secondary);">
            <strong class="text-white">We couldn't complete that sign-in.</strong><br />
            <span style="color: var(--ink-muted);">The link may have expired or already been used — request a fresh one below.</span>
          </div>
        {/if}

        {#if form?.error}
          <div class="rounded-lg px-4 py-3 mb-4 text-sm"
            style="background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.2);">
            {form.error}
          </div>
        {/if}

        {#if mode === 'magic'}
          <form method="POST" action="?/magic"
            use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }}
            class="space-y-3">
            <div>
              <label class="label-dark" for="email">Email</label>
              <input id="email" name="email" type="email" class="input-dark" placeholder="you@example.com"
                required autocomplete="email" />
            </div>
            <button type="submit" class="btn-spectral w-full justify-center py-3 rounded-xl mt-1" disabled={loading}>
              {loading ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
          <p class="text-center text-xs mt-4" style="color: var(--ink-muted);">
            No password needed. <button type="button" class="text-white hover:underline" on:click={() => (mode = 'password')}>Use a password instead</button>
          </p>
        {:else}
          <form method="POST" action="?/email"
            use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }}
            class="space-y-3">
            <div>
              <label class="label-dark" for="email">Email</label>
              <input id="email" name="email" type="email" class="input-dark" placeholder="you@example.com"
                required autocomplete="email" />
            </div>
            <div>
              <label class="label-dark" for="password">Password</label>
              <input id="password" name="password" type="password" class="input-dark" placeholder="••••••••"
                required autocomplete="current-password" />
            </div>
            <button type="submit" class="btn-spectral w-full justify-center py-3 rounded-xl mt-1" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div class="flex items-center justify-between text-xs mt-4">
            <button type="button" class="text-white hover:underline" on:click={() => (mode = 'magic')}>Email me a link instead</button>
            <a href="/auth/recover" class="hover:underline" style="color: var(--ink-muted);">Forgot password?</a>
          </div>
        {/if}

        <p class="text-center text-xs mt-5" style="color: var(--ink-muted);">
          Don't have access? <a href="/" class="text-white hover:underline">Request an invitation</a>
        </p>
      {/if}
    </div>
  </div>
</div>
