<script>
  import { extras, identity, releaseProject, rights, LICENSES } from '$lib/stores/package.js';
  import { orderedTracks } from '$lib/domain/release.js';

  let selectedTrackId = '';
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
    <div>
      <label class="label-dark" for="credits">Release credits</label>
      <textarea id="credits" class="input-dark resize-none font-mono text-xs" rows="5" bind:value={$rights.credits}
        placeholder="One credit per line&#10;Mastering — Studio X&#10;Artwork — Jane Doe"></textarea>
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
