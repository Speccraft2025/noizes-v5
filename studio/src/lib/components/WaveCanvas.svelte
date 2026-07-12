<script>
  import { onMount } from 'svelte';

  let canvas;

  onMount(() => {
    const ctx = canvas.getContext('2d');
    let t = 0;
    let animId;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const waves = [
        { amp: 60, freq: 0.004, speed: 0.008, y: h * 0.3,  alpha: 0.12 },
        { amp: 40, freq: 0.006, speed: 0.012, y: h * 0.5,  alpha: 0.09 },
        { amp: 80, freq: 0.003, speed: 0.006, y: h * 0.7,  alpha: 0.07 },
        { amp: 30, freq: 0.008, speed: 0.015, y: h * 0.15, alpha: 0.06 },
        { amp: 50, freq: 0.005, speed: 0.009, y: h * 0.85, alpha: 0.08 },
      ];

      waves.forEach(wave => {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(139, 92, 246, ${wave.alpha})`;
        ctx.lineWidth = 1;
        for (let x = 0; x <= w; x += 3) {
          const y = wave.y + Math.sin(x * wave.freq + t * wave.speed * 100) * wave.amp;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      t += 1;
      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  });
</script>

<canvas
  bind:this={canvas}
  class="fixed inset-0 w-full h-full pointer-events-none"
  style="z-index: 0;"
></canvas>
