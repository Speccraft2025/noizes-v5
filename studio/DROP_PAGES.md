# Drop Pages

A **Drop Page** is the permanent public address of one published Noizes
release. It is where a shared link lands, where a release is acquired, and
where its authenticity and history can be checked.

```
Studio → Publish → Exchange → /drop/[artist]/[release] → the .nz package
```

It is not an artist profile, a link tree, or a store page. It presents one
object and gets out of the way.

---

## The route

```
/drop/[artistSlug]/[releaseSlug]            the Drop Page
/drop/[artistSlug]/[releaseSlug]/download   entitlement-checked package URL
/drop/[artistSlug]/[releaseSlug]/certificate  authenticity certificate (JSON)
/drop/[artistSlug]/[releaseSlug]/manifest   the package manifest as published
/drop/[artistSlug]/[releaseSlug]/manage     creator-only mutations (POST)
/drop/track                                 aggregate analytics beacon (POST)
/experience/[artistSlug]/[releaseSlug]      the web viewer for the package
```

Canonical identity is the **release id**. Slugs are aliases resolved through
`release_slugs`, which keeps every address a release has ever answered to. A
retitled release mints a new canonical slug and 301s the old one — a shared
link never breaks. Collisions take a stable suffix derived from the release id
(`retrospect-a1b2`), never a counter, so restoring a snapshot cannot hand an
address to a different release.

`RESERVED_ARTIST_SLUGS` prevents an artist slug from shadowing an application
route.

---

## Publishing

`$lib/server/publish-release.js` → `finalizePublication()`.

PostgREST offers no transactions, so integrity is structural:

1. The release row is written **as a draft**. The Exchange and the Drop Page
   both filter on status, so nothing is publicly reachable yet.
2. `onStaged` writes the normalized tracklist and audio inventory — these need
   the row's foreign key but must be complete before anyone can see it.
3. The package version, authenticity record and provenance chain are written.
4. The status flips to `published`.

A failure at any point leaves an invisible draft, never a live release with no
package behind it. Every step is keyed on something stable (release id,
package hash, provenance seq), so a double-click, a retry, or a re-publish
converges on one release, one package version, one chain.

A re-publish of an already-live release never passes back through `draft`:
pulling a release off the Exchange mid-flight would break checkouts already in
progress.

### Package versions

`release_packages` holds one row per published build, and rows are never
overwritten. A creator who publishes a revision after copies have been
acquired gets version 2 beside version 1; the collector holding version 1
keeps a package whose recorded hashes still describe the bytes they have.

---

## Data model

Added by `backend/drop-pages-2026-08-03.sql`:

| Object | Purpose |
| --- | --- |
| `releases.slug` / `.artist_slug` | canonical address |
| `releases.visibility` | `public` (on the Exchange) or `unlisted` (link only) |
| `releases.status` | now also `withdrawn` — page survives, acquisition stops |
| `releases.allow_public_download` | free packages the creator wants open |
| `releases.transferable` / `.resale_enabled` / `.offers_enabled` | edition rights |
| `release_slugs` | slug history; the unique key is also the collision guard |
| `release_packages` | immutable package version history |
| `release_authenticity` | signature index, so the page need not open the .nz |
| `release_links` | creator's external links, https-only |
| `drop_analytics` | counters per release/day/event — no visitor rows |

**Not** created: a table replacing `releases.nz_path` (acquisition, collection
and download all resolve through it), or an `editions` table (an edition is
the release's `edition_*` columns plus the acquisitions claiming numbers from
it — splitting it would fork the sellout logic in `$lib/server/acquire.js`).

`manifest.json` inside the .nz remains the source of truth for what the object
*is*. The database is the publication and indexing layer.

Apply the migration before deploying:

```bash
cd studio && npm run check:schema
```

### Provenance

Copy chains are keyed by edition number (`null` = open edition, `1..N` =
numbered). **Edition number 0 is reserved for the release's own chain** —
`created` then `published` — because a release is made and published before
any copy exists. Allocation starts at 1, so 0 can never collide, and the
existing `unique(release_id, edition_number, seq)` constraint gives the
release chain the same append-only, race-safe guarantees.

The hashed field set is unchanged, so every signature written before this
migration still verifies.

---

## What the page may claim

