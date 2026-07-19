# Changelog

All notable changes to Noizes are documented here.
Version format: MAJOR.MINOR.PATCH.MICRO — dates are YYYY-MM-DD.

## [0.1.1.0] - 2026-07-20

### Added
- **KYC verification flow (complete)** — the missing UI layers found during the pressing #1 launch:
  - `/verify`: identity submission form (name, country, ID type/number, ID photo + selfie) with approved/pending/rejected states and resubmission after rejection
  - `/admin/kyc`: review queue with signed-URL document previews, approve/reject (+required reason shown to the artist), double-review protection
  - Admin dashboard KYC-queue stat card + nav link
- `$lib/server/kyc.js`: shared validation helpers (`validateKycFields`, `canSubmitKyc`, `safeFileExt`) with full test coverage (68 tests total)

### Fixed
- `/verify` no longer 500s (the page component never existed); logged-out visits redirect to login
- KYC uploads: user-supplied file extensions sanitized before building storage paths; 5MB combined size guard (Netlify body cap)

## [0.1.0.0] - 2026-07-19

### Added
- **Buy pressings with real money** — the exchange's Acquire button now runs a full Paystack checkout (cards + M-Pesa, KES): payment intent → hosted checkout → signature-verified webhook fulfillment with automatic edition numbering, duplicate-payment protection, and a confirmation page showing your edition number. Artist payouts remain manual per current terms.
- **Playable experiences** — releases can bundle up to nine beat-synced games (Bloom, Comet, Pulse, Serpent, Glide, Apex, Barrels, Clash, Rush) with a Games step in the studio wizard, difficulty/intensity controls, and a Games tab inside the exported player. Packages without games are byte-identical to before.
- **NZ experience schema v0.2** — experience.json with score actions, presets, and the resources carve-out; canonical content-hash module staged for publish-side verification.
- **Invite-only access** — accounts can only be created for invited emails, enforced at the database level; every session re-checks membership, and admins manage invites from the waitlist screen with safe re-invite and role assignment.
- Vitest test framework with CI: 56 tests across the compile pipeline, payment helpers, and fulfillment logic.

### Changed
- Admin user management (role changes, admin toggle, delete) now works reliably and revokes the deleted user's invite.
- Sign-in page explains exactly why a sign-in failed (not invited, expired link) instead of showing a bare form; Google sign-in removed in favor of invited email flow.

### Fixed
- Exported packages can no longer be broken out of via crafted artist/lyric text (script-injection hardening in the player and its config).
- Acquisitions can no longer be created or altered outside the payment flow (database policy hardening).
- Game high scores no longer crash the player in private-browsing modes.
