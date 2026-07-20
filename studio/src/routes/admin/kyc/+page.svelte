<script>
  import { enhance } from '$app/forms';
  export let data;
  export let form;

  $: submissions = data.submissions ?? [];
  $: pending  = submissions.filter(s => s.status === 'pending');
  $: reviewed = submissions.filter(s => s.status !== 'pending');

  const ID_TYPE_LABELS = {
    national_id: 'National ID',
    passport: 'Passport',
    drivers_license: "Driver's license",
  };

  $: rejectReasons = data.rejectReasons ?? [];

  let rejecting = {};      // submission id → showing the reason picker
  let rejectPick = {};     // submission id → selected dropdown value
  let busy = {};           // submission id → in-flight

  function timeAgo(ts) {
    if (!ts) return '—';
    const diff = Date.now() - new Date(ts);
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
</script>

<svelte:head><title>KYC review — Noizes Admin</title></svelte:head>

<div class="max-w-5xl mx-auto px-6 py-8">
  <div class="mb-8">
    <p class="t-caption mb-2">Admin</p>
    <h1 class="text-3xl font-black text-white">Identity verification</h1>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">
      {pending.length} pending · {reviewed.length} reviewed
    </p>
  </div>

  {#if form?.reviewed}
    <div class="glass rounded-xl px-5 py-3 mb-5 text-sm flex items-center gap-2" style="border-color: rgba(123,92,240,0.3);">
      <span style="color: #7B5CF0;">✓</span>
      <span class="text-white">Submission {form.reviewed}.</span>
    </div>
  {/if}
  {#if form?.error}
    <div class="rounded-xl px-5 py-3 mb-5 text-sm" style="background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.2);">
      {form.error}
    </div>
  {/if}

  {#if pending.length === 0}
    <div class="glass rounded-2xl p-12 text-center mb-8">
      <p class="t-caption mb-2">All clear</p>
      <p class="text-sm" style="color: var(--ink-muted);">No verifications waiting for review.</p>
    </div>
  {/if}

  {#each pending as s (s.id)}
    <div class="glass rounded-2xl p-6 mb-5" style="border-color: rgba(123,92,240,0.25);">
      <div class="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <p class="text-base font-black text-white">{s.full_name}</p>
          <p class="text-xs font-mono mt-0.5" style="color: var(--ink-muted);">{s.email} · submitted {timeAgo(s.submitted_at)}</p>
        </div>
        <span class="text-xs px-2 py-0.5 rounded-full font-mono" style="background: rgba(123,92,240,0.12); color: #7B5CF0;">pending</span>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-sm">
        <div><p class="t-caption mb-1">Country</p><p class="text-white">{s.country}</p></div>
        <div><p class="t-caption mb-1">ID type</p><p class="text-white">{ID_TYPE_LABELS[s.id_type] ?? s.id_type}</p></div>
        <div><p class="t-caption mb-1">ID number</p><p class="text-white font-mono">{s.id_number}</p></div>
        <div><p class="t-caption mb-1">Artist name</p><p class="text-white">{s.artist_name ?? '—'}</p></div>
        <div><p class="t-caption mb-1">Years active</p><p class="text-white">{s.years_active ?? '—'}</p></div>
      </div>

      {#if (s.music_links?.length || s.social_links?.length)}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm">
          <div>
            <p class="t-caption mb-1">Music</p>
            {#each s.music_links ?? [] as link}
              <a href={link} target="_blank" rel="noreferrer" class="block text-xs truncate hover:underline" style="color: #7B5CF0;">{link}</a>
            {:else}
              <p class="text-xs" style="color: var(--ink-muted);">—</p>
            {/each}
          </div>
          <div>
            <p class="t-caption mb-1">Socials</p>
            {#each s.social_links ?? [] as link}
              <a href={link} target="_blank" rel="noreferrer" class="block text-xs truncate hover:underline" style="color: #4B6BF0;">{link}</a>
            {:else}
              <p class="text-xs" style="color: var(--ink-muted);">—</p>
            {/each}
          </div>
        </div>
      {/if}

      <div class="grid grid-cols-2 gap-3 mb-5">
        {#each [{ url: s.id_document_url, label: 'ID document' }, { url: s.selfie_url, label: 'Selfie with ID' }] as doc}
          <div>
            <p class="t-caption mb-2">{doc.label}</p>
            {#if doc.url}
              <a href={doc.url} target="_blank" rel="noreferrer" class="block rounded-xl overflow-hidden" style="border: 1px solid var(--border-dim);">
                <img src={doc.url} alt={doc.label} class="w-full max-h-64 object-contain bg-black" loading="lazy" />
              </a>
            {:else}
              <p class="text-xs" style="color: #f87171;">Document missing</p>
            {/if}
          </div>
        {/each}
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        <form method="POST" action="?/approve" use:enhance={() => { busy[s.id] = true; return async ({ update }) => { busy[s.id] = false; update(); }; }}>
          <input type="hidden" name="id" value={s.id} />
          <button type="submit" class="btn-spectral py-2 px-5 text-sm rounded-full" disabled={busy[s.id]}>
            {busy[s.id] ? '…' : 'Approve'}
          </button>
        </form>

        {#if rejecting[s.id]}
          <form method="POST" action="?/reject" class="flex items-center gap-2 flex-1 min-w-64 flex-wrap"
            use:enhance={() => { busy[s.id] = true; return async ({ update }) => { busy[s.id] = false; update(); }; }}>
            <input type="hidden" name="id" value={s.id} />
            <select name="reject_reason" required bind:value={rejectPick[s.id]}
              class="input-dark flex-1 rounded-full text-sm min-w-56" style="padding-left: 16px; padding-right: 16px;">
              <option value="" disabled selected>Pick a reason (the artist sees it)…</option>
              {#each rejectReasons as r}
                <option value={r}>{r}</option>
              {/each}
              <option value="__other__">Other reason…</option>
            </select>
            {#if rejectPick[s.id] === '__other__'}
              <input name="reject_reason_custom" type="text" required maxlength="300" placeholder="Custom reason"
                class="input-dark flex-1 rounded-full text-sm min-w-56" style="padding-left: 16px; padding-right: 16px;" />
            {/if}
            <button type="submit" class="py-2 px-4 text-sm rounded-full font-semibold" disabled={busy[s.id]}
              style="background: rgba(248,113,113,0.12); color: #f87171; border: 1px solid rgba(248,113,113,0.25);">
              Confirm reject
            </button>
          </form>
        {:else}
          <button type="button" class="py-2 px-5 text-sm rounded-full font-semibold"
            style="background: rgba(255,255,255,0.05); color: var(--ink-secondary); border: 1px solid var(--border-dim);"
            on:click={() => rejecting = { ...rejecting, [s.id]: true }}>
            Reject…
          </button>
        {/if}
      </div>
    </div>
  {/each}

  {#if reviewed.length > 0}
    <p class="t-caption mb-3 mt-10">Reviewed</p>
    <div class="glass rounded-2xl overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b text-left" style="border-color: var(--border-dim);">
            <th class="px-5 py-3 t-caption">Name</th>
            <th class="px-5 py-3 t-caption">Email</th>
            <th class="px-5 py-3 t-caption">Decision</th>
            <th class="px-5 py-3 t-caption">Reviewed</th>
          </tr>
        </thead>
        <tbody>
          {#each reviewed as s (s.id)}
            <tr class="border-b last:border-0" style="border-color: var(--border-dim);">
              <td class="px-5 py-3 text-sm text-white">{s.full_name}</td>
              <td class="px-5 py-3 text-xs font-mono" style="color: var(--ink-muted);">{s.email}</td>
              <td class="px-5 py-3">
                <span class="text-xs px-2 py-0.5 rounded-full font-mono"
                  style={s.status === 'approved'
                    ? 'background: rgba(74,222,128,0.1); color: #4ade80;'
                    : 'background: rgba(248,113,113,0.1); color: #f87171;'}>
                  {s.status}
                </span>
                {#if s.reject_reason}
                  <span class="text-xs ml-2" style="color: var(--ink-muted);">{s.reject_reason}</span>
                {/if}
              </td>
              <td class="px-5 py-3 text-xs font-mono" style="color: var(--ink-muted);">{timeAgo(s.reviewed_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
