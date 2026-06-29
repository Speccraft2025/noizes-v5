<script>
  import { rights, LICENSES } from '$lib/stores/package.js';
  import { identity } from '$lib/stores/package.js';
</script>

<div class="space-y-5">
  <div>
    <p class="t-caption mb-2">Step 4</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Rights</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">Declare ownership, licensing, and credits.</p>
  </div>

  <div>
    <label class="label-dark" for="copyright">Copyright</label>
    <input id="copyright" class="input-dark" type="text" bind:value={$rights.copyright}
      placeholder="© {new Date().getFullYear()} {$identity.artist || 'Artist Name'}" />
  </div>

  <div>
    <label class="label-dark" for="license">License</label>
    <select id="license" class="input-dark" bind:value={$rights.license}>
      {#each LICENSES as l}<option value={l}>{l}</option>{/each}
    </select>
  </div>

  <div>
    <label class="label-dark" for="producer">Producer</label>
    <input id="producer" class="input-dark" type="text" bind:value={$rights.producer} placeholder="Producer name(s)" />
  </div>

  <div>
    <label class="label-dark" for="credits">Credits</label>
    <textarea id="credits" class="input-dark resize-none font-mono text-xs" rows="6" bind:value={$rights.credits}
      placeholder="One credit per line&#10;e.g. Mastering — Studio X&#10;Artwork — Jane Doe"></textarea>
    <p class="mt-2 text-xs" style="color: var(--ink-muted);">One per line — stored as an array in credits.json</p>
  </div>
</div>
