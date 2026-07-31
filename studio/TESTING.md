# Testing — Noizes Studio

Tests let you move fast and trust changes to the code that builds collector
packages. The compile pipeline (`experience.js`, `packager.js`) is
revenue-bearing: every regression there ships inside a sold artifact.

## Framework

- **vitest** (config: `vitest.config.js`, node environment)
- Runs through Vite's transform pipeline, so `?raw` template imports behave
  exactly as in the app.

## Run

```bash
npm test          # vitest run (CI mode)
npx vitest        # watch mode
```

## Layers

- **Unit (logic)** — `src/**/*.test.js` next to the module under test.
  Current coverage includes release/track normalization and validation,
  playback, Journey synchronization, Archive/History projections, package
  sizing and integrity, viewer Blob resolution, package compilation, and the
  template↔catalog contract.
- **Component** — not set up yet; add `@testing-library/svelte` when a
  Svelte component needs behavioral tests.
- **E2E** — browser smoke coverage is manual for the auth-gated Studio. `/open`
  and the installed offline viewer should both be exercised with a normalized
  `.nz`; publishing requires a seeded local Supabase.

## Conventions

- Test files: `<module>.test.js` colocated with the module.
- Test real behavior with meaningful assertions — never `toBeDefined()` filler.
- When fixing a bug, add a regression test in the same commit.
- When adding a conditional, test both paths.
- Never commit code that makes existing tests fail.
