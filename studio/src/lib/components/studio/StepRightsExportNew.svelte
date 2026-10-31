<script>
  import FocusedSection from './FocusedSection.svelte';
  import StudioField from './StudioField.svelte';
  import StepExport from '#lib/components/StepExport.svelte';
  import { onMount } from 'svelte';
  import { edition, extras, identity, releaseProject, rights, LICENSES } from '#lib/stores/package.js';
  import { orderedTracks, validateReleaseProject } from '#lib/domain/release.js';
  import { createCreditRecord, mergeFeaturedCreditRecords } from '#lib/domain/credit-records.js';
  import { currentSection, STEPS, markSectionState, nextSection, prevSection } from '#lib/stores/studio-nav.js';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
  const step = STEPS[6];
  const sections = step.sections;

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
  let exportOpen = false;

  $: tracks = orderedTracks($releaseProject.tracks);
  $: if (!selectedTrackId || !tracks.some((t) => t.track_id === selectedTrackId)) selectedTrackId = tracks[0]?.track_id || '';
  $: selectedTrack = tracks.find((t) => t.track_id === selectedTrackId);
  $: trackRights = $releaseProject.rights.track_rights?.find((e) => e.track_id === selectedTrackId) ?? {
    track_id: selectedTrackId, master: { rights_holder: '', copyright: '' },
    composition: { rights_holder: '', copyright: '', publisher: '' },
    licence: { type: '', notes: '' }, authority_confirmed: false,
  };
  $: permissionAssets = [
    ...$releaseProject.release_assets, ...$releaseProject.audio_assets, ...$releaseProject.track_assets,
    ...($extras.pdfs || []).map((pdf, i) => ({ asset_id: pdf.id || `extra-pdf-${i + 1}`, title: pdf.title, filename: pdf.name, role: 'notes', type: 'document' })),
  ];
  $: creditRecords = Array.isArray($rights.credit_records) ? $rights.credit_records : [];
  $: validation = validateReleaseProject($releaseProject);

  onMount(() => {
    releaseProject.update((p) => mergeFeaturedCreditRecords(p));
  });

  function openCredit(record = null) {
    creditError = '';
    creditForm = createCreditRecord(record || {}, { releaseId: $releaseProject.release.release_id, index: creditRecords.length });
    creditForm = { ...creditForm, track_ids: [...creditForm.track_ids] };
    creditModalOpen = true;
  }
  function closeCredit() { creditModalOpen = false; creditForm = null; creditError = ''; }
  function updateCreditField(field, value) { creditForm = { ...creditForm, [field]: value }; }
  function toggleCreditTrack(trackId) {
    const s = new Set(creditForm.track_ids || []);
    if (s.has(trackId)) s.delete(trackId); else s.add(trackId);
    updateCreditField('track_ids', [...s]);
  }
  function storeCredit(record) {
    rights.update((v) => ({ ...v, credit_records: [...(v.credit_records || []).filter((e) => e.credit_id !== record.credit_id), record] }));
  }
  function saveCredit(close = true) {
    const n = createCreditRecord(creditForm, { releaseId: $releaseProject.release.release_id });
    if (!n.name || !n.role) { creditError = 'Add the credit holder\'s name and role.'; return null; }
    creditForm = n; storeCredit(n); if (close) closeCredit(); return n;
  }
  function removeCredit() {
    if (!creditForm?.credit_id) return;
    rights.update((v) => ({ ...v, credit_records: (v.credit_records || []).filter((e) => e.credit_id !== creditForm.credit_id) }));
    closeCredit();
  }
  async function inviteCollaborator() {
    const record = saveCredit(false);
    if (!record) return;
    if (!record.email) { creditError = 'Add an email address before sending an invitation.'; return; }
    inviting = true; creditError = '';
    try {
      const res = await fetch('/studio/collaborators/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: record.email, name: record.name, role: record.role, release_id: $releaseProject.release.release_id, credit_id: record.credit_id, track_ids: record.track_ids }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Invitation failed (${res.status}).`);
      const invited = { ...record, invite_status: body.already_registered ? 'already_registered' : 'invited', invited_at: body.invited_at, collaborator_user_id: body.user_id || record.collaborator_user_id };
      creditForm = invited; storeCredit(invited);
    } catch (e) { creditError = e?.message || 'The collaborator invitation could not be sent.'; }
    finally { inviting = false; }
  }
  function updateReleaseAuthority(confirmed) { rights.update((v) => ({ ...v, authority_confirmed: confirmed })); }
  function updateAssetPermission(assetId, patch) {
    releaseProject.update((p) => {
      const cur = p.rights.asset_permissions?.find((e) => e.asset_id === assetId) ?? { asset_id: assetId, confirmed: false, basis: '', notes: '' };
      return { ...p, rights: { ...p.rights, asset_permissions: [...(p.rights.asset_permissions || []).filter((e) => e.asset_id !== assetId), { ...cur, ...patch, asset_id: assetId }] } };
    });
  }
  function updateTrackRights(patch) {
    releaseProject.update((p) => {
      const cur = p.rights.track_rights?.find((e) => e.track_id === selectedTrackId) ?? trackRights;
      return { ...p, rights: { ...p.rights, track_rights: [...(p.rights.track_rights || []).filter((e) => e.track_id !== selectedTrackId), { ...cur, ...patch, track_id: selectedTrackId }] } };
    });
  }
  function updateTrack(field, patch) { updateTrackRights({ [field]: { ...(trackRights[field] || {}), ...patch } }); }
  function setInheritance(inherit) {
    releaseProject.update((p) => ({ ...p, tracks: p.tracks.map((t) => t.track_id === selectedTrackId ? { ...t, inherit_release_rights: inherit } : t) }));
  }

  function handleContinue() {
    markSectionState(step.id, $currentSection.id, 'complete');
    nextSection();
  }
  function handleBack() { prevSection(); }
  function handlePublish() { exportOpen = true; }

  $: sectionId = $currentSection?.id;
</script>

<!-- Section 1: Rights & credits -->
{#if sectionId === 'rights-credits'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[0].label}
    sectionNumber={1}
    totalSections={sections.length}
    heading={sections[0].heading}
    subtext={sections[0].subtext}
    wide={true}
    on:continue={handleContinue}
    on:back={handleBack}
  >
    <div class="rights-grid">
      <StudioField label="Copyright">
        <input type="text" bind:value={$rights.copyright} placeholder="© {new Date().getFullYear()} {$identity.artist || 'Artist Name'}" />
      </StudioField>
      <StudioField label="License">
        <select bind:value={$rights.license}>
          {#each LICENSES as license}<option value={license}>{license}</option>{/each}
        </select>
      </StudioField>
    </div>

    <StudioField label="Producer" optional>
      <input type="text" bind:value={$rights.producer} placeholder="Producer name(s)" />
    </StudioField>

    <div class="credits-section">
      <div class="credits-header">
        <div>
          <p class="credits-title">Release credits</p>
          <p class="credits-hint">Featured artists from Identity are added automatically.</p>
        </div>
        <button type="button" class="credits-add" on:click={() => openCredit()}>+ Add credit</button>
      </div>

      {#if creditRecords.length}
        <div class="credits-grid">
          {#each creditRecords as credit (credit.credit_id)}
            {@const linked = tracks.filter((t) => credit.track_ids?.includes(t.track_id))}
            <button type="button" class="credit-card" on:click={() => openCredit(credit)}>
              <span class="credit-card-top">
                <span class="credit-card-name">{credit.name || 'Unnamed credit'}</span>
                <span class="credit-card-status" class:credit-card-invited={credit.invite_status === 'invited' || credit.invite_status === 'already_registered'}>
                  {credit.invite_status === 'invited' ? 'Invited' : credit.invite_status === 'already_registered' ? 'Creator' : 'Edit →'}
                </span>
              </span>
              <span class="credit-card-role">{credit.role || 'Role needed'}</span>
              <span class="credit-card-tracks">
                {#if linked.length}{linked.map((t) => t.title || `Track ${t.track_number}`).join(' · ')}{:else}Release-wide{/if}
              </span>
            </button>
          {/each}
        </div>
      {:else}
        <button type="button" class="credits-empty" on:click={() => openCredit()}>
          Add artists, writers, producers, engineers and other contributors.
        </button>
      {/if}
    </div>

    <StudioField label="Additional credit notes" optional>
      <textarea rows="3" bind:value={$rights.credits} placeholder="Legacy or free-form notes&#10;Mastering — Studio X&#10;Artwork — Jane Doe" style="font-family: monospace; font-size: 0.82rem;"></textarea>
    </StudioField>

    <label class="authority-box">
      <input type="checkbox" checked={$rights.authority_confirmed === true} on:change={(e) => updateReleaseAuthority(e.currentTarget.checked)} />
      <span>
        <span class="authority-title">I confirm my authority to publish this complete release</span>
        <span class="authority-note">This records your declaration. Noizes does not make an automated legal conclusion.</span>
      </span>
    </label>

    {#if tracks.length}
      <div class="track-rights-section">
        <p class="section-subtitle">Track-level rights</p>
        <div class="track-pills">
          {#each tracks as track}
            <button type="button" class="track-pill" class:track-pill-active={selectedTrackId === track.track_id} on:click={() => selectedTrackId = track.track_id}>
              {track.disc_number}.{track.track_number} {track.title || 'Untitled'}
            </button>
          {/each}
        </div>

        {#if selectedTrack}
          <div class="track-rights-card">
            <label class="inherit-toggle">
              <input type="checkbox" checked={selectedTrack.inherit_release_rights} on:change={(e) => setInheritance(e.currentTarget.checked)} />
              <span>
                <span class="inherit-title">Use release-level rights</span>
                <span class="inherit-note">Turn off when master, composition or licence differs.</span>
              </span>
            </label>

            {#if !selectedTrack.inherit_release_rights}
              <div class="rights-grid">
                <StudioField label="Master rights holder">
                  <input type="text" value={trackRights.master?.rights_holder || ''} on:input={(e) => updateTrack('master', { rights_holder: e.currentTarget.value })} />
                </StudioField>
                <StudioField label="Master copyright">
                  <input type="text" value={trackRights.master?.copyright || ''} on:input={(e) => updateTrack('master', { copyright: e.currentTarget.value })} />
                </StudioField>
              </div>
              <div class="rights-grid">
                <StudioField label="Composition rights holder">
                  <input type="text" value={trackRights.composition?.rights_holder || ''} on:input={(e) => updateTrack('composition', { rights_holder: e.currentTarget.value })} />
                </StudioField>
                <StudioField label="Publisher">
                  <input type="text" value={trackRights.composition?.publisher || ''} on:input={(e) => updateTrack('composition', { publisher: e.currentTarget.value })} />
                </StudioField>
              </div>
              <StudioField label="Track licence / permission">
                <textarea rows="3" value={trackRights.licence?.notes || ''} on:input={(e) => updateTrack('licence', { notes: e.currentTarget.value })}></textarea>
              </StudioField>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    {#if permissionAssets.length}
      <div class="permissions-section">
        <p class="section-subtitle">Asset permissions</p>
        <p class="section-hint">Declare authority for every file in the package.</p>
        {#each permissionAssets as asset (asset.asset_id)}
          {@const perm = $releaseProject.rights.asset_permissions?.find((e) => e.asset_id === asset.asset_id)}
          <div class="permission-row">
            <label class="permission-check">
              <input type="checkbox" checked={perm?.confirmed === true} on:change={(e) => updateAssetPermission(asset.asset_id, { confirmed: e.currentTarget.checked })} />
              <span>
                <span class="permission-name">{asset.title || asset.filename || asset.role}</span>
                <span class="permission-type">{asset.type || 'asset'} · {(asset.role || 'supporting').replaceAll('_', ' ')}</span>
              </span>
            </label>
            <select class="permission-select" value={perm?.basis || ''} on:change={(e) => updateAssetPermission(asset.asset_id, { basis: e.currentTarget.value })}>
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
    {/if}
  </FocusedSection>
{/if}

<!-- Section 2: Validation -->
{#if sectionId === 'validation'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[1].label}
    sectionNumber={2}
    totalSections={sections.length}
    heading={sections[1].heading}
    subtext={sections[1].subtext}
    on:continue={handleContinue}
    on:back={handleBack}
    continueDisabled={validation.errors.length > 0}
  >
    {#if validation.errors.length}
      <div class="validation-block validation-errors">
        <p class="validation-block-title">Errors — must fix before compiling</p>
        {#each validation.errors as err}<p class="validation-item">• {err}</p>{/each}
      </div>
    {:else}
      <div class="validation-block validation-pass">
        <p class="validation-block-title">All checks passed</p>
        <p class="validation-item">Your release is ready to compile.</p>
      </div>
    {/if}

    {#if validation.warnings.length}
      <div class="validation-block validation-warnings">
        <p class="validation-block-title">Warnings — optional improvements</p>
        {#each validation.warnings as warn}<p class="validation-item">• {warn}</p>{/each}
      </div>
    {/if}
  </FocusedSection>
{/if}

<!-- Section 3: Compile & publish -->
{#if sectionId === 'compile-publish'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[2].label}
    sectionNumber={3}
    totalSections={sections.length}
    heading={sections[2].heading}
    subtext={sections[2].subtext}
    showContinue={false}
    on:back={handleBack}
  >
    <div class="publish-summary">
      <div class="publish-summary-row">
        <span class="publish-label">Title</span>
        <span class="publish-value">{$identity.title || '—'}</span>
      </div>
      <div class="publish-summary-row">
        <span class="publish-label">Artist</span>
        <span class="publish-value">{$identity.artist || '—'}</span>
      </div>
      <div class="publish-summary-row">
        <span class="publish-label">Edition</span>
        <span class="publish-value">{$edition?.edition_name || '—'} · {$edition?.edition_size || '—'} copies</span>
      </div>
      <div class="publish-summary-row">
        <span class="publish-label">Errors</span>
        <span class="publish-value" class:publish-value-ok={!validation.errors.length} class:publish-value-err={validation.errors.length}>{validation.errors.length || 'None'}</span>
      </div>
    </div>

    <button
      type="button"
      class="publish-btn"
      disabled={validation.errors.length > 0}
      on:click={handlePublish}
    >
      Compile & publish to Exchange
    </button>

    {#if validation.errors.length}
      <p class="publish-note">Fix all validation errors before publishing.</p>
    {/if}

    {#if exportOpen}
      <div class="export-panel">
        <StepExport on:published={() => dispatch('published')} />
      </div>
    {/if}
  </FocusedSection>
{/if}

<!-- Credit modal -->
{#if creditModalOpen && creditForm}
  <div class="modal-backdrop" role="presentation" on:click={(e) => e.currentTarget === e.target && closeCredit()}>
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div>
          <p class="modal-context">Release credit record</p>
          <h3 class="modal-title">{creditForm.name || 'Add collaborator'}</h3>
        </div>
        <button type="button" class="modal-close" on:click={closeCredit}>×</button>
      </div>

      <div class="modal-grid">
        <StudioField label="Name">
          <input type="text" value={creditForm.name} on:input={(e) => updateCreditField('name', e.currentTarget.value)} placeholder="Person, artist or organisation" />
        </StudioField>
        <StudioField label="Role">
          <input type="text" list="credit-roles-list" value={creditForm.role} on:input={(e) => updateCreditField('role', e.currentTarget.value)} placeholder="Featured Artist" />
          <datalist id="credit-roles-list">{#each CREDIT_ROLES as r}<option value={r}></option>{/each}</datalist>
        </StudioField>
      </div>

      <StudioField label="Email invitation" optional>
        <input type="email" value={creditForm.email} on:input={(e) => updateCreditField('email', e.currentTarget.value)} placeholder="collaborator@example.com" />
      </StudioField>
      <p class="modal-hint">Sending grants invite-only access. Email is not shown in the package.</p>

      <div class="modal-tracks">
        <p class="modal-tracks-label">Match to tracklist</p>
        <div class="modal-tracks-list">
          {#each tracks as track (track.track_id)}
            <label class="modal-track-item">
              <input type="checkbox" checked={creditForm.track_ids.includes(track.track_id)} on:change={() => toggleCreditTrack(track.track_id)} />
              <span class="modal-track-num">{track.disc_number}.{track.track_number}</span>
              <span class="modal-track-name">{track.title || 'Untitled'}</span>
            </label>
          {/each}
        </div>
        <p class="modal-hint">Leave unchecked for a release-wide credit.</p>
      </div>

      {#if creditForm.invite_status === 'invited' || creditForm.invite_status === 'already_registered'}
        <div class="modal-success">
          {creditForm.invite_status === 'invited' ? `Invitation sent to ${creditForm.email}.` : `${creditForm.email} already has an account.`}
        </div>
      {/if}
      {#if creditError}<p class="modal-error">{creditError}</p>{/if}

      <div class="modal-actions">
        {#if creditRecords.some((r) => r.credit_id === creditForm.credit_id)}
          <button type="button" class="modal-action-remove" on:click={removeCredit}>Remove credit</button>
        {:else}<span></span>{/if}
        <div class="modal-action-group">
          <button type="button" class="modal-action-save" on:click={() => saveCredit(true)}>Save credit</button>
          <button type="button" class="modal-action-invite" disabled={inviting || !creditForm.email} on:click={inviteCollaborator}>
            {inviting ? 'Sending…' : 'Save & send invite'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .rights-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .export-panel { margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border-dim); }
  .section-subtitle { font-size: 0.82rem; font-weight: 700; color: var(--ink-secondary); margin: 0 0 8px; letter-spacing: 0.02em; }
  .section-hint { font-size: 0.72rem; color: var(--ink-muted); margin: 0 0 12px; }

  .credits-section { display: flex; flex-direction: column; gap: 12px; }
  .credits-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .credits-title { font-size: 0.82rem; font-weight: 700; color: var(--ink-secondary); margin: 0; }
  .credits-hint { font-size: 0.72rem; color: var(--ink-muted); margin: 4px 0 0; }
  .credits-add {
    background: var(--spectral-violet); border: none; border-radius: 8px;
    color: #fff; font-size: 0.78rem; font-weight: 700; padding: 8px 16px; cursor: pointer; white-space: nowrap;
    transition: opacity 0.2s;
  }
  .credits-add:hover { opacity: 0.88; }

  .credits-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .credit-card {
    display: flex; flex-direction: column; gap: 6px; padding: 16px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(123,92,240,0.2); border-radius: 12px;
    cursor: pointer; text-align: left; transition: transform 0.15s;
  }
  .credit-card:hover { transform: translateY(-2px); }
  .credit-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .credit-card-name { font-size: 0.85rem; font-weight: 800; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .credit-card-status { font-size: 0.72rem; color: var(--ink-muted); white-space: nowrap; }
  .credit-card-invited { color: #7FE0B8; }
  .credit-card-role { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em; color: #9F8CFF; font-weight: 600; }
  .credit-card-tracks { font-size: 0.72rem; color: var(--ink-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .credits-empty {
    width: 100%; padding: 20px; text-align: left; border: 1px dashed rgba(123,92,240,0.3); border-radius: 12px;
    background: none; color: var(--ink-muted); font-size: 0.85rem; cursor: pointer;
  }

  .authority-box {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 14px 16px; border-radius: 12px;
    background: rgba(123,92,240,0.08); border: 1px solid rgba(123,92,240,0.2); cursor: pointer;
  }
  .authority-box input { margin-top: 2px; }
  .authority-title { display: block; font-size: 0.88rem; font-weight: 700; color: #fff; }
  .authority-note { display: block; font-size: 0.72rem; color: var(--ink-muted); margin-top: 4px; }

  .track-rights-section { display: flex; flex-direction: column; gap: 12px; padding-top: 20px; border-top: 1px solid var(--border-dim); }
  .track-pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .track-pill {
    padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border-dim);
    background: rgba(255,255,255,0.03); color: var(--ink-muted); font-size: 0.78rem; font-weight: 700;
    cursor: pointer; transition: all 0.2s; white-space: nowrap;
  }
  .track-pill:hover { border-color: var(--border-hover); color: #fff; }
  .track-pill-active { background: var(--spectral-violet); color: #fff; border-color: var(--spectral-violet); }
  .track-rights-card {
    display: flex; flex-direction: column; gap: 14px;
    padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-dim); border-radius: 12px;
  }
  .inherit-toggle { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 10px; cursor: pointer; }
  .inherit-toggle input { margin-top: 3px; }
  .inherit-title { display: block; font-size: 0.85rem; font-weight: 700; color: #fff; }
  .inherit-note { display: block; font-size: 0.7rem; color: var(--ink-muted); margin-top: 2px; }

  .permissions-section { display: flex; flex-direction: column; gap: 8px; padding-top: 20px; border-top: 1px solid var(--border-dim); }
  .permission-row {
    display: grid; grid-template-columns: 1fr 150px; gap: 12px; align-items: center;
    padding: 12px 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-dim); border-radius: 10px;
  }
  .permission-check { display: flex; align-items: flex-start; gap: 10px; min-width: 0; cursor: pointer; }
  .permission-check input { margin-top: 3px; }
  .permission-name { display: block; font-size: 0.85rem; font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .permission-type { display: block; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-muted); margin-top: 2px; }
  .permission-select {
    padding: 6px 8px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-dim); border-radius: 8px;
    color: var(--ink-secondary); font-size: 0.75rem; font-family: inherit; outline: none;
  }
  .permission-select option { background: var(--charcoal); color: #fff; }

  .validation-block { padding: 16px 20px; border-radius: 12px; }
  .validation-block-title { font-size: 0.82rem; font-weight: 700; margin: 0 0 8px; }
  .validation-item { font-size: 0.82rem; margin: 4px 0; }
  .validation-errors { background: rgba(240,75,107,0.08); border: 1px solid rgba(240,75,107,0.2); color: #F08A9D; }
  .validation-errors .validation-block-title { color: #F08A9D; }
  .validation-pass { background: rgba(127,224,184,0.08); border: 1px solid rgba(127,224,184,0.2); color: #7FE0B8; }
  .validation-pass .validation-block-title { color: #7FE0B8; }
  .validation-warnings { background: rgba(255,200,100,0.06); border: 1px solid rgba(255,200,100,0.15); color: rgba(255,200,100,0.85); }
  .validation-warnings .validation-block-title { color: rgba(255,200,100,0.85); }

  .publish-summary { display: flex; flex-direction: column; gap: 2px; }
  .publish-summary-row { display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(255,255,255,0.02); border-radius: 10px; }
  .publish-label { font-size: 0.85rem; font-weight: 600; color: #fff; }
  .publish-value { font-size: 0.85rem; color: var(--ink-secondary); }
  .publish-value-ok { color: #7FE0B8; }
  .publish-value-err { color: #F08A9D; }
  .publish-btn {
    width: 100%; padding: 18px 24px; background: var(--spectral-violet); border: none; border-radius: 14px;
    color: #fff; font-size: 1rem; font-weight: 800; cursor: pointer;
    box-shadow: 0 0 48px rgba(123,92,240,0.3); transition: opacity 0.2s, transform 0.15s;
  }
  .publish-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
  .publish-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .publish-note { font-size: 0.78rem; color: var(--ink-muted); text-align: center; margin: 8px 0 0; }

  /* Modal */
  .modal-backdrop { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0,0,0,0.82); backdrop-filter: blur(10px); }
  .modal {
    width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto;
    padding: 28px; border-radius: 20px; display: flex; flex-direction: column; gap: 18px;
    background: #09090c; border: 1px solid rgba(123,92,240,0.35); box-shadow: 0 24px 80px rgba(0,0,0,0.6);
  }
  .modal-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .modal-context { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.06em; color: var(--spectral-violet); text-transform: uppercase; margin: 0; }
  .modal-title { font-size: 1.2rem; font-weight: 900; color: #fff; margin: 4px 0 0; }
  .modal-close {
    width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.06); border: none; color: var(--ink-muted); font-size: 1rem; cursor: pointer;
  }
  .modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .modal-hint { font-size: 0.68rem; color: var(--ink-muted); margin: 0; }
  .modal-tracks { display: flex; flex-direction: column; gap: 8px; }
  .modal-tracks-label { font-size: 0.82rem; font-weight: 600; color: var(--ink-secondary); margin: 0; }
  .modal-tracks-list { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
  .modal-track-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; background: rgba(255,255,255,0.035); border: 1px solid var(--border-dim); border-radius: 10px; cursor: pointer;
  }
  .modal-track-num { font-size: 0.68rem; font-weight: 700; color: var(--spectral-violet); font-family: monospace; }
  .modal-track-name { font-size: 0.85rem; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .modal-success { padding: 10px 14px; border-radius: 10px; font-size: 0.78rem; background: rgba(60,200,140,0.08); border: 1px solid rgba(60,200,140,0.22); color: #7FE0B8; }
  .modal-error { font-size: 0.78rem; color: #F08A9D; margin: 0; }
  .modal-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 8px; }
  .modal-action-remove { background: none; border: none; font-size: 0.78rem; color: #F08A9D; cursor: pointer; padding: 6px 10px; }
  .modal-action-group { display: flex; gap: 8px; }
  .modal-action-save {
    padding: 10px 18px; background: rgba(255,255,255,0.06); border: 1px solid var(--border-dim); border-radius: 10px;
    color: var(--ink-secondary); font-size: 0.82rem; font-weight: 600; cursor: pointer;
  }
  .modal-action-invite {
    padding: 10px 18px; background: var(--spectral-violet); border: none; border-radius: 10px;
    color: #fff; font-size: 0.82rem; font-weight: 700; cursor: pointer;
  }
  .modal-action-invite:disabled { opacity: 0.45; cursor: not-allowed; }

  @media (max-width: 600px) {
    .rights-grid { grid-template-columns: 1fr; }
    .credits-grid { grid-template-columns: 1fr; }
    .modal-grid { grid-template-columns: 1fr; }
    .permission-row { grid-template-columns: 1fr; gap: 8px; }
  }
</style>
