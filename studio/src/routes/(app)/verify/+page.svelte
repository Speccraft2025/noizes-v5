<script>
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  export let data;
  export let form;

  $: kyc = data.kyc;
  $: idTypes = data.idTypes ?? [];

  const ID_TYPE_LABELS = {
    national_id: 'National ID',
    passport: 'Passport',
    drivers_license: "Driver's license",
  };

  let submitting = false;
</script>

<svelte:head><title>Verify your identity — Noizes</title></svelte:head>

<div class="max-w-xl mx-auto px-6 py-12">
  <div class="mb-8">
    <p class="t-caption mb-2">Authenticity</p>
    <h1 class="text-3xl font-black text-white mb-2">Verify your identity</h1>
    <p class="text-sm" style="color: var(--ink-muted);">
      Every pressing on Noizes is signed by a verified human artist. Verification links your
      releases to you — collectors know the work is authentic, and you get paid for it.
    </p>
  </div>

  {#if kyc.status === 'approved'}
    <div class="glass rounded-2xl p-8 text-center" style="border-color: rgba(74,222,128,0.3);">
      <p class="t-caption mb-3" style="color: #4ade80;">Verified</p>
      <p class="text-base text-white mb-2 font-bold">Your identity is verified.</p>
      <p class="text-sm mb-6" style="color: var(--ink-muted);">You can publish releases to the exchange.</p>
      <a href="/studio" class="btn-spectral rounded-full px-6 py-2.5 text-sm">Go to the studio →</a>
    </div>

  {:else if kyc.status === 'pending' || form?.submitted}
    <div class="glass rounded-2xl p-8 text-center" style="border-color: rgba(123,92,240,0.3);">
      <p class="t-caption mb-3">Under review</p>
      <p class="text-base text-white mb-2 font-bold">Your verification is being reviewed.</p>
      <p class="text-sm" style="color: var(--ink-muted);">
        This is a human review — usually within a day. You'll be able to publish as soon as it's approved.
      </p>
    </div>

  {:else}
    {#if kyc.status === 'rejected'}
      <div class="rounded-xl px-5 py-4 mb-6 text-sm" style="background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.25);">
        <strong class="text-white block mb-1">Your previous submission was not approved.</strong>
        {#if kyc.reject_reason}
          <span style="color: var(--ink-muted);">Reason: {kyc.reject_reason}</span>
        {:else}
          <span style="color: var(--ink-muted);">Please check your details and try again.</span>
        {/if}
      </div>
    {/if}

    {#if form?.error}
      <div class="rounded-xl px-5 py-3 mb-6 text-sm" style="background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.2);">
        {form.error}
      </div>
    {/if}

    <form method="POST" action="?/submit" enctype="multipart/form-data"
      use:enhance={() => {
        submitting = true;
        return async ({ update }) => { submitting = false; await update(); await invalidateAll(); };
      }}
      class="glass rounded-2xl p-6 space-y-5">

      <div>
        <label for="full_name" class="t-caption block mb-2">Full legal name</label>
        <input id="full_name" name="full_name" type="text" required maxlength="200"
          class="input-dark w-full rounded-xl" placeholder="As it appears on your ID" />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="country" class="t-caption block mb-2">Country</label>
          <input id="country" name="country" type="text" required maxlength="100"
            class="input-dark w-full rounded-xl" placeholder="e.g. Kenya" />
        </div>
        <div>
          <label for="id_type" class="t-caption block mb-2">ID type</label>
          <select id="id_type" name="id_type" required class="input-dark w-full rounded-xl">
            {#each idTypes as t}
              <option value={t}>{ID_TYPE_LABELS[t] ?? t}</option>
            {/each}
          </select>
        </div>
      </div>

      <div>
        <label for="id_number" class="t-caption block mb-2">ID number</label>
        <input id="id_number" name="id_number" type="text" required maxlength="50"
          class="input-dark w-full rounded-xl" placeholder="Document number" />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="id_document" class="t-caption block mb-2">Photo of your ID</label>
          <input id="id_document" name="id_document" type="file" accept="image/*" required
            class="input-dark w-full rounded-xl text-xs" />
        </div>
        <div>
          <label for="selfie" class="t-caption block mb-2">Selfie holding your ID</label>
          <input id="selfie" name="selfie" type="file" accept="image/*" required
            class="input-dark w-full rounded-xl text-xs" />
        </div>
      </div>

      <p class="text-xs" style="color: var(--ink-muted);">
        Keep both photos under 5MB combined. Your documents are stored privately and only
        visible to the Noizes review team.
      </p>

      <button type="submit" class="btn-spectral w-full py-3 rounded-xl font-bold text-sm" disabled={submitting}>
        {submitting ? 'Uploading…' : 'Submit for verification'}
      </button>
    </form>
  {/if}
</div>
