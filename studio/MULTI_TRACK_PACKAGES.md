# Multi-track `.nz` packages

## Product model

Noizes treats a release, track, audio asset, audio version, edition, and
authenticated copy as separate records:

```text
Release
  ├─ Tracks
  │   ├─ Audio versions
  │   │   └─ Physical audio components
  │   └─ Track media, lyrics, credits, rights, and Journey Moments
  ├─ Release media and release-level Journey Moments
  └─ One release-wide edition
      └─ Authenticated copies and copy provenance
```

Ownership and transfer history belongs to the complete edition copy. Track
creation history is informational and never becomes an independent ownership
chain.

## Studio flow

1. **Identity** — release type and release-wide identity.
2. **Tracklist** — stable track records, ordering, artists, credits, flags, and
   inheritance choices.
3. **Assets** — release assets plus primary masters, versions, and media for
   each track.
4. **Lyrics** — per-track plain/timed lyrics, LRC import, translations,
   transliterations, language, and lyric credits.
5. **Extras** — artist statement, Note Wall PDFs, online pathways, and games.
6. **Experience** — the release overview timeline and detailed track Moments.
7. **Edition** — one fixed supply for the complete release.
8. **Rights, Compile & Publish** — release/track rights, asset declarations,
   validation, exact-package preview, compilation, and Exchange publication.

Studio preview compiles the same `.nz` bytes used for download, validates them,
resolves their component paths, and opens the generated experience. It is not a
separate approximation of playback or Journey timing.

## Package source of truth

`manifest.json` is authoritative for release identity, track ordering, and the
component inventory. Stable track IDs—not titles—identify track folders.
`track.json` files are portable projections generated from the same normalized
Studio state. `archive.json` and `history.json` are offline snapshots for the
collector experience.

Large media files are stored once as ordinary archive components. They are not
duplicated as base64 data URIs inside `experience.html`. This keeps lossless
albums, video, stems, and PDFs practical while preserving original bytes and
per-component SHA-256 checksums.

## Offline delivery tradeoff

The intact `.nz` file is the recommended portable object. `/open` and the
installed `viewer.html` PWA validate the package, create temporary Blob URLs for
its relative assets, and run the experience in a sandboxed frame. Files remain
on the collector's device. Resume state and the local collector note cross the
sandbox only through two package-specific storage keys.

An extracted package can also open `experience.html` from the archive root.
Relative paths preserve the `release/` and `tracks/` hierarchy, but some
browsers restrict media or PDF access from `file://`. In that case the collector
should use `/open`, the installed offline viewer, or a local static file server.
The generated `README-OFFLINE.txt` records these instructions inside every new
package.

This architecture deliberately does not claim that one standalone HTML file
can contain an unlimited lossless album. Portability belongs to the complete
`.nz` object, not to an HTML file detached from its components.

## Playback and persistence

The release player owns both audio elements used for preloading and handoff.
Sequential, gapless, and crossfade modes share one active-track state. The
player persists disc, track, track/release positions, completed tracks, visited
Moments, completion state, selected view, playback mode, shuffle, and repeat by
`release_id + edition_id + copy_id` where available. Storage failure never
blocks playback.

## Compatibility and validation

Legacy one-song packages normalize at the viewer boundary into an internal
Single with one track and require no migration. New Singles use the normalized
release schema.

Compilation and `/open` validate required records, component relationships,
file presence, size, SHA-256 checksums, authenticity inventory, and offline
runtime dependencies. Publishing repeats validation before signing and storing
normalized release rows. Package-size reporting includes per-asset,
per-track, data-URI expansion, video/stem, and estimated browser-memory
warnings.

## Deployment and verification

Apply `backend/multi-track-phase-1-2026-07-31.sql` after the base Supabase
schema. It is idempotent and converts legacy releases into one-track Singles.

From `studio/` run:

```bash
npm test
npm run build
```

The package tests cover normalized manifests, component inventories,
checksums, relative extraction paths, Archive/History projections, playback,
Journey synchronization, size warnings, legacy normalization, and viewer Blob
resolution. Database migration checks should apply the migration twice against
PostgreSQL with `ON_ERROR_STOP=1`.
