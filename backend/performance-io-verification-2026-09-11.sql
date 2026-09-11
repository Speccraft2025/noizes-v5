-- Read-only verification. Run after performance-io-hardening-2026-09-11.sql.
-- EXPLAIN only: this does not execute or manufacture traffic.
explain (costs, verbose)
select id, release_id, owner_id, edition_number
from public.acquisitions where owner_id = gen_random_uuid();

explain (costs, verbose)
select id, status from public.kyc_submissions where user_id = gen_random_uuid();

explain (costs, verbose)
select id, acquisition_id, release_id, offerer_id
from public.offers where offerer_id = gen_random_uuid();

explain (costs, verbose)
select id, reference, status from public.payment_intents where buyer_id = gen_random_uuid();

-- Catalog assertions: zero rows means no unwrapped auth.uid() remains in the
-- optimized policies, and the two sensitive tables have the expected role split.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('kyc_submissions','release_links','releases','acquisitions','payment_intents','collector_notes','offers','release_packages','release_authenticity','drop_analytics')
order by tablename, policyname;
