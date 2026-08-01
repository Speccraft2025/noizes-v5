<script>
  import { onMount } from 'svelte';
  import { extras, identity, releaseProject, rights, LICENSES } from '$lib/stores/package.js';
  import { orderedTracks } from '$lib/domain/release.js';
  import { createCreditRecord, mergeFeaturedCreditRecords } from '$lib/domain/credit-records.js';

  const CREDIT_ROLES = [
    'Featured Artist', 'Primary Artist', 'Producer', 'Executive Producer', 'Songwriter',
    'Composer', 'Arranger', 'Performer', 'Mix Engineer', 'Mastering Engineer',
    'Recording Engineer', 'Artwork', 'Photography', 'Creative Director', 'Other',
  ];

  let selectedTrackId = '';
  let creditModalOpen = false;
  let creditForm = null;
  let creditError = '';
  let inviting = false;
  $: tracks = orderedTracks($releaseProject.tracks);
  $: if (!selectedTrackId || !tracks.some((track) => track.track_id === selectedTrackId)) selectedTrackId = tracks[0]?.track_id || '';
  $: selectedTrack = tracks.find((track) => track.track_id === selectedTrackId);
  $: trackRights = $releaseProject.rights.track_rights?.find((entry) => entry.track_id === selectedTrackId) ?? {
    track_id: selectedTrackId,
    master: { rights_holder: '', copyright: '' },
    composition: { rights_holder: '', copyright: '', publisher: '' },
    licence: { type: '', notes: '' },
    authority_confirmed: false,
  };
  $: permissionAssets = [
    ...$releaseProject.release_assets,
    ...$releaseProject.audio_assets,
    ...$releaseProject.track_assets,
    ...($extras.pdfs || []).map((pdf, index) => ({ asset_id: pdf.id || `extra-pdf-${index + 1}`, title: pdf.title, filename: pdf.name, role: 'notes', type: 'document' })),
  ];
  $: creditRecords = Array.isArray($rights.credit_records) ? $rights.credit_records : [];

  onMount(() => {
    releaseProject.update((project) => mergeFeaturedCreditRecords(project));
  });

  function openCredit(record = null) {
    creditError = '';
    creditForm = createCreditRecord(record || {}, {
      releaseId: $releaseProject.release.release_id,
      index: creditRecords.length,
    });
    creditForm = { ...creditForm, track_ids: [...creditForm.track_ids] };
    creditModalOpen = true;
  }

  function closeCredit() {
    creditModalOpen = false;
    creditForm = null;
    creditError = '';
  }

  function updateCreditField(field, value) {
    creditForm = { ...creditForm, [field]: value };
  }

  function toggleCreditTrack(trackId) {
    const selected = new Set(creditForm.track_ids || []);
    if (selected.has(trackId)) selected.delete(trackId);
    else selected.add(trackId);
    updateCreditField('track_ids', [...selected]);
  }

  function storeCredit(record) {
    rights.update((value) => ({
      ...value,
      credit_records: [
        ...(value.credit_records || []).filter((entry) => entry.credit_id !== record.credit_id),
        record,
      ],
    }));
  }

  function saveCredit(close = true) {
    const normalized = createCreditRecord(creditForm, { releaseId: $releaseProject.release.release_id });
    if (!normalized.name || !normalized.role) {
      creditError = 'Add the credit holder’s name and role.';
      return null;
    }
    creditForm = normalized;
    storeCredit(normalized);
    if (close) closeCredit();
    return normalized;
  }

  function removeCredit() {
    if (!creditForm?.credit_id) return;
    rights.update((value) => ({
      ...value,
      credit_records: (value.credit_records || []).filter((entry) => entry.credit_id !== creditForm.credit_id),
    }));
    closeCredit();
  }

  async function inviteCollaborator() {
    const record = saveCredit(false);
    if (!record) return;
    if (!record.email) {
      creditError = 'Add an email address before sending an invitation.';
      return;
    }
    inviting = true;
    creditError = '';
    try {
      const response = await fetch('/studio/collaborators/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: record.email,
          name: record.name,
          role: record.role,
          release_id: $releaseProject.release.release_id,
          credit_id: record.credit_id,
          track_ids: record.track_ids,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || `Invitation failed (${response.status}).`);
      const invitedRecord = {
        ...record,
        invite_status: body.already_registered ? 'already_registered' : 'invited',
        invited_at: body.invited_at,
        collaborator_user_id: body.user_id || record.collaborator_user_id,
      };
      creditForm = invitedRecord;
      storeCredit(invitedRecord);
    } catch (error) {
      creditError = error?.message || 'The collaborator invitation could not be sent.';
    } finally {
      inviting = false;
    }
  }

  function updateReleaseAuthority(confirmed) {
    rights.update((value) => ({ ...value, authority_confirmed: confirmed }));
  }

  function updateAssetPermission(assetId, patch) {
    releaseProject.update((project) => {
      const current = project.rights.asset_permissions?.find((entry) => entry.asset_id === assetId) ?? {
        asset_id: assetId, confirmed: false, basis: '', notes: '',
      };
      return {
        ...project,
        rights: {
          ...project.rights,
          asset_permissions: [
            ...(project.rights.asset_permissions || []).filter((entry) => entry.asset_id !== assetId),
            { ...current, ...patch, asset_id: assetId },
          ],
        },
      };
    });
  }

  function updateTrackRights(patch) {
    releaseProject.update((project) => {
      const current = project.rights.track_rights?.find((entry) => entry.track_id === selectedTrackId) ?? trackRights;
      return {
        ...project,
        rights: {
          ...project.rights,
          track_rights: [
            ...(project.rights.track_rights || []).filter((entry) => entry.track_id !== selectedTrackId),
            { ...current, ...patch, track_id: selectedTrackId },
          ],
        },
      };
    });
  }

  function updateTrack(field, patch) {
    updateTrackRights({ [field]: { ...(trackRights[field] || {}), ...patch } });
  }

  function setInheritance(inherit) {
    releaseProject.update((project) => ({
      ...project,
      tracks: project.tracks.map((track) => track.track_id === selectedTrackId ? { ...track, inherit_release_rights: inherit } : track),
    }));
  }
