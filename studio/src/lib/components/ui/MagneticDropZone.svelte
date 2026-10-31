<script>
  import { createEventDispatcher } from 'svelte';

  export let accept = '';
  export let label = 'Drop a file here';
  export let hint = '';
  export let multiple = false;
  export let disabled = false;

  const dispatch = createEventDispatcher();

  let zone;
  let dragging = false;
  let magnetActive = false;
  let magnetX = 0;
  let magnetY = 0;
  let fileInput;

  function handleDragEnter(event) {
    if (disabled) return;
    event.preventDefault();
    dragging = true;
  }

  function handleDragOver(event) {
    if (disabled) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!zone) return;
    const rect = zone.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = (x - cx) / cx;
    const dy = (y - cy) / cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    magnetActive = dist < 1.5;
    magnetX = dx * 8;
    magnetY = dy * 8;
  }

  function handleDragLeave(event) {
    if (zone && !zone.contains(event.relatedTarget)) {
      dragging = false;
      magnetActive = false;
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    dragging = false;
    magnetActive = false;
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length) dispatch('files', multiple ? files : [files[0]]);
  }

  function handleInputChange(event) {
    const files = Array.from(event.currentTarget.files || []);
    if (files.length) dispatch('files', multiple ? files : [files[0]]);
    event.currentTarget.value = '';
  }

  function openPicker() {
    if (!disabled) fileInput?.click();
  }
</script>

<div
  bind:this={zone}
  class="magnetic-zone"
  class:dragging
  class:magnetActive
  class:disabled
  role="button"
  tabindex="0"
  on:dragenter={handleDragEnter}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  on:click={openPicker}
  on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }}}
  style="--mag-x: {magnetX}px; --mag-y: {magnetY}px;"
>
  <div class="magnetic-content" aria-hidden="true">
    <div class="magnetic-icon">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M16 4v18m0 0l-6-6m6 6l6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M4 22v4a2 2 0 002 2h20a2 2 0 002-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <p class="magnetic-label">{label}</p>
    {#if hint}
      <p class="magnetic-hint">{hint}</p>
    {/if}
  </div>

  <div class="magnetic-ring" aria-hidden="true"></div>
  <div class="magnetic-pulse" aria-hidden="true"></div>

  <input
    bind:this={fileInput}
    type="file"
    class="sr-only"
    {accept}
    {multiple}
    {disabled}
    on:change={handleInputChange}
    tabindex="-1"
  />

  <slot />
</div>

<style>
  .magnetic-zone {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 140px;
    padding: 28px 20px;
    border: 1.5px dashed rgba(123, 92, 240, 0.3);
    border-radius: 16px;
    background: rgba(123, 92, 240, 0.03);
    cursor: pointer;
    transition: border-color 0.3s, background 0.3s, transform 0.2s ease;
    overflow: hidden;
    outline: none;
  }

  .magnetic-zone:focus-visible {
    border-color: rgba(123, 92, 240, 0.6);
    box-shadow: 0 0 0 3px rgba(123, 92, 240, 0.15);
  }

  .magnetic-zone:hover {
    border-color: rgba(123, 92, 240, 0.5);
    background: rgba(123, 92, 240, 0.06);
  }

  .magnetic-zone.dragging {
    border-color: rgba(123, 92, 240, 0.7);
    background: rgba(123, 92, 240, 0.08);
    border-style: solid;
  }

  .magnetic-zone.magnetActive {
    transform: translate(var(--mag-x), var(--mag-y)) scale(1.02);
    border-color: #7B5CF0;
    background: rgba(123, 92, 240, 0.12);
  }

  .magnetic-zone.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .magnetic-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .magnetActive .magnetic-content {
    transform: scale(1.05);
  }

  .magnetic-icon {
    color: rgba(123, 92, 240, 0.6);
    transition: color 0.3s, transform 0.3s;
  }

  .dragging .magnetic-icon {
    color: #7B5CF0;
    transform: translateY(-4px);
    animation: iconBounce 0.6s ease infinite;
  }

  .magnetic-label {
    font-size: 0.85rem;
    font-weight: 700;
    color: #fff;
    margin: 0;
  }

  .magnetic-hint {
    font-size: 0.7rem;
    color: var(--ink-muted, rgba(255, 255, 255, 0.4));
    margin: 0;
  }

  .magnetic-ring {
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    border: 2px solid transparent;
    pointer-events: none;
    transition: border-color 0.3s;
  }

  .magnetActive .magnetic-ring {
    border-color: rgba(123, 92, 240, 0.4);
    animation: ringPulse 1s ease infinite;
  }

  .magnetic-pulse {
    position: absolute;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(123, 92, 240, 0.2) 0%, transparent 70%);
    pointer-events: none;
    opacity: 0;
    transform: scale(0);
    transition: opacity 0.3s, transform 0.3s;
  }

  .dragging .magnetic-pulse {
    opacity: 1;
    transform: scale(2);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @keyframes iconBounce {
    0%, 100% { transform: translateY(-4px); }
    50% { transform: translateY(-8px); }
  }

  @keyframes ringPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @media (prefers-reduced-motion: reduce) {
    .magnetic-zone, .magnetic-content, .magnetic-icon, .magnetic-pulse, .magnetic-ring {
      transition: none;
      animation: none;
    }
  }
</style>
