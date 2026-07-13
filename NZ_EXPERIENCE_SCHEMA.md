# Noizes Experience Schema — v0.2

**Status:** Finalized 2026-07-13 — contract for epic #1 (children #2–#8)
**Applies to:** `.nz` package format v1.x → v2.0, Studio compiler, ULTRA (and future) templates, Validator

---

## 1. Purpose & Lineage

This schema ports the **Experience Play** vision from previous Noizes versions into the
current `.nz` package — under the current ethos: **not a platform, fully offline**.

What it borrows, and from where:

| Concept | Origin | Offline translation |
|---|---|---|
| Experience modes (Lyrics / Credits / Liner Notes / Production / The Story) | Noises 3 `ExperiencePlayer` | Switchable views inside `experience.html`, driven by package data |
| Alternate track versions (Main / Instrumental / Acoustic / Demo) | Noises 3 | Multiple embedded renditions in one package |
| Attached files shelf | Noises 3 | Embedded attachments with an in-experience gallery |
| Sidecar world/experience/analysis blocks | Noizes V3 `SIDECAR_SCHEMA.md` | Same block structure, but **all assets embedded — external URLs are forbidden** |
| Reactive visuals (BPM, beat grid, energy, palette) | Noizes V3 analysis block | Computed **at compile time in Studio**, baked into the package |
| Timestamped "Moments" | Noizes V3 experience comments | Creator-authored moments baked in; listener moments persist to `localStorage` |
| Progression / achievements | Noizes V3 experience block | Local-only state in `localStorage` (deferred to v2.1) |

What it deliberately drops from V3:

- **All network dependence.** V3's sidecar required HTTPS CDN URLs for every asset.
  Here, a `.nz` that references anything outside itself is **invalid**.
- **Server-driven realtime** (pin feeds, live comments, Firebase subscriptions).
  Social state, if it ever returns, lives outside the artifact.
- **Paywall gatekeeping inside the experience.** Edition/rights data is descriptive,
  not enforcement.

---

## 2. Package layout (v2.0)

Additions to the current zip layout (existing files unchanged):

```
release.nz
├── manifest.json          (existing — adds "nz_spec": "2.0")
├── edition.json           (existing, unchanged)
├── rights.json            (existing, unchanged)
├── credits.json           (existing, unchanged)
├── authenticity.json      (existing — hash coverage extended, see §8)
├── technical.json         (existing, unchanged)
├── experience.json        (NEW — canonical experience data, this spec)
├── resources.json         (NEW, optional — the ONLY file allowed to contain URLs, §11)
├── audio/
│   ├── main.<ext>         (existing)
│   └── <rendition>.<ext>  (NEW — alternate versions)
├── cover/                 (existing)
├── attachments/           (NEW — embedded extras)
└── experience.html        (existing — self-contained; NZ_CONFIG carries a
                            baked copy of experience.json with data-URI assets)
```

**Dual representation rule (unchanged from v1):** the zip files are the *canonical
archival* copy; `experience.html`'s injected `NZ_CONFIG` is the *baked render*
copy with binary assets inlined as data URIs. Studio guarantees they agree at
compile time; the Validator checks it.

---

## 3. `experience.json` — root object

```json
{
  "schema_version": "2.0.0",
  "release_id": "nz-xxxxxxxx",

  "presentation": { }, // §3.5 — preset + enabled modules
  "modes": { },        // §4 — which views exist and their content
  "renditions": [ ],   // §5 — alternate audio versions
  "attachments": [ ],  // §6 — embedded extra files
  "analysis": { },     // §7 — compile-time computed, drives reactive visuals
  "moments": [ ]       // §7.5 — creator-authored timed annotations + score actions
}
```

Every block is optional. A package with none of them renders exactly like v1
(player + lyrics). **All v2 fields are additive** — v1 viewers ignore them;
the v2 template treats every missing block as "mode absent".

### Hard constraints

1. **No external references.** No field may contain `http(s)://` URLs.
   Assets are referenced by zip path (canonical) / data URI (baked).
   **Single named exception:** `resources.json` (§11) — a separate optional
   file, never part of the render path, that MAY contain `https://` and
   `mailto:` URLs. `experience.json` itself remains URL-free, always.
2. **Timestamps** are non-negative integers in milliseconds.
3. **Colors** are hex `#RRGGBB` or `#RRGGBBAA`.
4. **Text content** is plain text or the whitelisted subset in §4.6
   (no arbitrary HTML — the template renders text, never injects it as markup).

---

## 3.5 Presentation block (presets & modules)

One modular template serves every experience style. The package declares which
modules (tabs/views) are enabled; presets are Studio-side conveniences that set
the `modules` array — they are data, not separate template files.

