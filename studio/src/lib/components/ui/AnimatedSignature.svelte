<script>
  import { onMount } from 'svelte';

  export let name = '';
  export let color = '#7B5CF0';
  export let strokeWidth = 2;
  export let duration = 1.8;
  export let delay = 0.3;

  let svg;
  let drawn = false;
  let paths = [];

  function generateSignaturePath(text) {
    if (!text) return [];
    const segments = [];
    let x = 20;
    const y = 50;
    const chars = text.split('');

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const w = char === ' ' ? 8 : 12 + Math.random() * 6;
      const h = 15 + Math.random() * 10;
      const sway = (Math.random() - 0.5) * 6;

      if (char === ' ') {
        x += w;
        continue;
      }

      const cp1x = x + w * 0.3;
      const cp1y = y - h + sway;
      const cp2x = x + w * 0.7;
      const cp2y = y + h * 0.3 + sway;
      const endx = x + w;
      const endy = y + (Math.random() - 0.5) * 4;

      segments.push(`M${x},${y} C${cp1x},${cp1y} ${cp2x},${cp2y} ${endx},${endy}`);
      x = endx + 2;
    }

    const underlineEnd = x + 15;
    segments.push(`M${20},${y + 12} Q${x / 2},${y + 8} ${underlineEnd},${y + 14}`);

    return segments;
  }

  $: paths = generateSignaturePath(name);
  $: viewWidth = Math.max(200, (name?.length || 5) * 16 + 60);

  onMount(() => {
    const timer = setTimeout(() => { drawn = true; }, delay * 1000);
    return () => clearTimeout(timer);
  });
</script>

<div class="signature-wrapper" class:drawn>
  <svg
    bind:this={svg}
    viewBox="0 0 {viewWidth} 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Signature of {name}"
    role="img"
  >
    {#each paths as d, i}
      <path
        {d}
        stroke={color}
        stroke-width={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
        class="sig-path"
        style="
          --delay: {delay + (i * duration / paths.length)}s;
          --duration: {duration / paths.length}s;
        "
      />
    {/each}
  </svg>
</div>

<style>
  .signature-wrapper {
    display: inline-block;
    width: 100%;
    max-width: 300px;
  }

  svg {
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .sig-path {
    stroke-dasharray: 500;
    stroke-dashoffset: 500;
    opacity: 0;
  }

  .drawn .sig-path {
    opacity: 1;
    stroke-dashoffset: 0;
    transition:
      stroke-dashoffset var(--duration) cubic-bezier(0.4, 0, 0.2, 1) var(--delay),
      opacity 0.15s ease var(--delay);
  }

  @media (prefers-reduced-motion: reduce) {
    .sig-path {
      stroke-dasharray: none;
      stroke-dashoffset: 0;
      opacity: 1;
    }
    .drawn .sig-path { transition: none; }
  }
</style>
