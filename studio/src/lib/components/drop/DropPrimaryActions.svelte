<script>
  import { createEventDispatcher } from 'svelte';
  import TactileButton from '#lib/components/ui/TactileButton.svelte';

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
    <div class="flex-1">
      <TactileButton
        variant="spectral"
        size="lg"
        {disabled}
        on:click={() => dispatch('action', primary.action)}
      >
        {busy ? 'Working…' : primary.label}
      </TactileButton>
    </div>

    {#if secondary}
      <div class="sm:flex-none">
        <TactileButton
          variant="ghost"
          size="md"
          on:click={() => dispatch('action', secondary.action)}
        >
          {secondary.label}
        </TactileButton>
      </div>
    {/if}
  </div>

  {#if availability.note}
    <p id="drop-availability-note" class="text-xs" style="color: var(--ink-muted);">{availability.note}</p>
  {/if}

  <p class="text-xs min-h-[1rem]" style="color: #F08A9D;" role="status" aria-live="polite">{message}</p>

  <p class="text-xs tracking-[0.12em] uppercase font-semibold" style="color: var(--ink-muted);">
    Authentic · Portable · Yours forever
  </p>
</div>
