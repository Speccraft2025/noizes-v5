# beatsunlimited.shop

Discover free "type beat" uploads from YouTube, then propose a revenue-share
deal with the producer through a binding split sheet instead of a DM.
React/Vite front end backed by the shared Noizes Supabase project.

## Run it

```
npm install
cp .env.example .env   # fill in the Noizes Supabase URL + anon key
npm run dev
```

One-time backend setup: run `backend/supabase_schema.sql` (repo root) in the
Supabase SQL Editor — it is idempotent and now includes the `beat_catalog` and
`beat_deals` tables plus the token-scoped `bu_*` RPCs this app calls. Then seed
the catalog with `npm run ingest`.

Without the backend (or before the SQL is applied) the app still works
end-to-end: the catalog falls back to the curated seed list and deals are
stored in localStorage, flagged "saved locally" in the UI.

## How a deal flows

1. Artist signs the split sheet → `bu_create_deal` inserts a `beat_deals` row
   and returns a random 128-bit `deal_token`.
2. Project Space shows a countersign link (`#/deal/<token>`) to send to the
   producer — no account needed; the token is the capability.
3. Producer opens the link, countersigns (or declines) via
   `bu_countersign_deal` / `bu_decline_deal`.
4. The artist's Project Space polls `bu_get_deal` and flips to "Deal fully
   signed", unlocking the **Continue in Noizes Studio** handoff, which
   prefills the Studio's Rights step (producer + split credit line) via query
   params.

## Catalog ingestion

`npm run ingest` (scripts/ingest.mjs, service-role only — never ship to the
browser):

- With `YOUTUBE_API_KEY`: searches the YouTube Data API per genre for fresh
  free type-beat uploads and upserts them into `beat_catalog`.
- Without a key: seeds/refreshes the curated list via YouTube's public oEmbed
  endpoint, deactivating videos that are no longer embeddable.

Supabase credentials are read from env or `../studio/.env`. Schedule it as a
cron on a server that holds the service role key.

## Real MP3 downloads

"Free Download" serves a real file only when `beat_catalog.download_url` is
set — i.e. when the producer has actually supplied one. Attach a
producer-authorized file (or their own hosted link) with:

```
node scripts/attach-audio.mjs <video_id> path/to/beat.mp3
node scripts/attach-audio.mjs <video_id> https://producer-site.com/beat.mp3
```

Local files upload to the public `beat-files` storage bucket. Beats without a
`download_url` keep the YouTube fallback ("Free Download (opens YouTube)").
Deliberately, nothing here extracts audio from YouTube — that violates
YouTube's ToS and the producers never granted redistribution rights.

## Structure

```
src/
  data/beats.js              8 real, currently-live free beats (video ID,
                              title, channel, thumbnail — via YouTube's
                              public oEmbed endpoint, no scraping/rehosting)
  components/
    shared/TopNav.jsx        logo + step tracker (Discover → Propose → Sign → Project Space)
    PlayerView/               discovery screen
      PlayerView.jsx          layout + state for chip filter, queue, shuffle
      MetaPanel.jsx           beat info + "Propose a Deal" / "Free Download" CTAs
      VideoFrame.jsx          thumbnail-first, swaps to a real YouTube <iframe> on play
      ControlBar.jsx          shuffle / search toggle / AI match toggle / save
      SearchPanel.jsx         genre & mood chip filters
      AiMatchPanel.jsx        mood + artist + budget -> picks a matching beat
      CommentsBlock.jsx       static placeholder
      QueuePanel.jsx          "up next" rail
    DealFlow/
      DealBuilder.jsx         deal type + master/publishing sliders + upfront fee
      SignSheet.jsx           e-sign step (name + agree checkbox)
      ProjectSpace.jsx        confirmation, checklist, split terms
  App.jsx                     owns view state (feed/deal/sign/confirm), current beat, deal terms
```

State is plain `useState` in `App.jsx`, passed down as props. No router —
the four steps are conditional renders. This is intentionally simple; swap
in Zustand/Redux/Context only if the state tree grows past what props can
carry cleanly.

## What's real vs. what's mocked

**Real:** the 8 beats stream actual YouTube videos via the standard
`youtube.com/embed/` iframe. Titles, channel names, and thumbnails come from
YouTube's own oEmbed response — not fabricated.

**Mocked / needs real implementation before this is a product:**

1. **Producer notification.** Deals persist and countersigning works, but the
   countersign link must be sent to the producer manually — there's no email /
   YouTube-comment / DM delivery yet.

2. **Identity verification on signatures.** Signing is a typed name + token
   link. Wiring this to the Noizes internal KYC layer (profiles.kyc_status)
   would make signatures identity-backed; an e-signature API is the
   alternative.

3. **Payout enforcement — the core of the whole idea.** The "auto-split at
   release" language throughout the UI is aspirational copy, not a working
   system. This only means anything if release payouts are actually routed
   through a distributor's split-pay feature (DistroKid's Splits API is the
   closest existing model) or a publishing administrator, so the artist
   never has discretion over whether the producer gets paid. Without this,
   the split sheet is just a nicer-looking handshake deal. Build this before
   anything else — it's the reason a producer would trust "points" over a
   flat fee.

4. **License terms per video.** `beats.js` has a `license` field but it's
   read off search snippets, not verified. Real usage terms live in each
   YouTube video's description and vary per producer (e.g. "non-profit use
   only" on one of the seeded R&B beats). There's no automated way to parse
   or trust this yet — flagged here because it's a real legal gap, not
   something to paper over with a nicer UI.

5. **Genre/mood tagging.** Tags are hand-derived from video titles. Real
   metadata (BPM, key) mostly doesn't exist for YouTube-sourced beats unless
   producers add it, which is why `tempo` shows "Not tagged" for most
   entries — that's accurate, not a bug.

## Suggested build order

1. Payout routing (#3 above) — proves the core promise is real, not just UI.
2. Producer notification delivery (#1) — email or YouTube outreach.
3. KYC-backed signatures (#2) — reuse the Noizes internal KYC layer.
4. License/rights verification layer (#4) — can start as a manual review
   queue before automating.
