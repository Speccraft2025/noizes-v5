import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Logic-level tests only (compile pipeline, stores). Runs through Vite's
// transform pipeline so `?raw` template imports work exactly as in the app.
// Component (.svelte) testing needs @testing-library/svelte — add when needed.
export default defineConfig({
  resolve: {
    alias: {
      // SvelteKit supplies $lib to the app but not to vitest, so a module that
      // used the alias could only be tested by first rewriting its imports.
      // Testability should not dictate how application code refers to itself.
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
