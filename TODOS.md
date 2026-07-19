# TODOS

## Automated payment/DB reconciliation for the acquire endpoint

**Status (2026-07-19):** Largely built. The acquire flow shipped with idempotency from day one (Paystack, not Daraja): `acquisitions.payment_reference` unique index is the idempotency key; the webhook 500s on insert failure so Paystack retries into idempotent re-fulfillment (`studio/src/lib/server/acquire.js`). Every attempted charge is recorded in `payment_intents`.

**Remaining:** Automated diffing of stuck intents — a periodic query/report for `payment_intents` where `status = 'pending'` and `created_at < now() - interval '1 hour'` (abandoned) and `status = 'needs_reconciliation'` (paid-but-unfulfilled, e.g. sellout race → manual refund). Manual SQL in the Supabase dashboard is fine at current volume.

**Context:** Original scope assumed Daraja (M-Pesa direct); superseded by Paystack (approved 2026-07-19, Spec Music account) which carries M-Pesa as a channel. Design doc: `~/.gstack/projects/Speccraft2025-noizes-v5/speccraftmedialtd.-master-design-20260704-001053.md`.

**Depends on / blocked by:** Nothing blocking; automate before real public volume.

## Automated artist payouts (Paystack subaccounts / split payments)

**What:** Replace manual M-Pesa/bank remittance of the artist's 85% with Paystack split settlement, so each sale routes the artist's share automatically at charge time.

**Why:** The CEO review of the content strategy (2026-07-12, T1) set the bootstrap answer — manual transfer within 7 days of each sale, stated in the one-page artist terms — which is honest at 2–5 artists but is founder toil per sale and a trust risk beyond that.

**Pros:** Removes a per-sale operational task from the sole operator; payout timing becomes contractual rather than personal; strengthens the artist pitch ("you're paid automatically").

**Cons:** Engineering + Paystack feature dependency (KE subaccount/split support unverified) that current volume doesn't justify — deferred deliberately.

**Context:** Lives alongside the acquire endpoint (`studio/src/routes/(app)/exchange/acquire/` once built). The T4b Paystack support ticket (cross-border card acceptance) should also ask about KE subaccount/split availability so this TODO's feasibility is known early. Design doc: `~/.gstack/projects/Speccraft2025-noizes-v5/speccraftmedialtd.-master-design-20260712-075951.md`.

**Effort estimate:** M (human) → S/M with CC. **Priority:** P2.

**Depends on / blocked by:** Acquire endpoint live; Paystack KE split-payment support confirmed. Triggers when artist count or sale volume makes manual remittance painful.
