<script>
  import { identity, releaseProject, rights, LICENSES } from '$lib/stores/package.js';
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
</div>
