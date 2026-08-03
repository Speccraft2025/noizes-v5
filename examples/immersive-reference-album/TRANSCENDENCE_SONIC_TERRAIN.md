# Sonic Terrain — architecture, camera, materials, performance, QA

Companion to `TRANSCENDENCE_TREATMENT.md`. This document covers how the edition
is built rather than what it means.

---

## 1. Pipeline

```
audio/track-01.mp3
        │  ffmpeg → mono f32 @ 22050
        ▼
  STFT 2048 / hop 512  (43.066 frames per second)
        │
        ├── broadband curves ──► rms, loudness, bands, brightness, flux,
        │                        voice-likeness, presence, pitch confidence
        ├── onsets, phrases, vocal phrases, section boundaries
        ├── lyric alignment (order-preserving fit to vocal-phrase onsets)
        │
        └── constant-Q filterbank, 128 bands, 80 Hz – 6.4 kHz
                 │
                 ├── per-band noise floor removed (18th percentile per band)
                 ├── percentile-anchored dB → 0..1, gamma 0.72
                 ├── elevation smoothed ±4 frames along time
                 ├── harmonic/percussive separation (median filtering)
                 └── ridge salience (±4 bands)
                          │
                          ▼
        analysis/track-01.terrain.png   7895 × 128 RGBA
        analysis/track-01.analysis.json  parameters, curves, cues, provenance
```

Both outputs are package components with their own hashes. The runtime reads
them and nothing else; it never analyses live audio and never opens a microphone.

### Why constant-Q rather than mel

Mel spends most of its resolution below 1 kHz. On a mel axis the entire musical
content of this record occupied the left quarter of the world and the right half
was surface noise. Constant-Q gives every octave the same amount of ground, so
the vocal register lands mid-world and the frequency axis becomes navigable.
6.322 octaves across 420 units.

### Why the per-band noise floor is removed

A 1902 shellac disc carries a dense steady hiss that is loudest exactly where the
music is quietest. Without subtracting each band's own resting level, the high
frequencies became a noisy high plateau that outranked the singer. Each band's
18th percentile across the whole track is treated as that band's silence. This is
declared in the analysis file rather than done silently.

---

## 2. Terrain rendering

**Geometry.** One grid, carried with the camera and snapped to a cell so it does
not swim under the landscape. Rows are spaced quadratically: 16 % of them cover
the ground behind the viewer, the rest reach forward to the view distance. This
concentrates detail near the eye and still reaches the horizon with a single
mesh — 400 k triangles at Cinematic, 85 k at Lite.

**Elevation** (`GLSL.terrainField`, shared by ground, landmarks and specimen):

```
mass  = mix(1.45, 0.48, band^0.70)        // low registers carry weight
base  = T.r^gamma * heightScale * mass
base += T.a * T.r * ridgeScale * mix(0.6, 1.9, band)   // harmonics → ranges
base += mix(broken, strata, T.g) * detailScale         // analytic fine relief
```

The fine relief is analytic, so it has no resolution limit at any altitude and
costs no storage. Harmonic ground is smooth and stratified; percussive ground is
broken.

**Normals** come from central differences of the same function, with the epsilon
scaled per quality profile.

**Material by register.** Low: oxidised mineral. Middle: warm stone and bronze —
the inhabited country. High: pale silver frost. Energy exposes fresh material;
transients scorch it. Roughness floors at 0.42 because rock is matte — an early
build let it reach 0.08 and the peaks read as wet plastic.

**Light.** One raking source plus a hemisphere ambient (sky above, bounce below).
A hemisphere term is what makes a landscape read as outdoors rather than as
objects in a void. Fog is exponential with a height term so valleys hold it and
summits stand clear, and it is deliberately *darker* than the lit rock so the
ranges keep their silhouette to the horizon.

---

## 3. Camera

The camera's position along the world is never authored: it is derived from the
playhead, so the flight cannot drift out of sync. A shot says only where to sit
*relative* to that point — band, altitude above ground, lead, and where to look.

Shots are rails the camera springs toward, not paths it follows exactly. Spring
half-life scales with altitude so a ground-level pass is responsive and an atlas
move stays majestic. The flight clamps to 3.2 units above the ground it is
crossing, sampled from the same terrain data the shader uses.

