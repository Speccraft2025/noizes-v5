<script>
  // A 2D read of the terrain the creator just measured: time left to right,
  // frequency bottom to top, brightness elevation. This is the same image the
  // vertex shader samples — not an illustration of it — so what a creator sees
  // here is literally the shape of the land they are about to ship.
  //
  // Landmarks are drawn on it because placing a line "at 1:12, band 60" means
  // nothing without seeing the ridge it lands on.
  import { onDestroy } from 'svelte';

  export let terrain = null;        // Blob (image/png)
  export let art = {};
  export let landmarks = [];
  export let bands = 128;
  export let durationSeconds = 0;   // the track, so a landmark's x is its time

  const PALETTE_TINT = {
    alabaster: [1.00, 0.96, 0.92],
    oxide:     [1.00, 0.80, 0.64],
    frost:     [0.84, 0.92, 1.00],
  };

  let canvas;
  let objectUrl = '';
  let error = '';
  let size = { width: 0, height: 0 };

  $: if (terrain && canvas) draw(terrain, art, landmarks);

  async function draw(blob, direction, placements) {
    error = '';
    try {
      const bitmap = await loadBitmap(blob);
      size = { width: bitmap.width, height: bitmap.height };

      // Draw at the element's own resolution rather than the terrain's: a
      // four-minute track is ~10,000 px wide and would be a 10,000 px canvas.
      const width = canvas.clientWidth || 600;
      const height = 150;
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d', { willReadFrequently: true });
      const scratch = document.createElement('canvas');
      scratch.width = bitmap.width;
      scratch.height = bitmap.height;
      scratch.getContext('2d').drawImage(bitmap, 0, 0);
      const source = scratch.getContext('2d').getImageData(0, 0, bitmap.width, bitmap.height).data;

      const tint = PALETTE_TINT[direction.palette] || PALETTE_TINT.alabaster;
      const heightScale = Number(direction.heightScale) || 1;
      const ridge = Number(direction.ridgeEmphasis) ?? 1;
      const image = context.createImageData(width, height);

      for (let y = 0; y < height; y++) {
        const sy = Math.min(bitmap.height - 1, Math.floor(y * bitmap.height / height));
        for (let x = 0; x < width; x++) {
          const sx = Math.min(bitmap.width - 1, Math.floor(x * bitmap.width / width));
          const from = (sy * bitmap.width + sx) * 4;
          // R is elevation, A is ridge salience — the two channels the eye needs
          // to recognise the landscape. G and B drive material, not shape.
          const elevation = Math.min(1, (source[from] / 255) * heightScale);
          const salience = (source[from + 3] / 255) * ridge;
          const value = Math.min(1, elevation * 0.82 + salience * 0.35);
          const to = (y * width + x) * 4;
          image.data[to] = Math.round(255 * value * tint[0]);
          image.data[to + 1] = Math.round(255 * value * tint[1]);
          image.data[to + 2] = Math.round(255 * value * tint[2]);
          image.data[to + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      // Landmarks, in the same frame of reference: x is time, y is band, and the
      // image is stored with the highest band on row 0.
      context.save();
      for (const [index, landmark] of placements.entries()) {
        const t = durationSeconds > 0 ? landmark.time / durationSeconds : 0;
        const x = Math.round(Math.min(1, Math.max(0, t)) * width);
        const y = Math.round((1 - (landmark.band ?? 0) / Math.max(1, bands - 1)) * height);
        context.strokeStyle = 'rgba(240,75,216,0.95)';
        context.fillStyle = 'rgba(240,75,216,0.95)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.globalAlpha = 0.25;
        context.stroke();
        context.globalAlpha = 1;
        context.beginPath();
        context.arc(x, y, 3.5, 0, Math.PI * 2);
        context.fill();
        context.font = '10px ui-monospace, monospace';
        context.fillText(String(index + 1), x + 6, Math.max(10, y - 5));
      }
      context.restore();
    } catch (cause) {
      error = cause?.message || 'The terrain could not be drawn.';
    }
  }

  async function loadBitmap(blob) {
    if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
    return new Promise((resolve, reject) => {
      const image = new Image();
      objectUrl = URL.createObjectURL(blob);
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The terrain image could not be decoded.'));
      image.src = objectUrl;
    });
  }

  onDestroy(() => { if (objectUrl) URL.revokeObjectURL(objectUrl); });
</script>

<div class="rounded-xl overflow-hidden" style="border: 1px solid var(--border-dim); background:#050505;">
  <canvas bind:this={canvas} class="block w-full" style="height: 150px;" aria-label="The measured terrain, time left to right and frequency bottom to top"></canvas>
</div>
{#if error}
  <p class="text-xs mt-2" style="color:#F0C98A;">{error}</p>
{:else if size.width}
  <p class="text-[11px] mt-2" style="color: var(--ink-muted);">
    {size.width} frames × {size.height} bands · time runs left to right, frequency bottom to top, brightness is elevation
  </p>
{/if}
