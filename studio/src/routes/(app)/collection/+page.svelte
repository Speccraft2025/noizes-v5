<script>
  import { invalidateAll } from '$app/navigation';
  import OpenNzModal from '$lib/components/OpenNzModal.svelte';

  export let data;
  $: ({ collection, events, myOffers } = data);

  let openItem = null;   // item whose .nz is being opened (drives the modal)
  function openNz(item) { openItem = item; }

  const colors = ['#4B6BF0', '#7B5CF0', '#F04BD8', '#7B5CF0', '#4B6BF0', '#F04BD8'];

  const eventLabel = {
    created: 'Created',
    acquired: 'Acquired',
    transferred: 'Transferred',
    note: 'Note added',
    verified: 'Verified',
  };

  function formatType(value) {
    return String(value || 'release').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  let expanded = {};        // acquisition_id -> bool (Living Record open)
  let noteDrafts = {};      // acquisition_id -> string
  let transferring = null;  // acquisition_id currently in the transfer form
  let transferEmail = '';
  let busy = false;
  let flash = '';

  function toggle(id) { expanded[id] = !expanded[id]; expanded = expanded; }

  async function saveNote(item) {
    busy = true; flash = '';
    try {
      const res = await fetch('/collection/note', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ acquisition_id: item.id, body: noteDrafts[item.id] ?? item.note }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Could not save note');
      flash = 'Note saved.';
      await invalidateAll();
    } catch (e) { flash = e.message; } finally { busy = false; }
  }

  async function doTransfer(item) {
    if (!transferEmail.includes('@')) { flash = 'Enter a valid email.'; return; }
    busy = true; flash = '';
    try {
      const res = await fetch('/collection/transfer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ acquisition_id: item.id, to_email: transferEmail }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Transfer failed');
      flash = `Transferred to ${transferEmail}.`;
      transferring = null; transferEmail = '';
      await invalidateAll();
    } catch (e) { flash = e.message; } finally { busy = false; }
  }

  async function acceptOffer(offerId) {
    busy = true; flash = '';
    try {
      const res = await fetch('/exchange/offers/accept', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Could not accept');
      flash = 'Offer accepted. The buyer can now complete payment.';
      await invalidateAll();
    } catch (e) { flash = e.message; } finally { busy = false; }
  }

  async function payOffer(offerId) {
    busy = true; flash = '';
    try {
      const res = await fetch('/exchange/offers/pay', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Could not start payment');
      window.location.href = j.authorization_url;
    } catch (e) { flash = e.message; busy = false; }
  }

  async function withdrawOffer(offerId) {
    busy = true; flash = '';
    try {
      const res = await fetch('/exchange/offers/withdraw', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Could not withdraw');
      await invalidateAll();
    } catch (e) { flash = e.message; } finally { busy = false; }
  }

  async function toggleOffers(item) {
    busy = true; flash = '';
    try {
      const res = await fetch('/collection/offers/accepting', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ acquisition_id: item.id, accepting: !item.accepting_offers }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Could not update');
      await invalidateAll();
    } catch (e) { flash = e.message; } finally { busy = false; }
  }
</script>

<div class="max-w-5xl mx-auto px-6 py-8">
  <div class="mb-10 flex items-end justify-between">
    <div>
      <p class="t-caption mb-2">Your Library</p>
      <h1 class="t-monumental-small text-white">Collection</h1>
      <p class="text-base mt-2" style="color: var(--ink-muted);">The objects in your care, and the history they carry.</p>
    </div>
    <div class="glass rounded-xl px-5 py-3 text-center">
      <p class="text-2xl font-black text-white">{collection.length}</p>
      <p class="t-caption">In your care</p>
    </div>
  </div>

  {#if flash}
    <div class="glass rounded-xl px-4 py-3 mb-4 text-sm text-white">{flash}</div>
  {/if}

  {#if collection.length === 0}
    <div class="glass rounded-2xl p-16 text-center">
      <p class="t-caption mb-3">Empty collection</p>
      <p class="text-base" style="color: var(--ink-muted);">Head to <a href="/exchange" class="text-white underline">Exchange</a> to acquire your first object.</p>
    </div>
  {:else}
    <div class="space-y-3 mb-10">
      {#each collection as item, i}
        {@const color = colors[i % colors.length]}
        <div class="glass rounded-2xl p-5">
          <div class="flex gap-5">
            <div class="w-20 h-20 shrink-0 rounded-xl flex items-center justify-center text-2xl font-black"
              style="background: radial-gradient(ellipse, {color}25, transparent); border: 1px solid {color}25; color: {color};">
              {item.artist[0]}
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold uppercase tracking-widest mb-0.5" style="color: {color};">{item.artist}</p>
              <h3 class="text-xl font-black text-white mb-2">{item.title}</h3>
              <div class="flex gap-3 mt-1 flex-wrap items-center">
                <span class="text-xs px-2 py-0.5 rounded-full" style="background: rgba(123,92,240,.12); color:#9a82ff;">{formatType(item.release_type)} · {item.track_count || 1} track{item.track_count === 1 ? '' : 's'}</span>
                <span class="text-xs px-2 py-0.5 rounded-full" style="background: rgba(255,255,255,0.05); color: var(--ink-muted);">{item.edition_name || item.edition_type}{item.edition_number ? ` #${item.edition_number}` : ''}{item.edition_size ? ` / ${item.edition_size}` : ''}</span>
                <span class="text-xs" style="color: var(--ink-muted);">Custodian since {item.acquired}</span>
                {#if item.accepting_offers}
                  <span class="text-xs px-2 py-0.5 rounded-full" style="background: {color}22; color: {color};">Accepting offers</span>
                {/if}
              </div>
            </div>

            <div class="flex flex-col gap-2 shrink-0 justify-center">
              <button class="btn-spectral py-1.5 px-4 text-xs rounded-full" on:click={() => openNz(item)}>Open .nz</button>
              <button class="btn-ghost py-1.5 px-4 text-xs rounded-full" on:click={() => toggle(item.id)}>
                {expanded[item.id] ? 'Hide record' : 'Living Record'}
              </button>
            </div>
          </div>

          {#if expanded[item.id]}
            <div class="mt-5 pt-5 border-t" style="border-color: var(--border-dim);">
              {#if item.tracklist?.length}
                <p class="t-caption mb-3">Tracklist snapshot</p>
                <ol class="grid sm:grid-cols-2 gap-x-6 gap-y-1 mb-6">
                  {#each item.tracklist as track}
                    <li class="flex gap-3 py-1 text-xs" style="color:{track.hidden ? 'var(--ink-muted)' : '#fff'};">
                      <span class="font-mono" style="color:#7B5CF0;">{track.disc_number}.{String(track.track_number).padStart(2, '0')}</span>
                      <span>{track.title}{track.primary_artist && track.primary_artist !== item.artist ? ` — ${track.primary_artist}` : ''}{track.hidden ? ' · hidden' : ''}</span>
                    </li>
                  {/each}
                </ol>
              {/if}
              <!-- Living Record -->
              <p class="t-caption mb-3">Living Record</p>
              <ol class="space-y-2 mb-6">
                {#each item.living_record as ev}
                  <li class="flex gap-3 text-sm">
                    <span class="font-mono text-xs shrink-0 w-24" style="color: var(--ink-muted);">{ev.date ?? ''}</span>
                    <span class="shrink-0 font-bold" style="color: {color};">{eventLabel[ev.kind] ?? ev.kind}</span>
                    <span class="flex-1" style="color: var(--ink-muted);">
                      {ev.price ? ev.price : ''}{#if ev.note}<span class="block italic text-white/80 mt-0.5">“{ev.note}”</span>{/if}
                    </span>
                  </li>
                {:else}
                  <li class="text-sm" style="color: var(--ink-muted);">No events recorded yet.</li>
                {/each}
              </ol>

              <!-- Stewardship note -->
              <p class="t-caption mb-2">Your stewardship note</p>
              <p class="text-xs mb-2" style="color: var(--ink-muted);">One note, kept with the object. When you pass it on, your note becomes part of its permanent record.</p>
              <textarea
                class="w-full glass rounded-xl p-3 text-sm text-white bg-transparent mb-2"
                rows="2" maxlength="280"
                placeholder="What did this object mean to you?"
                on:input={(e) => (noteDrafts[item.id] = e.currentTarget.value)}
              >{item.note}</textarea>
              <div class="flex gap-2 flex-wrap">
                <button class="btn-spectral py-1.5 px-4 text-xs rounded-full" disabled={busy} on:click={() => saveNote(item)}>Save note</button>

                <a class="btn-ghost py-1.5 px-4 text-xs rounded-full" href={`/provenance/${item.release_id}/${item.edition_label}`}>Export provenance.json</a>

                <button class="btn-ghost py-1.5 px-4 text-xs rounded-full" disabled={busy} on:click={() => toggleOffers(item)}>
                  {item.accepting_offers ? 'Stop accepting offers' : 'Accept offers'}
                </button>

                {#if transferring === item.id}
                  <input
                    class="glass rounded-full px-3 py-1.5 text-xs text-white bg-transparent"
                    placeholder="recipient@email" bind:value={transferEmail} />
                  <button class="btn-spectral py-1.5 px-4 text-xs rounded-full" disabled={busy} on:click={() => doTransfer(item)}>Confirm transfer</button>
                  <button class="btn-ghost py-1.5 px-4 text-xs rounded-full" on:click={() => (transferring = null)}>Cancel</button>
                {:else}
                  <button class="btn-ghost py-1.5 px-4 text-xs rounded-full" on:click={() => { transferring = item.id; transferEmail = ''; }}>Transfer / gift</button>
                {/if}
              </div>

              {#if item.offers && item.offers.length}
                <div class="mt-5">
                  <p class="t-caption mb-2">Offers on this edition</p>
                  {#each item.offers as offer}
                    <div class="flex items-center justify-between gap-3 py-2">
                      <span class="text-sm text-white">{offer.currency} {Number(offer.amount).toLocaleString()}</span>
                      <button class="btn-spectral py-1.5 px-4 text-xs rounded-full" disabled={busy} on:click={() => acceptOffer(offer.id)}>Accept</button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- My offers -->
    {#if myOffers && myOffers.length}
      <div class="mb-10">
        <p class="t-caption mb-4">Your Offers</p>
        <div class="glass rounded-xl divide-y" style="border-color: var(--border-dim);">
          {#each myOffers as offer}
            <div class="flex items-center justify-between gap-3 px-5 py-3">
              <span class="text-sm text-white">{offer.work}</span>
              <div class="flex items-center gap-3">
                <span class="text-sm" style="color: var(--ink-muted);">{offer.currency} {Number(offer.amount).toLocaleString()}</span>
                {#if offer.status === 'accepted'}
                  <button class="btn-spectral py-1.5 px-4 text-xs rounded-full" disabled={busy} on:click={() => payOffer(offer.id)}>Complete purchase</button>
                {:else}
                  <span class="text-xs px-2 py-0.5 rounded-full" style="background: rgba(255,255,255,0.05); color: var(--ink-muted);">Pending</span>
                  <button class="btn-ghost py-1.5 px-4 text-xs rounded-full" disabled={busy} on:click={() => withdrawOffer(offer.id)}>Withdraw</button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Ownership log -->
    <div>
      <p class="t-caption mb-4">Ownership Events</p>
      <div class="glass rounded-xl overflow-hidden">
        <table class="w-full text-xs font-mono">
          <thead>
            <tr class="border-b" style="border-color: var(--border-dim);">
              <th class="text-left px-5 py-3" style="color: var(--ink-muted);">Date</th>
              <th class="text-left px-5 py-3" style="color: var(--ink-muted);">Work</th>
              <th class="text-left px-5 py-3" style="color: var(--ink-muted);">Event</th>
              <th class="text-left px-5 py-3" style="color: var(--ink-muted);">Price</th>
            </tr>
          </thead>
          <tbody>
            {#each events as ev}
              <tr class="border-b last:border-0 transition-colors" style="border-color: var(--border-dim);">
                <td class="px-5 py-3" style="color: var(--ink-muted);">{ev.date}</td>
                <td class="px-5 py-3 text-white">{ev.work}</td>
                <td class="px-5 py-3" style="color: #7B5CF0;">{eventLabel[ev.event] ?? ev.event}</td>
                <td class="px-5 py-3 text-white">{ev.price}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<OpenNzModal open={!!openItem} item={openItem} onClose={() => (openItem = null)} />
