<script>
  export let status = 'saved';
  export let savedAt = '';

  function timeLabel(value) {
    if (!value) return '';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<span class="save-status" class:save-error={status === 'error'}>
  {#if status === 'restoring'}
    <span class="save-dot save-dot-pulse"></span>
    Restoring…
  {:else if status === 'saving'}
    <span class="save-dot save-dot-pulse"></span>
    Saving…
  {:else if status === 'error'}
    <span class="save-dot save-dot-error"></span>
    Save failed
  {:else}
    <span class="save-dot save-dot-ok"></span>
    Saved as draft{#if savedAt} · {timeLabel(savedAt)}{/if}
  {/if}
</span>

<style>
  .save-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: var(--ink-muted);
    white-space: nowrap;
  }

  .save-error {
    color: #F08A9D;
  }

  .save-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .save-dot-ok {
    background: rgba(127, 224, 184, 0.6);
  }

  .save-dot-error {
    background: #F08A9D;
  }

  .save-dot-pulse {
    background: var(--spectral-violet);
    animation: pulse-dot 1.4s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }
</style>