Every content row, experience section and trust indicator is derived from the
package manifest (`$lib/domain/drop-contents.js`). If a package declares no
video, the page has no Video row. A Drop Page listing contents the .nz does
not contain is not a cosmetic bug — it is a false claim about something
someone is about to buy.

Unsupported claims are **absent**, not greyed out: a dimmed "Verified
authentic" still reads as a badge at a glance.

The authenticity panel states, in the page and again in the exported
certificate, that a signature is not a copyright registration.

---

## Availability and entitlement

`$lib/domain/drop-availability.js` decides the primary button in one pure
function — eight states, all reachable in tests. Ownership outranks
everything: a collector who holds a copy can always reach it, even when the
edition is sold out or the release has been withdrawn.

The **server** decides `owned`, read from `acquisitions`. The download and
experience endpoints re-check independently; a client that says it owns a copy
is making a claim, not proving one.

Download entitlement is conservative: creator, or owner, or (free **and**
`allow_public_download`). The browser-facing filename keeps the `.nz`
extension — the container is a ZIP, but a collector left with `album.zip` has
lost the format.

---

## Sharing

Server-rendered, because a social crawler does not run JavaScript. Open Graph
and Twitter tags, the canonical link and the QR SVG are all in the first
response.

The shared URL is always the canonical Drop Page — never a storage URL (they
move and they expose the object's location), never a URL carrying who shared
it.

`$lib/domain/qr.js` is a self-contained QR encoder (byte mode, EC level M,
versions 1–10, up to 216 bytes). Written here rather than added as a
dependency: it puts no third-party code in the path of a page that renders
creator-controlled text, and needs no runtime download. Its tests reverse the
encoder and assert the original bytes come back.

---

## Analytics

Counters only: one row per release, per day, per event kind, incremented
through a security-definer RPC. No visitor rows, no identifiers, no
fingerprints — there is deliberately nothing to correlate later. Every call
site treats it as advisory; the beacon endpoint always answers 200, because a
metrics outage must not break the page it measures.

---

## Security notes

- The experience runs in an **opaque sandbox** (`sandbox="allow-scripts …"`,
  no `allow-same-origin`), so creator-authored code never inherits the
  signed-in Noizes origin. Same boundary the offline viewer uses.
- Component checksums are validated before any packaged HTML reaches the
  sandbox.
- Creator link URLs are validated as `https:` in the application, constrained
  by a CHECK in the database, and re-checked in the component before reaching
  an `href`. Rendered with `rel="noopener noreferrer nofollow ugc"`.
- `/manage` lists every mutable field explicitly. Spreading a request body
  into an update would let a creator write `status`, `slug`, `acquired_count`
  or `artist_id`.
- A draft is invisible to everyone but its creator, and returns 404 rather
  than 403 — an unpublished release should not be confirmable by a stranger.

### Known limitation

The `releases` storage bucket is **public** (it predates this work and the
acquire/collection/viewer paths all depend on it). Package URLs are therefore
unguessable rather than secret: `download` decides who gets a named, tracked
URL, but a leaked storage path is directly fetchable. Closing this means
moving to signed URLs across every consumer of `nz_path` — a separate change,
deliberately not bundled here.

---

## Testing

```bash
cd studio && npm test
```

Covered: slug generation and collision behaviour, manifest-derived contents,
the availability state machine, share/OG construction, the QR encoder
(round-trip decode), and the publish orchestration against an in-memory
Supabase stand-in (`$lib/server/fake-supabase.js`) — idempotency, staged
visibility, failure leaving a draft, and recovery on retry.

Not covered by automated tests: Svelte component rendering (no component
harness in this repo yet) and live payment flows.

Component rendering was verified manually against a fixture at every section,
on desktop and at 375px, with no horizontal overflow and no console errors.
The server-rendered Open Graph tags and QR SVG were confirmed present in the
raw HTML response — the property that makes a shared link render a card for a
crawler that runs no JavaScript.

## Not built

Stated plainly so the gaps are known rather than discovered:

- **A single-segment `/drop/[slug]` route.** The canonical address is always
  two segments; nothing generates a bare one, and adding it would create a
  namespace that collides across artists.
- **Downloadable social share images.** Open Graph points at the cover
  artwork; no composited share card is generated.
- **Signed storage URLs.** See the known limitation above.
- **Replacing a package from the Drop Page.** `release_packages` supports
  versions and `finalizePublication` writes them, but the creator path to a
  revision is still a re-publish from Studio.
