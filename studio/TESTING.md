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
  Current coverage: `experience.test.js` — play-block injection, config
  replacement, theme application, and the template↔catalog contract (every
  game the Studio offers must exist in the ULTRA template engine).
- **Component** — not set up yet; add `@testing-library/svelte` when a
  Svelte component needs behavioral tests.
- **E2E** — manual for now (auth-gated app). Candidate: Playwright against
  a seeded local Supabase.

## Conventions

- Test files: `<module>.test.js` colocated with the module.
- Test real behavior with meaningful assertions — never `toBeDefined()` filler.
- When fixing a bug, add a regression test in the same commit.
- When adding a conditional, test both paths.
- Never commit code that makes existing tests fail.
