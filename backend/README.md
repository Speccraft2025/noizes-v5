# Noizes database changes

The repository currently uses reviewed, idempotent SQL scripts rather than a configured local Supabase CLI project.

For a new project, run these files in the Supabase SQL Editor in this order:

1. `supabase_schema.sql`
2. `provenance-resale-2026-07-26.sql`
3. `multi-track-phase-1-2026-07-31.sql`
4. Any later dated hardening scripts not already folded into the base schema

`multi-track-phase-1-2026-07-31.sql` creates the normalized release/track/audio-version/audio-asset foundation and safely converts existing release rows to one-track Singles. It does not change acquisition semantics: an acquisition remains one authenticated copy of a complete release edition.

The SQL is not automatically deployed by the application. Apply it to each Supabase environment before enabling the Phase 2 Studio UI.
