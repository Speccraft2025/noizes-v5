<script>
  import { edition, EDITION_TYPES, LIMITED_TYPES, CURRENCIES } from '$lib/stores/package.js';
  $: isLimited = LIMITED_TYPES.includes($edition.edition_type);
</script>

<div class="space-y-5">
  <div>
    <p class="t-caption mb-2">Step 3</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Edition</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">Define the release format and availability.</p>
  </div>

  <div>
    <label class="label-dark">Edition Type *</label>
    <div class="grid grid-cols-2 gap-2">
      {#each EDITION_TYPES as type}
        <button
          type="button"
          class="text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200"
          style={$edition.edition_type === type
            ? 'background: var(--gradient-spectral); color: #fff; border: none; box-shadow: 0 0 20px rgba(123,92,240,0.3);'
            : 'background: rgba(255,255,255,0.03); border: 1px solid var(--border-dim); color: var(--ink-secondary);'}
          on:click={() => edition.update(e => ({ ...e, edition_type: type }))}
        >{type}</button>
      {/each}
    </div>
  </div>

  <div>
    <label class="label-dark" for="edition_name">Edition Name</label>
    <input id="edition_name" class="input-dark" type="text" bind:value={$edition.edition_name} placeholder="e.g. Inaugural Pressing" />
  </div>

  {#if isLimited}
    <div>
      <label class="label-dark" for="edition_size">Edition Size</label>
      <input id="edition_size" class="input-dark" type="number" min="1" bind:value={$edition.edition_size} placeholder="e.g. 100" />
    </div>
  {/if}

  <div class="grid grid-cols-3 gap-3">
    <div class="col-span-2">
      <label class="label-dark" for="price">Price</label>
      <input id="price" class="input-dark" type="number" min="0" step="0.01" bind:value={$edition.price} placeholder="0.00" />
    </div>
    <div>
      <label class="label-dark" for="currency">Currency</label>
      <select id="currency" class="input-dark" bind:value={$edition.currency}>
        {#each CURRENCIES as c}<option value={c}>{c}</option>{/each}
      </select>
    </div>
  </div>

  <div class="flex items-center gap-3">
    <div class="relative">
      <input id="transferable" type="checkbox" bind:checked={$edition.transferable} class="sr-only" />
      <div
        class="w-10 h-5 rounded-full cursor-pointer transition-all duration-200 flex items-center px-0.5"
        style={$edition.transferable ? 'background: var(--gradient-spectral);' : 'background: rgba(255,255,255,0.1);'}
        on:click={() => edition.update(e => ({ ...e, transferable: !e.transferable }))}
      >
        <div class="w-4 h-4 rounded-full bg-white transition-transform duration-200" style={$edition.transferable ? 'transform: translateX(20px);' : ''}></div>
      </div>
    </div>
    <label for="transferable" class="text-sm font-semibold text-white cursor-pointer" on:click={() => edition.update(e => ({ ...e, transferable: !e.transferable }))}>
      Transferable ownership
    </label>
  </div>
</div>
