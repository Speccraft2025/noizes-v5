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
  sizing and integrity, Studio draft persistence, structured collaborator
  credits, viewer Blob resolution, package compilation, and the template↔catalog
  contract.
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

## Studio draft smoke check

Drafts are scoped to the signed-in creator. In a real browser, attach an audio
file and cover, navigate to a later Studio step, wait for the **Saved** marker,
and refresh. The same step, metadata, and selected files must restore. IndexedDB
is authoritative because it can retain `File` objects; localStorage is a
metadata-only recovery copy for restrictive browser modes.

Collaborator invitation unit tests must mock Resend and must not send real
email. Exercise the endpoint against a seeded Supabase project only with a
controlled address. Set `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL` to
test the branded delivery path; without both variables the endpoint uses the
Supabase Auth email provider. Verify that `credits.json`, `rights.json`, and
`archive.json` contain the public name/role/track attribution but never the
collaborator email or invite status.
