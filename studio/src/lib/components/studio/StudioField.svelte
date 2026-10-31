<script>
  export let label = '';
  export let hint = '';
  export let error = '';
  export let optional = false;
  export let inline = false;
</script>

<div class="field" class:field-inline={inline} class:field-error={!!error}>
  {#if label}
    <label class="field-label">
      {label}
      {#if optional}<span class="field-optional">Optional</span>{/if}
    </label>
  {/if}
  <div class="field-control">
    <slot />
  </div>
  {#if error}
    <p class="field-message field-message-error">{error}</p>
  {:else if hint}
    <p class="field-message">{hint}</p>
  {/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-inline {
    flex-direction: row;
    align-items: center;
    gap: 16px;
  }

  .field-inline .field-label {
    flex: 0 0 auto;
    min-width: 100px;
  }

  .field-inline .field-control {
    flex: 1;
  }

  .field-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink-secondary);
    letter-spacing: 0.01em;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .field-optional {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--ink-muted);
    letter-spacing: 0.02em;
  }

  .field-control {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-control :global(input),
  .field-control :global(select),
  .field-control :global(textarea) {
    width: 100%;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-dim);
    border-radius: 10px;
    color: #fff;
    font-size: 0.95rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .field-control :global(input:focus),
  .field-control :global(select:focus),
  .field-control :global(textarea:focus) {
    border-color: var(--spectral-violet);
    box-shadow: 0 0 0 3px rgba(123, 92, 240, 0.12);
  }

  .field-control :global(input::placeholder),
  .field-control :global(textarea::placeholder) {
    color: var(--ink-muted);
    opacity: 0.7;
  }

  .field-control :global(select) {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='rgba(255,255,255,0.4)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    padding-right: 36px;
  }

  .field-control :global(select option) {
    background: var(--charcoal);
    color: #fff;
  }

  .field-control :global(textarea) {
    resize: vertical;
    min-height: 100px;
    line-height: 1.5;
  }

  .field-error .field-control :global(input),
  .field-error .field-control :global(select),
  .field-error .field-control :global(textarea) {
    border-color: #F08A9D;
  }

  .field-message {
    font-size: 0.75rem;
    color: var(--ink-muted);
    margin: 0;
    line-height: 1.4;
  }

  .field-message-error {
    color: #F08A9D;
  }

  @media (max-width: 600px) {
    .field-inline {
      flex-direction: column;
      align-items: stretch;
    }

    .field-inline .field-label {
      min-width: 0;
    }
  }
</style>
