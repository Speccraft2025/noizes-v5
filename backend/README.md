# Noizes database changes

The repository currently uses reviewed, idempotent SQL scripts rather than a configured local Supabase CLI project.

For a new project, run these files in the Supabase SQL Editor in this order:

1. `supabase_schema.sql`
2. `provenance-resale-2026-07-26.sql`
3. `multi-track-phase-1-2026-07-31.sql`
4. Any later dated hardening scripts not already folded into the base schema

`multi-track-phase-1-2026-07-31.sql` creates the normalized release/track/audio-version/audio-asset foundation and safely converts existing release rows to one-track Singles. It does not change acquisition semantics: an acquisition remains one authenticated copy of a complete release edition.

The SQL is not automatically deployed by the application. Apply it to each Supabase environment before enabling the Phase 2 Studio UI.

## Knowing what has been applied

Every script ends with a footer that records its own filename in
`public.schema_migrations`. To see the state of an environment:

```sql
select filename, applied_at from public.schema_migrations order by applied_at;
```

The ledger was added after the fact. Run `000-backfill-migration-ledger.sql`
**once** per existing environment to record what is already there; it inserts
only where the objects that script creates actually exist, so it records
evidence rather than assumption.

## Checking before you deploy

```bash
cd studio && npm run check:schema
```

Probes every table and column the application needs and exits non-zero if any
are missing, naming the script that supplies them. Needs real credentials, so
it is not part of the PR build — CI has placeholders only. Run it after
applying SQL, before a deploy, or whenever a page looks empty.

## Why this exists

`multi-track-phase-1-2026-07-31.sql` was written at 22:43 on 31 July. Code
requiring it merged at 23:21, shipped, and ran against a database that never
received it. Nothing in the repository, the database, or CI could say so.

It stayed invisible for three days because the Exchange discarded the query
error and rendered the failure as "No releases yet" — a plausible state for a
young catalogue. Schema drift alone is loud; a swallowed error alone is
harmless. Together they produced an outage that looked like normal emptiness.

Applying a script out of order is safe: every script is idempotent, and the
ledger table is created by whichever runs first.
