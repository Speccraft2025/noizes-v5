# TODOS

## Provenance + resale — remaining pieces (v0.2.0.0, 2026-07-26)

The record layer (signed hash-chained provenance, Living Record, Collector Notes,
portable `provenance.json` export, stewardship language) and the resale offer flow
(offer book, accept, resale checkout, custody transfer with 85% artist royalty
recorded) shipped. Migration: `backend/provenance-resale-2026-07-26.sql` (must be
run against Supabase; also requires `SIGNING_KEK` already used by creator signing).

**Remaining / deferred:**
- **Secondary-market browse (buyer discovery).** Buyers can pay/withdraw their own
  offers and owners can accept from the collection page, but there is no page that
  lists editions currently `accepting_offers` for a buyer to *find* and offer on.
  Add a per-edition secondary listing. P1 for a usable resale loop.
- **Offline provenance verifier UI.** Export is live (`/provenance/[releaseId]/[edition]`);
  the standalone self-contained verifier (drag-drop a `provenance.json`, checks the
  chain offline against the registry key) is not built yet. `verifyChain` /
  `buildProvenanceDocument` in `studio/src/lib/server/provenance.js` are the reusable
  core. P2.
- **Collector-note moderation UI.** `collector_notes.status` supports 'hidden' at the
  DB level; there is no admin control to hide an abusive note. A folded note is
  immutable in the signed chain (hiding suppresses on-platform display only). Decide
  policy + build the control before notes go public. P1 (abuse surface).
- **Automated resale royalty payout.** `resale.js` records the 85/15 split in
  `payment_intents.paystack_data` and logs it; payout is manual, same as primary
  sales. Fold into the Paystack split-settlement TODO below.
- **Genesis provenance for pre-existing acquisitions.** Chains open on new primary
  sales only. Editions acquired before this migration have no chain until first
  transfer. Backfill a 'created'+'acquired' pair per existing acquisition if their
  history should be visible. P2.


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
