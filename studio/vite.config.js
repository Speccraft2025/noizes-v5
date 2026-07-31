import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  // Three.js is loaded only after the landing-page orb mounts. Its lazy chunk
  // is intentionally larger than the generic warning threshold.
  build: { chunkSizeWarningLimit: 800 },
});
