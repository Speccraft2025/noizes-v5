<script>
  export let value = '';
  export let suggestions = [];

  function toggle(genre) {
    const current = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const idx = current.indexOf(genre);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(genre);
    }
    value = current.join(', ');
  }

  function isSelected(genre, val) {
    return val
      .split(',')
      .map((s) => s.trim())
      .includes(genre);
  }
</script>

<div class="genre-chips">
  {#each suggestions as genre}
    <button
      type="button"
      class="genre-chip"
      class:genre-chip-active={isSelected(genre, value)}
      on:click={() => toggle(genre)}
    >
      {genre}
    </button>
  {/each}
</div>

<style>
  .genre-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .genre-chip {
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid var(--border-dim);
    background: rgba(255, 255, 255, 0.03);
    color: var(--ink-secondary);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .genre-chip:hover {
    border-color: var(--border-hover);
    color: #fff;
    background: rgba(255, 255, 255, 0.06);
  }

  .genre-chip-active {
    border-color: var(--spectral-violet);
    background: rgba(123, 92, 240, 0.12);
    color: #fff;
  }

  .genre-chip-active:hover {
    border-color: var(--spectral-violet);
    background: rgba(123, 92, 240, 0.18);
  }
</style>
