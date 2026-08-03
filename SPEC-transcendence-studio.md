# Transcendence: Sonic Terrain experience system in Studio

**Type:** Epic · **Branch:** `feature/transcendence-studio-template`
**Verified against the codebase on 2026-08-03.**

---

## Context

Noizes Studio can currently produce exactly one kind of experience. `project.js:7`
coerces every template value to `ultra-v2`, and `experience.js:41` states plainly
that variants are archived. ULTRA is a cinematic guided player: the creator
supplies media and copy, and the template arranges it.

Transcendence is a different kind of object. The creator supplies a recording and
the **experience is computed from it** — a navigable landscape whose elevation is
the track's own energy, whose ridges are its harmonics, and whose erosion is its
transients. Nothing is modelled. Change the audio and every feature of the world
changes with it.

A hand-built reference exists and works: `examples/immersive-reference-album/`
produces a 28 MB `.nz` that passes 40 automated checks, runs fully offline, and
renders a 104-second authored flight over Track One of *The House That Remembered
Us*. That build is Node + ffmpeg. Studio is a browser. **This epic ports the
pipeline into Studio so a creator can produce the same class of object without
touching a terminal.**

**Who cares.** v1 serves a small set of trusted creators producing flagship
releases, not general self-service. It is intended to become safe and
understandable for ordinary artists later, so the architecture must be
recoverable and legible rather than merely functional.

---

## Current State (verified)

| Concern | Where | State today |
|---|---|---|
| Template selection | `studio/src/lib/utils/project.js:7` | `normalizeTemplate()` returns `CANONICAL_TEMPLATE` for **every** input. A second system is unreachable. |
| Template used at pack time | `studio/src/lib/utils/packager.js:47` | `const template = CANONICAL_TEMPLATE;` — hard-coded, ignores project state. |
| Experience HTML | `studio/src/lib/utils/experience.js:41-60` | `buildExperienceHTML()` interpolates a config into `ULTRA.html?raw` and inlines `audioBase64` / `coverBase64` as `data:` URIs. |
| Component packaging | `studio/src/lib/utils/packager.js:74-101` | `writeComponent()` already hashes (SHA-256), sizes, and writes **real zip entries** via `zip.file(path, buffer)`. |
| Authenticity | `studio/src/lib/utils/packager.js:361-375` | Already `sha256-component-inventory` over `` `${path}:${sha256}:${size}` `` — byte-identical scheme to the reference validator. |
| Studio steps | `studio/src/routes/(app)/studio/+page.svelte:25` | Eight steps: Identity, Tracklist, Assets, Lyrics, Extras, **Experience**, Edition, Publish. |
| Step contract test | `studio/src/routes/(app)/studio/studioStructure.test.js` | Asserts the exact 8 labels and that **only** the `ultra-v2` preview branch renders. |
| Runtime deps | `studio/package.json` | `three@0.185.1`, `gsap@3.15.0`, `jszip@3.10.1` — the exact versions the reference bundles. |
| Audio decode | — | No ffmpeg. Must use `OfflineAudioContext`. |
| Workers | `studio/src/lib/workers/whisper.worker.js` | One worker exists; the pattern is established. |

**The important finding:** packaging is *already* file-based. Audio is already a
hashed component. ULTRA additionally duplicates it as base64 into the HTML, which
is why packages bloat. For Transcendence we simply stop doing that. The packaging
contract change is mostly a **subtraction**, not new machinery.

---

## Proposed Change

Six workstreams. Dependency graph:

```
E1 Analysis engine (browser port) ─┬─> E3 Runtime template ──┬─> E4 Experience step UI
                                   │                          │
                                   └─> E2 Packaging contract ─┴─> E6 Preview
                                                              │
                                                              └─> E5 Export validation
```

**Sequencing rationale.** E1 first because everything downstream consumes its
output shape; getting the analysis payload wrong later means re-cutting the format
that ships inside hashed artefacts. E2 and E3 are independent of each other and can
run in parallel once E1's output shape is frozen. E4 needs both. E5 gates export and
must land before anything is published.

---

### E1 — Analysis engine, ported to the browser

**New module: `studio/src/lib/analysis/`** — framework-free pure functions, no
Svelte imports, unit-testable in vitest's node environment.

