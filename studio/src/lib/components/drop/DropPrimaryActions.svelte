<script>
  import { createEventDispatcher } from 'svelte';

  // The button's label and enabled state come from the server's availability
  // verdict, never from a local guess. Every action re-authorizes on the
  // server anyway — this component decides what to *offer*, not what to allow.
  export let availability;
  export let busy = false;
  export let message = '';

  const dispatch = createEventDispatcher();

  $: primary = availability.primary;
  $: secondary = availability.secondary;
  $: disabled = primary.disabled || busy;
</script>

<div class="space-y-3">
  <div class="flex flex-col sm:flex-row gap-3">
    <button
      type="button"
      class="btn-spectral flex-1 justify-center py-4 text-base rounded-xl"
      {disabled}
      aria-describedby={availability.note ? 'drop-availability-note' : undefined}
      on:click={() => dispatch('action', primary.action)}
    >
      {busy ? 'Working…' : primary.label}
    </button>

    {#if secondary}
      <button
        type="button"
        class="btn-ghost sm:flex-none justify-center py-4 px-7 text-base rounded-xl"
        on:click={() => dispatch('action', secondary.action)}
      >
        {secondary.label}
      </button>
    {/if}
  </div>

  {#if availability.note}
    <p id="drop-availability-note" class="text-xs" style="color: var(--ink-muted);">{availability.note}</p>
  {/if}

  <!-- aria-live so a screen reader hears the outcome of a checkout attempt
       that only changed a line of text. -->
  <p class="text-xs min-h-[1rem]" style="color: #F08A9D;" role="status" aria-live="polite">{message}</p>

  <p class="text-xs tracking-[0.12em] uppercase font-semibold" style="color: var(--ink-muted);">
    Authentic · Portable · Yours forever
  </p>
</div>