</script>

<div class="space-y-6">
  <div>
    <p class="t-caption mb-2">Step 8 · Rights, Compile &amp; Publish</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Rights declarations</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">Record release-wide authority, then make any track-specific differences explicit.</p>
  </div>

  <section class="space-y-4">
    <div>
      <p class="t-caption">Release-level rights</p>
      <p class="text-xs mt-1" style="color:var(--ink-muted);">Inherited only where a track says so.</p>
    </div>
    <div>
      <label class="label-dark" for="copyright">Copyright</label>
      <input id="copyright" class="input-dark" type="text" bind:value={$rights.copyright}
        placeholder="© {new Date().getFullYear()} {$identity.artist || 'Artist Name'}" />
    </div>
    <div>
      <label class="label-dark" for="license">License</label>
      <select id="license" class="input-dark" bind:value={$rights.license}>
        {#each LICENSES as license}<option value={license}>{license}</option>{/each}
      </select>
    </div>
    <div>
      <label class="label-dark" for="producer">Producer</label>
      <input id="producer" class="input-dark" type="text" bind:value={$rights.producer} placeholder="Producer name(s)" />
    </div>
    <div class="space-y-3">
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="label-dark">Release credits</p>
          <p class="text-xs" style="color:var(--ink-muted);">Featured artists from Identity and Tracklist are added automatically. Open a record to match it to songs.</p>
        </div>
        <button type="button" class="btn-spectral text-xs shrink-0" on:click={() => openCredit()}>＋ Add credit</button>
      </div>

      {#if creditRecords.length}
        <div class="grid sm:grid-cols-2 gap-3">
          {#each creditRecords as credit (credit.credit_id)}
            {@const linkedTracks = tracks.filter((track) => credit.track_ids?.includes(track.track_id))}
            <button type="button" class="glass rounded-xl p-4 text-left transition-all hover:-translate-y-0.5"
              style="border:1px solid rgba(123,92,240,.2);" on:click={() => openCredit(credit)}>
              <span class="flex items-start justify-between gap-3">
                <span class="min-w-0">
                  <span class="block text-sm font-black text-white truncate">{credit.name || 'Unnamed credit'}</span>
                  <span class="block text-[10px] uppercase tracking-wider mt-1" style="color:#9F8CFF;">{credit.role || 'Role needed'}</span>
                </span>
                <span class="text-xs" style="color:{credit.invite_status === 'invited' || credit.invite_status === 'already_registered' ? '#7FE0B8' : 'var(--ink-muted)'};">
                  {credit.invite_status === 'invited' ? 'Invited' : credit.invite_status === 'already_registered' ? 'Creator' : 'Edit →'}
                </span>
              </span>
              <span class="block text-xs mt-3 truncate" style="color:var(--ink-muted);">
                {#if linkedTracks.length}{linkedTracks.map((track) => track.title || `Track ${track.track_number}`).join(' · ')}{:else}Release-wide · choose tracks{/if}
              </span>
            </button>
          {/each}
        </div>
      {:else}
        <button type="button" class="w-full rounded-xl p-5 text-left" style="border:1px dashed rgba(123,92,240,.3);color:var(--ink-muted);" on:click={() => openCredit()}>
          Add artists, writers, producers, engineers, visual collaborators and other contributors.
        </button>
      {/if}

      <div>
        <label class="label-dark" for="credits">Additional credit notes</label>
        <textarea id="credits" class="input-dark resize-none font-mono text-xs" rows="3" bind:value={$rights.credits}
          placeholder="Legacy or free-form notes&#10;Mastering — Studio X&#10;Artwork — Jane Doe"></textarea>
      </div>
    </div>
    <label class="flex items-start gap-3 rounded-xl p-3" style="background:rgba(123,92,240,.08);border:1px solid rgba(123,92,240,.2);">
      <input class="mt-0.5" type="checkbox" checked={$rights.authority_confirmed === true} on:change={(event) => updateReleaseAuthority(event.currentTarget.checked)} />
      <span>
        <span class="block text-sm font-bold text-white">I confirm my authority to publish this complete release</span>
        <span class="block text-xs mt-1" style="color:var(--ink-muted);">This records your declaration. Noizes does not make an automated legal conclusion.</span>
      </span>
    </label>
  </section>

  {#if tracks.length}
    <section class="space-y-4 border-t pt-6" style="border-color:var(--border-dim);">
      <div>
        <p class="t-caption">Track-level rights</p>
        <p class="text-xs mt-1" style="color:var(--ink-muted);">Required for Compilation differences and available for every release.</p>
      </div>

      <div class="flex gap-2 overflow-x-auto pb-1">
        {#each tracks as track}
          <button type="button" class="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold" style={selectedTrackId === track.track_id
            ? 'background:#7B5CF0;color:white;'
            : 'background:rgba(255,255,255,.05);color:var(--ink-muted);'} on:click={() => selectedTrackId = track.track_id}>
            {track.disc_number}.{track.track_number} {track.title || 'Untitled'}
          </button>
        {/each}
      </div>

      {#if selectedTrack}
        <div class="glass rounded-xl p-4 space-y-4">
          <label class="flex items-start gap-3 rounded-lg p-3" style="background:rgba(255,255,255,.03);">
            <input class="mt-0.5" type="checkbox" checked={selectedTrack.inherit_release_rights} on:change={(event) => setInheritance(event.currentTarget.checked)} />
            <span>
              <span class="block text-sm font-bold text-white">Use release-level rights</span>
              <span class="block text-xs mt-0.5" style="color:var(--ink-muted);">Turn this off when the master, composition, licence, or rights holder differs.</span>
            </span>
          </label>

          {#if !selectedTrack.inherit_release_rights}
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label-dark" for="master-holder">Master rights holder</label>
                <input id="master-holder" class="input-dark" type="text" value={trackRights.master?.rights_holder || ''} on:input={(event) => updateTrack('master', { rights_holder: event.currentTarget.value })} />
              </div>
              <div>
                <label class="label-dark" for="master-copyright">Master copyright</label>
                <input id="master-copyright" class="input-dark" type="text" value={trackRights.master?.copyright || ''} on:input={(event) => updateTrack('master', { copyright: event.currentTarget.value })} />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label-dark" for="composition-holder">Composition rights holder</label>
                <input id="composition-holder" class="input-dark" type="text" value={trackRights.composition?.rights_holder || ''} on:input={(event) => updateTrack('composition', { rights_holder: event.currentTarget.value })} />
              </div>
              <div>
                <label class="label-dark" for="publisher">Publisher</label>
                <input id="publisher" class="input-dark" type="text" value={trackRights.composition?.publisher || ''} on:input={(event) => updateTrack('composition', { publisher: event.currentTarget.value })} />
              </div>
            </div>
            <div>
              <label class="label-dark" for="track-licence">Track licence / permission</label>
              <textarea id="track-licence" class="input-dark resize-none" rows="3" value={trackRights.licence?.notes || ''} on:input={(event) => updateTrack('licence', { notes: event.currentTarget.value })}></textarea>
            </div>
            <label class="flex items-center gap-2 text-xs" style="color:var(--ink-muted);">
              <input type="checkbox" checked={trackRights.authority_confirmed} on:change={(event) => updateTrackRights({ authority_confirmed: event.currentTarget.checked })} />
              I confirm I have authority to include this track and its declared assets.
            </label>
          {/if}
        </div>
      {/if}
    </section>
  {/if}

  {#if permissionAssets.length}
    <section class="space-y-4 border-t pt-6" style="border-color:var(--border-dim);">
      <div>
        <p class="t-caption">Asset permissions</p>
        <p class="text-xs mt-1" style="color:var(--ink-muted);">Declare authority for every master, alternate, stem, image, video and document in the package.</p>
      </div>
      <div class="space-y-2">
        {#each permissionAssets as asset (asset.asset_id)}
          {@const permission = $releaseProject.rights.asset_permissions?.find((entry) => entry.asset_id === asset.asset_id)}
          <div class="glass rounded-xl p-3 grid sm:grid-cols-[minmax(0,1fr)_150px] gap-3 items-center">
            <label class="flex items-start gap-3 min-w-0">
              <input class="mt-0.5" type="checkbox" checked={permission?.confirmed === true} on:change={(event) => updateAssetPermission(asset.asset_id, { confirmed: event.currentTarget.checked })} />
              <span class="min-w-0">
                <span class="block text-sm font-bold text-white truncate">{asset.title || asset.filename || asset.role}</span>
                <span class="block text-[10px] uppercase tracking-wider mt-1" style="color:var(--ink-muted);">{asset.type || 'asset'} · {(asset.role || 'supporting').replaceAll('_', ' ')}</span>
              </span>
            </label>
            <select class="input-dark text-xs" aria-label="Permission basis for {asset.title || asset.filename || asset.role}" value={permission?.basis || ''} on:change={(event) => updateAssetPermission(asset.asset_id, { basis: event.currentTarget.value })}>
              <option value="">Permission basis</option>
              <option value="owned">Owned / created</option>
              <option value="licensed">Licensed</option>
              <option value="commissioned">Commissioned</option>
              <option value="public_domain">Public domain</option>
              <option value="other">Other declaration</option>
            </select>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>

{#if creditModalOpen && creditForm}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" style="background:rgba(0,0,0,.82);backdrop-filter:blur(10px);" role="presentation" on:click={(event) => event.currentTarget === event.target && closeCredit()}>
    <div class="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-5" style="background:#09090c;border:1px solid rgba(123,92,240,.35);box-shadow:0 24px 80px rgba(0,0,0,.6);" role="dialog" aria-modal="true" aria-labelledby="credit-dialog-title">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="t-caption">Release credit record</p>
          <h3 id="credit-dialog-title" class="text-xl font-black text-white mt-1">{creditForm.name || 'Add collaborator'}</h3>
        </div>
        <button type="button" class="w-8 h-8 rounded-full" style="background:rgba(255,255,255,.06);color:var(--ink-muted);" aria-label="Close credit editor" on:click={closeCredit}>×</button>
      </div>

      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="label-dark" for="credit-name">Name *</label>
          <input id="credit-name" class="input-dark" type="text" value={creditForm.name} on:input={(event) => updateCreditField('name', event.currentTarget.value)} placeholder="Person, artist or organisation" />
        </div>
        <div>
          <label class="label-dark" for="credit-role">Role *</label>
          <input id="credit-role" class="input-dark" type="text" list="credit-roles" value={creditForm.role} on:input={(event) => updateCreditField('role', event.currentTarget.value)} placeholder="Featured Artist" />
          <datalist id="credit-roles">{#each CREDIT_ROLES as role}<option value={role}></option>{/each}</datalist>
        </div>
      </div>

      <div>
        <label class="label-dark" for="credit-email">Email invitation</label>
        <input id="credit-email" class="input-dark" type="email" value={creditForm.email} on:input={(event) => updateCreditField('email', event.currentTarget.value)} placeholder="collaborator@example.com" />
        <p class="text-[11px] mt-2" style="color:var(--ink-muted);">Sending grants invite-only access and asks this collaborator to finish a Noizes Creator account. Email is not shown in the collector package.</p>
      </div>

      <div>
        <p class="label-dark">Match this credit to the tracklist</p>
        <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
          {#each tracks as track (track.track_id)}
            <label class="flex items-center gap-3 rounded-lg px-3 py-2.5" style="background:rgba(255,255,255,.035);border:1px solid var(--border-dim);">
              <input type="checkbox" checked={creditForm.track_ids.includes(track.track_id)} on:change={() => toggleCreditTrack(track.track_id)} />
              <span class="font-mono text-[10px]" style="color:#7B5CF0;">{track.disc_number}.{track.track_number}</span>
              <span class="text-sm text-white truncate">{track.title || 'Untitled track'}</span>
            </label>
          {/each}
        </div>
        <p class="text-[11px] mt-2" style="color:var(--ink-muted);">Leave every track unchecked for a release-wide credit.</p>
      </div>

      {#if creditForm.invite_status === 'invited' || creditForm.invite_status === 'already_registered'}
        <div class="rounded-lg px-3 py-2 text-xs" style="background:rgba(60,200,140,.08);border:1px solid rgba(60,200,140,.22);color:#7FE0B8;">
          {creditForm.invite_status === 'invited' ? `Invitation sent to ${creditForm.email}.` : `${creditForm.email} already has an account and now has Creator access.`}
        </div>
      {/if}
      {#if creditError}<p class="text-xs" style="color:#F08A9D;">{creditError}</p>{/if}

      <div class="flex flex-wrap items-center gap-2 pt-2">
        {#if creditRecords.some((record) => record.credit_id === creditForm.credit_id)}
          <button type="button" class="btn-ghost text-xs mr-auto" style="color:#F08A9D;" on:click={removeCredit}>Remove credit</button>
        {:else}<span class="mr-auto"></span>{/if}
        <button type="button" class="btn-ghost text-xs" on:click={() => saveCredit(true)}>Save credit</button>
        <button type="button" class="btn-spectral text-xs" disabled={inviting || !creditForm.email} style={inviting || !creditForm.email ? 'opacity:.45;cursor:not-allowed;' : ''} on:click={inviteCollaborator}>
          {inviting ? 'Sending…' : 'Save & send invite'}
        </button>
      </div>
    </div>
  </div>
{/if}
