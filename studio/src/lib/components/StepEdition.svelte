<script>
  import { edition, CURRENCIES } from '$lib/stores/package.js';
  import { editionErrors } from '$lib/utils/project.js';
  $: errors = editionErrors($edition);
</script>

<div class="space-y-5">
  <div>
    <p class="t-caption mb-2">Step 6</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Edition</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">Define the release format and availability.</p>
  </div>

  <div>
    <label class="label-dark" for="edition_name">Public edition name *</label>
    <input id="edition_name" class="input-dark" type="text" bind:value={$edition.edition_name} placeholder="e.g. Inaugural Pressing" />
  </div>

  <div>
    <label class="label-dark" for="edition_description">Edition description</label>
    <textarea id="edition_description" class="input-dark resize-none" rows="3" bind:value={$edition.edition_description} placeholder="What makes this pressing meaningful?"></textarea>
  </div>

  <div>
    <label class="label-dark" for="edition_size">Fixed supply *</label>
    <input id="edition_size" class="input-dark" type="number" min="1" step="1" bind:value={$edition.edition_size} placeholder="e.g. 100" />
    <p class="text-xs mt-1" style="color: var(--ink-muted);">Supply is permanent after publication. Copies are numbered deterministically.</p>
  </div>

  <div class="grid grid-cols-3 gap-3">
    <div class="col-span-2">
      <label class="label-dark" for="price">Price *</label>
      <input id="price" class="input-dark" type="number" min="0.01" step="0.01" bind:value={$edition.price} placeholder="0.00" />
    </div>
    <div>
      <label class="label-dark" for="currency">Currency</label>
      <select id="currency" class="input-dark" bind:value={$edition.currency}>
        {#each CURRENCIES as c}<option value={c}>{c}</option>{/each}
      </select>
    </div>
  </div>

  {#if errors.length}
    <div class="rounded-xl px-4 py-3 text-xs space-y-1" style="background: rgba(240,75,107,.08); border: 1px solid rgba(240,75,107,.2); color: #F08A9D;">
      {#each errors as error}<p>• {error}</p>{/each}
    </div>
  {/if}

  <div class="flex items-center gap-3">
    <label class="relative cursor-pointer" for="transferable">
      <input id="transferable" type="checkbox" bind:checked={$edition.transferable} class="sr-only peer" />
      <span
        class="w-10 h-5 rounded-full cursor-pointer transition-all duration-200 flex items-center px-0.5"
        style={$edition.transferable ? 'background: var(--gradient-spectral);' : 'background: rgba(255,255,255,0.1);'}
      >
        <span class="w-4 h-4 rounded-full bg-white transition-transform duration-200" style={$edition.transferable ? 'transform: translateX(20px);' : ''}></span>
      </span>
    </label>
    <label for="transferable" class="text-sm font-semibold text-white cursor-pointer">
      Transferable ownership
    </label>
  </div>
</div>