```json
"presentation": {
  "preset": "hub",                  // classic | immersive | hub | custom
  "modules": ["player", "lyrics", "story", "gallery", "visualizer", "support"]
}
```

- The template renders the tab bar from `modules` ∩ modes-that-have-data.
  A module with no backing data is silently omitted.
- Unknown module ids are ignored (forward compatibility).
- Missing `presentation` block ⇒ `preset: "custom"` with every data-backed
  mode enabled (v0.1 behavior).
- Studio presets:
  - **Classic** — `player`, `lyrics`, `credits`
  - **Immersive** — Classic + `story`, `gallery`, `visualizer` (+ score playback)
  - **Artist Hub** — Immersive + `support`
- Selecting a preset in Studio never deletes authored content; it only changes
  visibility.

---

## 4. Modes block

Modes are the heart of Experience Play: switchable full-screen views inside the
artifact. The tab bar shows only modes present in the package.

```json
"modes": {
  "player":  { "enabled": true },
  "lyrics":  { "enabled": true },
  "story":   { "title": "The Story", "body": "How this track came to be…" },
  "liner":   { "title": "Liner Notes", "body": "…" },
  "production": {
    "title": "Production",
    "body": "Free-text recording notes…",
    "details": [
      { "label": "Recorded at", "value": "Room 3, Nairobi" },
      { "label": "BPM", "value": "85" },
      { "label": "Key", "value": "D minor" },
      { "label": "Instruments", "value": "Piano, synth, strings" }
    ]
  },
  "credits": { "enabled": true },
  "gallery": { "enabled": true },
  "visualizer": { "enabled": true, "style": "pulse", "reactive": true }
}
```

### 4.1 `player` — always present
The existing default view. Not removable; `enabled` exists only for symmetry.

### 4.2 `lyrics` — existing, unchanged
Backed by the existing top-level `lyrics` array in `NZ_CONFIG` (Whisper-synced).
Listed here so the mode registry is complete; content stays where it is for
back-compat.

### 4.3 `story` / `liner` — narrative modes
Long-form text views. `title` (≤ 60 chars) + `body` (plain text with blank-line
paragraphs, ≤ 20 000 chars each). These are the `NOIZES_NARRATIVE` /
"Liner Notes" panels from Noises 3 & V3.

### 4.4 `production` — structured + free text
Free-text `body` plus optional `details` label/value rows (≤ 24 rows).

### 4.5 `credits` — renders existing data
No new content: renders `credits.json` + `rights.json` as a proper view instead
of (or in addition to) chips. Pure template work.

### 4.6 `gallery` — attachments shelf
Renders the `attachments` block (§6) as a browsable grid. Images/GIFs preview
inline; PDFs and other files get a "save to device" action
(`<a download>` from the data URI — works offline).

### 4.7 `visualizer` — reactive visual mode
Full-screen canvas visual driven by the `analysis` block (§7) plus live
Web Audio `AnalyserNode` data when available. `style` selects a built-in
renderer shipped inside the template (`pulse | field | bars | orbit`);
`reactive: true` uses live FFT, `false` falls back to `beat_grid` timing only
(needed where the audio element is served in a context without
`createMediaElementSource` access).

### 4.8 `support` — artist links (renders `resources.json`)

Renders the groups of `resources.json` (§11) as link cards. Appears only when
`resources.json` exists in the package AND `modules` includes `support`.
Every link opens via `<a target="_blank" rel="noopener noreferrer">` on an
explicit user tap — the template itself performs **zero** network requests.
No third-party advertising, ever: the only links in a package are the ones the
creator placed there.

**Text rendering rule:** `body` fields support only: blank line = paragraph
break, `*italic*`, `**bold**`. The template converts these itself; raw HTML in
content is escaped, always.

---

## 5. Renditions block (alternate versions)

```json
"renditions": [
  { "id": "main",         "label": "Main",         "path": "audio/main.mp3",         "default": true },
  { "id": "instrumental", "label": "Instrumental", "path": "audio/instrumental.mp3" },
  { "id": "acoustic",     "label": "Acoustic",     "path": "audio/acoustic.mp3" }
]
```

- 1–5 renditions. Exactly one `default: true`.
- Each rendition's bytes live in `audio/` (canonical) and as a data URI in the
  baked config.
- Switching renditions preserves playhead position when durations match within
  ±2 s; otherwise restarts.
- Lyrics sync binds to a `rendition_id` (default: `main`). Renditions without
  synced lyrics hide the lyrics mode while active.
- `analysis` (§7) is computed for the **default rendition only** in v2.0.

