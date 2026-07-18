import { defineConfig } from 'vitest/config';

// Logic-level tests only (compile pipeline, stores). Runs through Vite's
// transform pipeline so `?raw` template imports work exactly as in the app.
// Component (.svelte) testing needs @testing-library/svelte — add when needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
