# Production diagnostic query log — 2026-09-11

Project: `rvuwfvbbssubusiuepld`. PostgreSQL statistics were not reset. No data-changing diagnostic query or load test was run.

1. Pre-change targeted catalog check: queried `pg_constraint`, `pg_index`, `pg_attribute`, and `pg_policies` only for the 17 locally identified Noizes tables. It returned the policy definitions and whether each foreign key had a valid, non-partial leading-column index. Result: exactly 19 unsupported foreign keys and the legacy row-by-row/overlapping policies described in the migration.
2. Post-change verification + `EXPLAIN` (without `ANALYZE`): queried cache totals, active sessions older than 30 seconds, unwrapped `auth.uid()` policy expressions, unsupported public foreign keys, then explained owner lookups on `acquisitions`, `kyc_submissions`, and `payment_intents`. The connector returned only the final `EXPLAIN` result from the multi-statement request, so the summary row was not observable.
3. Post-change summary retry: repeated only the unreturned summary projection from step 2. Result: table cache hit 86.88%, index cache hit 98.66%, zero active queries older than 30 seconds, zero unoptimized `auth.uid()` policies, and zero unsupported public foreign keys.
4. RLS administrator check: inside a rolled-back transaction, set the authenticated JWT claim to an existing administrator and selected `kyc_submissions`. Result: the administrator fixture was visible and the SELECT was allowed.
5. RLS owner/non-owner check: inside a rolled-back transaction, selected a non-admin KYC owner when available, assumed that authenticated identity, and counted visible owner versus non-owner rows. This small database had no matching owner fixture; both counts were zero, so non-owner denial was confirmed but positive owner visibility remains fixture-limited.
6. RLS anonymous check: inside a rolled-back transaction, assumed `anon` and counted visible KYC rows. Result: zero rows.
7. Post-deploy smoke fixture lookup: selected one published release and its latest acquisition using the release ID relationship. Result: found an existing limited-edition acquisition suitable for a positive owner check; no row was changed.
8. Positive owner RLS check: inside a rolled-back transaction, assumed the existing acquisition owner's authenticated JWT identity and selected that acquisition by ID. Result: exactly one row was visible and its `owner_id` matched `auth.uid()`.
9. Immediate post-deploy health baseline: queried aggregate table/index cache hits, database temporary-file counters, and active sessions older than 30 seconds. Result: table cache 87.99%, index cache 98.14%, zero temp files/bytes, and zero long-running queries.

The exact reusable post-change statements are in `performance-io-verification-2026-09-11.sql`. The pre-change query was intentionally not made an application script: it was a one-time, targeted catalog comparison against the local schema and must not become startup introspection.