**Size reality check:** audio is embedded twice (zip + baked data URI at ~1.33×).
A 4-rendition package at 8 MB/track ≈ 75 MB. Studio must show a live package
size estimate and warn past a soft cap (default **60 MB**, configurable), but
never hard-block — the creator decides.

---

## 6. Attachments block

```json
"attachments": [
  {
    "id": "att-01",
    "label": "Album Artwork (print res)",
    "path": "attachments/artwork_print.pdf",
    "mime": "application/pdf",
    "bytes": 2400123,
    "kind": "document"        // image | gif | document | audio | other
  }
]
```

- ≤ 12 attachments, each ≤ 20 MB, same soft-cap accounting as renditions.
- `kind: image | gif` render inline in the gallery; everything else is
  download-only.
- Attachments are **not** required to be inlined into `NZ_CONFIG` if the
  package would exceed the soft cap — in that case the gallery shows them as
  "inside the package" entries (visible metadata, extraction hint) rather than
  inline previews. Studio decides per-file at compile time and records
  `"baked": true|false` per attachment.

---

## 7. Analysis block (compile-time intelligence)

Computed **in the browser at compile time** (Web Audio API — decode, FFT, onset
detection), never at play time and never on a server:

```json
"analysis": {
  "engine": "noizes-studio@1.0.0",
  "rendition_id": "main",
  "duration_ms": 240000,
  "detected_bpm": 85,
  "energy": "low",                    // low | medium | high
  "beat_grid": [480, 960, 1440],      // ms offsets of major onsets, ≤ 2000 entries
  "energy_curve": [0.2, 0.35, 0.8],   // 0–1 sampled at 1 Hz, ≤ duration in s
  "palette": {
    "primary": "#7B5CF0",             // extracted from cover art
    "secondary": "#F04BD8",
    "background": "#030303"
  }
}
```

Drives: visualizer mode, lyric background pulse, progress-bar energy shading.
All fields optional — the visualizer degrades gracefully (palette-only → static).

### 7.5 Moments (creator annotations + Experience Score)

The offline descendant of V3's timestamped comments, extended into a single
timed track that *orchestrates* the experience — the Experience Score. There is
deliberately only ONE timed system in the package.

```json
"moments": [
  {
    "id": "m-01",
    "timestamp_ms": 74000,
    "author": "creator",
    "action": "show",                  // annotate (default) | show | quote | artwork
    "text": "This is where the choir from the stairwell session comes in.",
    "attachment_id": "att-03",         // link into §6
    "duration_ms": 8000                // show/quote only
  }
]
```

Action semantics:

| Action | Requires | Behavior |
|---|---|---|
| `annotate` (default) | `text` | v0.1 behavior: progress-bar marker; tap shows the note (+ attachment preview if linked) |
| `show` | `attachment_id` → kind `image\|gif` | Full-bleed crossfade display of the attachment for `duration_ms` |
| `quote` | `text` | Typographic text card for `duration_ms` |
| `artwork` | `attachment_id` → kind `image\|gif` | Swaps the displayed cover; **persists** until the next `artwork` moment or track end; `duration_ms` ignored |

- ≤ 50 creator moments, `text` ≤ 280 chars.
- `duration_ms` default 6000, clamped to 2000–15000 (show/quote only).
- A moment whose required field is missing or whose `attachment_id` points at a
  non-image attachment is **invalid** (Validator fails the package).
- Seek behavior (template contract): on seek, active artwork state is
  recomputed from all `artwork` moments ≤ playhead; `show`/`quote` moments
  passed by more than 250 ms are not replayed.
- Video playback and audio ducking are explicitly **not** part of v2.0.
- **Listener moments** are a viewer feature, not package data: stored in
  `localStorage` keyed by `release_id`, never written back into the artifact.

---

## 8. Authenticity interaction

Current signing covers the audio hash. v2.0 extends coverage:

- `authenticity.json` gains `"content_hash"`: SHA-256 over the **canonical
  serialization** of `experience.json`, then `resources.json` (when present),
  then the raw audio bytes of every rendition in `renditions[]` order
  (single-audio packages: just the main audio bytes).
- **Canonical serialization** (must be reproducible across independent
  implementations): JSON with object keys sorted lexicographically (code-unit
  order) at every depth, arrays in document order, no insignificant
  whitespace, UTF-8 encoding, no trailing newline. The hash input is:
  `utf8(canonical(experience.json))` ‖ `utf8(canonical(resources.json))`
  (omitted entirely when the file is absent) ‖ rendition bytes.
- `resources.json` is deliberately **inside** `content_hash`: artist links are
  baked per edition. Changing a link means issuing a new edition — the
  archived artifact never silently changes.
- The signature (custodial Ed25519, server-side at publish) signs
  `content_hash`, so the *experience* — not just the audio — is what's
  attested. The legacy audio `hash` field is kept alongside for v1 viewers.