| File | Ported from | Contents |
|---|---|---|
| `dsp.js` | `examples/.../scripts/lib/dsp.mjs` | Radix-2 FFT, Hann window, spectrogram, band energy, spectral centroid, autocorrelation pitch, peak picking |
| `bands.js` | `examples/.../scripts/lib/mel.mjs` | Constant-Q (log2) filterbank, harmonic/percussive median separation, ridge salience |
| `terrain.js` | `examples/.../scripts/analyze-transcendence.mjs` | Orchestrator producing `{ terrainRGBA, analysis }` |
| `encodePng.js` | `examples/.../scripts/lib/png.mjs` | Fallback only — see below |

**Decode replaces ffmpeg with `OfflineAudioContext`.** The reference runs
`ffmpeg -ac 1 -ar 22050`. The browser equivalent does downmix and resample in one
step:

```js
const ctx = new OfflineAudioContext(1, Math.ceil(duration * 22050), 22050);
```

**PNG encoding should NOT port the hand-rolled zlib encoder.** The browser has a
better path: `OffscreenCanvas.convertToBlob({ type: 'image/png' })` inside the
worker. Keep the ported `encodePng.js` only as a fallback for browsers without
`OffscreenCanvas` in workers. This removes ~120 lines of hand-written CRC/deflate
from the critical path.

**Worker: `studio/src/lib/workers/terrain.worker.js`** posts staged progress:

```
decode → spectrum → bands → separation → terrain → encode
```

**Interface boundary (required).** All analysis goes through one async function so
server-side analysis can be added later without touching the `.nz` format or the
runtime:

```js
// studio/src/lib/analysis/index.js
export async function analyseTrack(file, { onProgress, signal }) → {
  terrain: Blob,        // image/png, frames × 128 RGBA
  analysis: object,     // the documented JSON payload
  meta: { durationSeconds, frameRate, frames, sourceSha256 }
}
```

v1 ships one implementation (`local`). A future `remote` implementation returns the
same shape. Nothing downstream may reach past this function.

**Analysis payload** is the reference schema
(`examples/.../transcendence/analysis/track-01.analysis.json`) with `schema_version`
bumped and a `produced_by: "studio-local"` field. Terrain channels stay
`R` elevation, `G` harmonic mask, `B` transient, `A` ridge salience.

---

### E2 — Packaging contract

**Terrain and analysis ship as real components.** Present them to the existing
`writeComponent()` (`packager.js:74`) as synthetic assets — no new packaging code:

```js
await writeComponent(
  { asset_id: `terrain-${track.track_id}`, scope: 'track', type: 'image',
    role: 'sonic_terrain', file: terrainBlob, mime: 'image/png' },
  `analysis/${track.track_id}.terrain.png`
);
```

They inherit hashing, sizing, the component inventory and `authenticity.json` for
free.

**Changes required:**

1. `packager.js:47` — replace `const template = CANONICAL_TEMPLATE` with the
   project's selected experience system.
2. `project.js:7` — `normalizeTemplate()` must accept `transcendence-v1` and stop
   collapsing everything. Legacy values still collapse to `ultra-v2`.
3. Transcendence path must **not** pass `audioBase64` to the HTML builder. Audio is
   referenced as `audio/<track>.mp3` relative to the package root.
4. `manifest.experience` and `experience.json` gain the Transcendence descriptor
   (entry, system, timeline, analysis, quality profiles, authored arc bounds).

**Track scope (D1):** one selected track per Transcendence object in v1, but every
path is keyed by `track_id` from day one so per-track terrain is purely additive.
Confirmed 2026-08-03: the initial target release is single-track, so this limit
does not bite the first object built with the system.

---

### E3 — Runtime template

**Single source of truth.** Move the runtime out of the example and into Studio:

```
studio/src/lib/experiences/transcendence/
  runtime/01-prelude.js … 12-app.js
  experience.html
  styles.css
```

`examples/immersive-reference-album/scripts/build-transcendence.mjs` is updated to
read from that location, so the reference build and Studio emit the **same runtime**.
Without this the two drift and the reference stops proving anything.

**Template assembly.** Follow the established ULTRA pattern: a prebuild script
emits `studio/src/lib/templates/TRANSCENDENCE.html` with `three` and `gsap`
inlined from `node_modules`, and marker slots for CSS, runtime, analysis payload and
config. `buildTranscendenceHTML()` fills the markers, mirroring
`buildExperienceHTML()`.

**Known landmine, already paid for once:** the runtime is concatenated into one
inline `<script>`. A stray backtick inside a GLSL template literal silently breaks
the whole page — blank render, no console output. The reference build now guards
this and the guard must come across (see E5).

---

### E4 — Experience step UI

All inside the existing step 6. **No ninth step** — `studioStructure.test.js` asserts
eight and that stays true.

