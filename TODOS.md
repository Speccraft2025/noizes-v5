# TODOS

## Automated payment/DB reconciliation for the acquire endpoint

**What:** Retry the `acquisitions` insert with an idempotency key tied to the Daraja (M-Pesa) transaction ID if the first insert fails after payment is already confirmed.

**Why:** Prevents a real buyer paying with no ownership record created. Acceptable to handle manually (log + manual fix) at 2-3 test artists; not acceptable once real production Daraja credentials and real public users are live.

**Pros:** Closes a real money-with-no-record gap; makes the acquire flow production-safe.

**Cons:** Extra complexity (idempotency key plumbing, retry logic) not justified at current test volume — deferred deliberately, not an oversight.

**Context:** Lives in `studio/src/routes/(app)/exchange/acquire/+server.js` once the acquire endpoint is built (see design doc: `~/.gstack/projects/Speccraft2025-noizes-v5/speccraftmedialtd.-master-design-20260704-001053.md`, and its `/plan-eng-review` pass). Decided during eng review (D4): log + manual reconciliation for the sandbox-scale test, this TODO before switching to production Daraja credentials.

**Depends on / blocked by:** Nothing blocking; should land before the production-credentials switch, not before the sandbox test.

## Automated artist payouts (Paystack subaccounts / split payments)

**What:** Replace manual M-Pesa/bank remittance of the artist's 85% with Paystack split settlement, so each sale routes the artist's share automatically at charge time.

**Why:** The CEO review of the content strategy (2026-07-12, T1) set the bootstrap answer — manual transfer within 7 days of each sale, stated in the one-page artist terms — which is honest at 2–5 artists but is founder toil per sale and a trust risk beyond that.

**Pros:** Removes a per-sale operational task from the sole operator; payout timing becomes contractual rather than personal; strengthens the artist pitch ("you're paid automatically").

**Cons:** Engineering + Paystack feature dependency (KE subaccount/split support unverified) that current volume doesn't justify — deferred deliberately.

**Context:** Lives alongside the acquire endpoint (`studio/src/routes/(app)/exchange/acquire/` once built). The T4b Paystack support ticket (cross-border card acceptance) should also ask about KE subaccount/split availability so this TODO's feasibility is known early. Design doc: `~/.gstack/projects/Speccraft2025-noizes-v5/speccraftmedialtd.-master-design-20260712-075951.md`.

**Effort estimate:** M (human) → S/M with CC. **Priority:** P2.

**Depends on / blocked by:** Acquire endpoint live; Paystack KE split-payment support confirmed. Triggers when artist count or sale volume makes manual remittance painful.
