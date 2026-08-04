<script>
  import { createEventDispatcher } from 'svelte';

  // Cards describe sections the packaged experience actually declares. They
  // are buttons, not links, because opening the experience is an action the
  // page mediates (it counts the open, and it checks entitlement first).
  export let sections = [];
  export let available = true;

  const dispatch = createEventDispatcher();

  const GLYPHS = {
    opening: '◐', tracklist: '≡', lyrics: '¶', story: '❞', gallery: '▦',
    notes: '✎', video: '▶', play: '◇', guide: '➔', credits: '★',
  };
</script>

{#if sections.length}
  <section aria-labelledby="drop-experience-heading" class="space-y-5">
    <div>
      <p class="t-caption mb-1.5">Inside the experience</p>
      <h2 id="drop-experience-heading" class="text-2xl font-black text-white tracking-tight">How it opens</h2>
      <p class="text-sm mt-1.5 max-w-prose" style="color: var(--ink-muted);">
        The experience runs in your browser and, once the package is on your device, without a connection.
      </p>
    </div>

    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {#each sections as section (section.key)}
        <button
          type="button"
          class="glass rounded-xl p-4 text-left transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed"
          disabled={!available}
          on:click={() => dispatch('open', section.anchor)}
        >
          <span class="text-lg block mb-2" style="color: #7B5CF0;" aria-hidden="true">{GLYPHS[section.key] ?? '·'}</span>
          <span class="text-sm font-bold text-white block">
            {section.label}{#if section.count} <span class="font-normal" style="color: var(--ink-muted);">· {section.count}</span>{/if}
          </span>
          <span class="text-xs mt-1 block leading-snug" style="color: var(--ink-muted);">{section.blurb}</span>
        </button>
      {/each}
    </div>

    {#if !available}
      <p class="text-xs" style="color: var(--ink-muted);">
        The experience cannot be opened for this release right now. The package itself is unaffected.
      </p>
    {/if}
  </section>
{/if}