1. **System selector** — ULTRA (default) | Transcendence. Selecting Transcendence
   reveals the panel below and marks other steps' irrelevant controls inert.
2. **Track selector** — which track gets the terrain treatment (v1: exactly one).
3. **Analyse** — blocking, staged progress, target **under 45 s** for a 4-minute
   track on a mid-range laptop (D2). Runs in the worker; UI stays responsive; a
   cancel control aborts via `AbortSignal`.
4. **Art direction — a focused set only:**
   - Height scale, ridge emphasis
   - Contour terracing on/off + step size
   - Palette preset: Alabaster / Oxide / Frost (3 fixed presets, no colour pickers)
   - Sun elevation and azimuth
   - Flight altitude bias and time scale
5. **Lyric landmarks — manual placement (D3).** Timings come from the existing
   Lyrics step. In the Experience step the creator drags each line along the
   timeline and sets its frequency band with a slider, against a 2D preview of the
   terrain. Default position: centre of the track, mid band. No auto-placement.
6. **Quality profile preview toggle** — Cinematic / Balanced / Lite / Essential.

---

### E5 — Export validation

Port the reference validator's checks into
`studio/src/lib/utils/validateTranscendence.js` and **gate export on them**. A
creator must not be able to publish a broken object.

Required checks (all ported from `scripts/validate-transcendence.mjs`):

1. Every declared component exists in the zip and matches its size and SHA-256.
2. `authenticity.json` inventory hash matches the manifest components.
3. No `http://` or `https://` reference in `experience.html`.
4. `connect-src 'none'` present in the CSP meta.
5. No unresolved build markers.
6. **The assembled runtime parses** — `new Function(runtimeSource)`. This is the
   backtick landmine; it must fail the build, not the creator's launch.
7. **No backtick inside any GLSL template literal** in the runtime source.
8. Terrain PNG is a declared component and its dimensions match
   `analysis.frames × 128`.
9. Lyrics stay in source order and every landmark time lies inside the track.
10. No credential-shaped string and no absolute machine path in any text component.

---

### E6 — Preview

Render the built HTML in a sandboxed `iframe` from a `blob:` URL, served the same
way the export will be. Preview must exercise the **assembled template**, not a
dev-mode approximation, or it proves nothing.

---

## Acceptance Criteria

1. A creator selects Transcendence in step 6, picks a track, clicks Analyse, and a
   terrain PNG plus analysis JSON are produced entirely in-browser with no network
   request.
2. Analysis of a 4-minute 44.1 kHz track completes in **under 45 s** on a mid-range
   laptop, with named stage progress throughout, and is cancellable.
3. The exported `.nz` contains `audio/<track>.mp3`, `analysis/<track>.terrain.png`
   and `analysis/<track>.analysis.json` as **separate zip entries**, each declared in
   `manifest.components` with correct size and SHA-256.
4. `experience.html` contains **no** base64 audio and **no** base64 terrain.
5. All ten E5 validation checks pass on the exported package, and export is blocked
   when any fails.
6. The exported package opens offline in the Noizes viewer with no network request
   and no console error, and the flight stays in sync with playback.
7. Seeking to any point reconstructs identical world state (the reference
   determinism property is preserved).
8. Essential mode renders the terrain with WebGL disabled, and the lyric remains
   live document text.
9. Selecting ULTRA produces a byte-comparable package to today's output — **no
   regression** for the existing path.
10. A non-developer completes upload → analyse → place lyrics → export → open
    offline with no manual file editing and no assistance.
11. `npm test` passes, including updated `studioStructure.test.js`.

---

## Testing Plan

| Layer | What | Count |
|---|---|---|
| Unit | `dsp.js` FFT against a known-answer sine; filterbank band centres; HPSS separation on synthetic harmonic+click; ridge salience | +12 |
| Unit | `terrain.js` produces stable dimensions and channel ranges for a fixture buffer | +4 |
| Unit | `analyseTrack()` interface contract: shape, progress ordering, abort | +3 |
| Unit | `normalizeTemplate()` accepts `transcendence-v1`, still collapses legacy | +3 |
| Unit | `validateTranscendence.js` — one test per check, both pass and fail paths | +20 |
| Unit | Runtime parses (`new Function`); no backtick in any GLSL block | +2 |
| Integration | `buildPackage()` with a Transcendence project: components present, hashes correct, no base64 audio in HTML | +5 |
| Integration | `buildPackage()` with ULTRA project unchanged (regression) | +2 |
| Manual E2E | Full creator run in a browser, then open the `.nz` offline in the viewer | 1 run |