- Validator: recompute `content_hash` from package contents; any mismatch
  (including a tampered story text or swapped merch link) fails verification.
- Local/offline exports keep `"signed": false` exactly as today.

---

## 9. Studio changes implied (summary — input to /spec)

| Area | Change | Issue |
|---|---|---|
| New step: **Experience** | Preset picker; story/liner/production text; moments editor (score actions); attachments; resources editor; size meter | #5 |
| StepAssets | Multi-rendition upload with labels (fast-follow) | #8 |
| Compile pipeline | Web Audio analysis pass (BPM/onsets/energy/palette); size budget meter; per-attachment bake decision | #3 |
| `packager.js` | Emit `experience.json`, `resources.json`, `attachments/`, extra `audio/` entries; extend `NZ_CONFIG` baking; `nz_spec: "2.0"`; `content_hash` | #3 |
| ULTRA template | Mode registry + tab bar; narrative/credits/gallery/visualizer views; score playback engine; support module; connection indicator | #4 |
| Validator | v2 schema validation; URL carve-out rule; `content_hash` recompute; baked-vs-canonical agreement check | #6 |
| Publish server | Sign extended `content_hash` (signing.js), accept v2 manifests; shared `contentHash` module | #7 |

**Explicitly out of scope for v2.0** (candidates for v2.1+): world block /
360° panorama mode, branching, progression & achievements, interactions,
per-rendition analysis, listener moment export/exchange, video moments,
audio ducking, live resources endpoint, stems/Atmos/notation modes
(all distributable today as plain attachments), third-party advertising (never).

---

## 10. Resolved decisions (was: open questions)

Decided 2026-07-13 with epic #1:

1. **Size ceilings** — 60 MB soft cap confirmed (warn, never block). Revisit
   with real data from artifact #1.
2. **Rendition–lyrics binding** — main-only in v2.0. Renditions without synced
   lyrics hide the lyrics mode while active.
3. **Visualizer styles** — all four renderers ship in every package; the JS
   cost is small next to embedded audio.
4. **Moments UX** — progress-bar markers (annotate) plus the score playback
   layer (show/quote/artwork). No separate list-view mode in v2.0.
5. **Renditions for artifact #1** — spec'd now (format-complete), built as a
   non-blocking fast-follow (#8). Artifact #1 may ship single-audio.

---

## 11. `resources.json` — artist links (the URL carve-out)

Optional file. The ONLY place in a `.nz` where URLs may exist. Everything
required to *experience* the work is inside the package; everything that
points outward lives here, opened only by explicit user action.

```json
{
  "schema_version": "1.0.0",
  "release_id": "nz-xxxxxxxx",
  "live_endpoint": null,
  "groups": [
    {
      "id": "listen",
      "title": "Listen",
      "links": [
        { "label": "Spotify", "url": "https://open.spotify.com/…", "kind": "streaming" }
      ]
    },
    {
      "id": "support",
      "title": "Support",
      "links": [
        { "label": "Merch",        "url": "https://…", "kind": "store" },
        { "label": "Tour Tickets", "url": "https://…", "kind": "tickets" }
      ]
    }
  ]
}
```

Rules:

1. **Scheme whitelist:** every `url` must be `https://` or `mailto:`. Anything
   else (http, ftp, javascript, data, …) makes the package invalid.
2. **Never auto-fetched.** The template performs no network requests. Links
   render as `<a target="_blank" rel="noopener noreferrer">` and open only on
   user tap. A `.nz` remains fully functional with no network, forever.
3. **Limits:** ≤ 6 groups, ≤ 10 links per group, `label` ≤ 40 chars,
   `title` ≤ 24 chars, `url` ≤ 2048 chars.
4. **Canonical group ids** (template supplies icons and ordering):
   `listen | watch | follow | support | collect | explore`.
   Unknown ids render last, unstyled but functional.
5. **`kind`** is a display hint (`streaming | video | social | store | tickets |
   donate | website | other`); unknown kinds fall back to `other`.
6. **`live_endpoint`** is reserved for a future live-resources feature
   (current tour dates / new releases fetched on explicit "Go Online").
   In v2.0 it must be `null` and viewers MUST NOT fetch it. Reserving the
   field now means the feature lands later without a format bump.
7. **Baked into `content_hash`** (§8): links are part of the attested edition.
8. **No third-party advertising.** The only promotions in a package are things
   the creator intentionally placed: their merch, shows, releases, socials.

Viewer contract (connection indicator): offline → "Archived edition — exactly
as released"; online AND resources present → "Artist links available".
Cosmetic only — rendering never depends on connectivity.