There is no ambient shake. The single impact is motivated by the largest
low-frequency event in the slice, at 91.5 s.

**Attention** moves the framing in proportion to the shot's own scale. A fixed
world offset was tried first and threw the close compositions off screen
entirely; it is now a fraction of the camera-to-target distance.

---

## 4. Quality profiles

| | Cinematic | Balanced | Lite | Essential |
| --- | --- | --- | --- | --- |
| device pixel ratio cap | 1.75 | 1.4 | 1.0 | — |
| grid | 384 × 512 | 288 × 384 | 176 × 224 | — |
| scene triangles | ~400 k | ~228 k | ~85 k | 0 |
| view distance | 2600 | 2100 | 1500 | — |
| suspended matter | 42 200 | 23 400 | 7 500 | 0 |
| bloom / DoF / aberration | ✓ ✓ ✓ | ✓ ✓ ✓ | ✗ ✗ ✗ | — |
| scene draw calls | 6 | 6 | 6 | 1 |

**Governor.** Measured frame time, exponential moving average, 90-frame
hysteresis, 240-frame cooldown, never upgrades on its own, and a listener choice
locks it permanently. It ignores the pre-flight state, which is a much cheaper
frame and says nothing about steady state.

---

## 5. Accessibility

- **Reduced motion** — rails are not travelled; each of the eighteen shots holds
  an authored still and transitions become dissolves.
- **Essential** — same clock, same cue engine, same terrain data, drawn as a
  raked-light contour relief in Canvas 2D. Selected automatically when WebGL is
  absent or lost, and available by choice.
- **High contrast** — raises separation and lifts the floor without changing
  composition; captions gain an opaque backing.
- **Screen readers** — a scene description is announced at every cue boundary.
  Conventional focusable controls exist at all times even when visual chrome is
  hidden.
- **Keyboard** — `Space` pause/resume, `Escape` close, arrows aim attention,
  `Enter` holds to cut deeper, `Tab` reaches everything.
- The lyric is live document text, never an image of text.

---

## 6. Interface law

The public frame contains the world and nothing belonging to a music player: no
navigation, album header, track list, permanent progress bar, transport tray or
branding. One discreet control reveals everything conventional and hides itself
when the pointer rests, returning on any pointer, touch, focus or key activity.
The developer cue inspector exists only under `?debug=1` and its markup is
hidden by default. All of this is asserted by the validator and the test suite.

---

## 7. QA record

Verified in a real browser against the **extracted `.nz` served over HTTP**, not
against source files. Frames are read back from the WebGL canvas at CSS
resolution with no editing or tone adjustment.

- 16 sequence beats captured at 1440 × 900, Cinematic.
- 4 quality profiles captured at the same second (37.0 s) for comparison.
- 3 portrait frames at 390 × 844, Lite.
- Reduced motion, high contrast and the utility sheet captured.
- No console errors and no failed asset loads.
- Draw calls, triangle counts and point counts recorded per profile above.

### Defects found and fixed during review

| Found | Cause | Fix |
| --- | --- | --- |
| Whole frame blurred | depth-of-field reading a wrong focal distance, plus ~100 px chromatic aberration at the corners | focus derived from the camera; aberration reduced from 0.20 to 0.0075 |
| Terrain a forest of needles | one analysis frame was finer than a grid cell, so elevation aliased | time scale 12 → 26 units/s, band width 250 → 420, ±4-frame elevation smoothing, ridge scale 13 → 3.4 |
| Peaks blown out white | `ggx()` already returns a complete BRDF and was being multiplied by 22 | weighted by Fresnel and cosine only; roughness floored at 0.42 |
| Ground the same value as the sky | fog brighter than the lit rock | fog darkened below rock; sky deepened |
| Lyric rendered as a black block | glyph interiors filled with near-black and merged at distance | interior is shaded stone, legibility fades past 420 units |
| Statistics always read "1 draw call" | `renderer.info` auto-resets on every render, so the last blit cleared it | `info.autoReset = false`, scene cost sampled before the post chain |
| Quality detected as Lite on a fast desktop | window size measured before layout | detection uses pointer coarseness and hardware, not window size |
| `authenticity.json` failed its own hash | it was declared as a component of the inventory it signs | removed from the component list; verified by content instead |

The last two were found by the validator and the test suite rather than by eye,
which is the reason both exist.
