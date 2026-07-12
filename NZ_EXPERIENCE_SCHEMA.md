# Noizes Experience Schema — DRAFT v0.1

**Status:** Draft for review — precedes /spec breakdown
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

  "modes": { },        // §4 — which views exist and their content
  "renditions": [ ],   // §5 — alternate audio versions
  "attachments": [ ],  // §6 — embedded extra files
  "analysis": { },     // §7 — compile-time computed, drives reactive visuals
  "moments": [ ]       // §7.5 — creator-authored timed annotations
}
```

Every block is optional. A package with none of them renders exactly like v1
(player + lyrics). **All v2 fields are additive** — v1 viewers ignore them;
the v2 template treats every missing block as "mode absent".

### Hard constraints

1. **No external references.** No field may contain `http(s)://` URLs.
   Assets are referenced by zip path (canonical) / data URI (baked).
2. **Timestamps** are non-negative integers in milliseconds.
3. **Colors** are hex `#RRGGBB` or `#RRGGBBAA`.
4. **Text content** is plain text or the whitelisted subset in §4.6
   (no arbitrary HTML — the template renders text, never injects it as markup).

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

### 7.5 Moments (creator annotations)

The offline descendant of V3's timestamped comments:

```json
"moments": [
  {
    "id": "m-01",
    "timestamp_ms": 74000,
    "author": "creator",
    "text": "This is where the choir from the stairwell session comes in.",
    "attachment_id": "att-03"          // optional link into §6
  }
]
```

- ≤ 50 creator moments, `text` ≤ 280 chars.
- Rendered as markers on the progress bar; tapping shows the note (and
  attachment preview if linked).
- **Listener moments** are a viewer feature, not package data: stored in
  `localStorage` keyed by `release_id`, never written back into the artifact.

---

## 8. Authenticity interaction

Current signing covers the audio hash. v2.0 extends coverage:

- `authenticity.json` gains `"content_hash"`: SHA-256 over a canonical
  serialization of `experience.json` + the audio bytes of every rendition.
- The signature (custodial, server-side at publish) signs `content_hash`,
  so the *experience* — not just the audio — is what's attested.
- Validator: recompute `content_hash` from package contents; any mismatch
  (including a tampered story text) fails verification.
- Local/offline exports keep `"signed": false` exactly as today.

---

## 9. Studio changes implied (summary — input to /spec)

| Area | Change |
|---|---|
| New step: **Experience** | Author story/liner/production text, details rows, moments; toggle modes |
| StepAssets | Multi-rendition upload with labels; attachments upload with labels/kind |
| Compile pipeline | Web Audio analysis pass (BPM/onsets/energy/palette); size budget meter; per-attachment bake decision |
| `packager.js` | Emit `experience.json`, `attachments/`, extra `audio/` entries; extend `NZ_CONFIG` baking; `nz_spec: "2.0"` in manifest; extended hash |
| ULTRA template | Mode registry + tab bar from `modes`; story/liner/production/credits/gallery/visualizer views; rendition switcher; moment markers |
| Validator | v2 schema validation; no-external-URL rule; `content_hash` recompute; baked-vs-canonical agreement check |
| Publish server | Sign extended `content_hash` (signing.js), accept v2 manifests |

**Explicitly out of scope for v2.0** (candidates for v2.1+): world block /
360° panorama mode, branching, progression & achievements, interactions,
per-rendition analysis, listener moment export/exchange.

---

## 10. Open questions for /spec

1. **Size ceilings** — is 60 MB the right soft cap for the first official
   artifact? (Target distribution channel matters: direct download vs. Exchange.)
2. **Rendition–lyrics binding** — do we need per-rendition lyric tracks in v2.0,
   or is main-only acceptable for artifact #1?
3. **Visualizer styles** — ship all four renderers in every package (~small JS
   cost) or let Studio strip unselected ones?
4. **Moments UX** — progress-bar markers only, or also a list view (its own mode)?
5. **Does artifact #1 need renditions at all**, or do we ship modes + analysis +
   moments first and add renditions in a fast-follow?