Determinism gets a real test: analyse a fixture twice, assert byte-identical terrain
PNG and analysis JSON.

---

## Rollback Plan

Every change is additive behind a selector defaulting to ULTRA.

- **Field failure of a Transcendence export:** the creator re-exports the same draft
  as ULTRA. Draft state is untouched by system selection, so nothing is lost.
- **Bad analysis:** re-analyse. Terrain artefacts are derived, never authored, so
  they can always be regenerated from the source audio.
- **Full revert:** revert the branch. `normalizeTemplate()` returning
  `CANONICAL_TEMPLATE` for everything is the pre-change behaviour, so any
  Transcendence drafts degrade to ULTRA rather than breaking.

Nothing here migrates existing data or mutates already-published packages.

---

## Effort Estimate

| Workstream | Human team | CC + gstack |
|---|---|---|
| E1 Analysis engine + worker | ~3 d | ~3 h |
| E2 Packaging contract | ~1 d | ~1 h |
| E3 Runtime relocation + template build | ~2 d | ~2 h |
| E4 Experience step UI | ~3 d | ~3 h |
| E5 Validation + tests | ~2 d | ~2 h |
| E6 Preview | ~1 d | ~1 h |
| **Total** | **~12 d** | **~12 h** |

---

## Files Reference

| File | Change |
|---|---|
| `studio/src/lib/analysis/*` | **New.** DSP, bands, terrain orchestrator, PNG fallback |
| `studio/src/lib/analysis/index.js` | **New.** `analyseTrack()` — the only entry point |
| `studio/src/lib/workers/terrain.worker.js` | **New.** Staged analysis worker |
| `studio/src/lib/experiences/transcendence/**` | **New.** Runtime moved here; single source of truth |
| `studio/src/lib/templates/TRANSCENDENCE.html` | **New (generated).** Assembled template |
| `studio/scripts/build-transcendence-template.mjs` | **New.** Prebuild that inlines three + gsap |
| `studio/src/lib/utils/experience.js` | Add `buildTranscendenceHTML()` |
| `studio/src/lib/utils/project.js:7` | `normalizeTemplate()` accepts `transcendence-v1` |
| `studio/src/lib/utils/packager.js:47` | Stop hard-coding `CANONICAL_TEMPLATE` |
| `studio/src/lib/utils/packager.js:74` | Reuse `writeComponent()` for terrain + analysis |
| `studio/src/lib/utils/validateTranscendence.js` | **New.** Export gate |
| `studio/src/lib/components/StepExperience*.svelte` | System selector, art direction, landmark placement |
| `studio/src/routes/(app)/studio/studioStructure.test.js` | Update the `ultra-v2`-only preview assertion |
| `examples/immersive-reference-album/scripts/build-transcendence.mjs` | Read runtime from its new home |

---

## Out of Scope

- **Full cinematic terrain editor.** No per-cue camera keyframing, no bezier flight
  paths, no free-look exploration mode.
- **Multi-track terrain.** One track per object in v1; schema is shaped for it.
- **Automatic lyric landmark placement.** The reference implementation already
  measures vocal-phrase onsets and dominant bands
  (`analyze-transcendence.mjs`, `terrain_band` / `aligned_seconds`); wiring that into
  Studio is deferred by decision D3.
- **Server-side analysis.** The interface allows it; v1 does not build it.
- **Whisper coupling.** Lyric timings come from the existing Lyrics step.
- **The analytical HUD** from the design renditions — meter panels, atlas view,
  provenance path. Separate scope.
- **Replacing ULTRA.** Both systems ship.

---

## Editorial consequence of D3 (flagged, not a blocker)

The reference build's claim is that a lyric is cut into the ridge the voice made,
with **both** coordinates measured. With manual placement, that claim becomes
creator-asserted rather than measured. The words can be placed on a ridge the voice
did not make.

This is a defensible v1 tradeoff — it removes a whole subsystem and the creator is a
curator, not a stranger. But the marketing line "measured, not decorated" should not
be used for Studio-authored Transcendence objects until auto-placement lands.
The reference package can still make the claim; it earned it.

---

## Related

- Reference implementation: `examples/immersive-reference-album/`
- `TRANSCENDENCE_TREATMENT.md`, `TRANSCENDENCE_SONIC_TERRAIN.md`
- Decisions logged: separate experience system; file-based packaging contract;
  browser-first hybrid analysis
