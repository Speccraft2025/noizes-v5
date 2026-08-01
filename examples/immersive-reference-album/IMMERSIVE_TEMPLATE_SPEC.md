# Immersive creator template specification

## Authoring model

`ALBUM → TRACK → CHAPTER → SCENE → SHOT → CUE → OBJECT → TRANSITION`

Studio should ask creators to direct music experiences, never build webpages. The creator interface needs a media library, album timeline and waveform, track markers, LRC editor, scene/shot list, camera and lighting presets, object placement, cue inspector, transitions, exact-package preview, device/performance testing, accessibility preview, rights ledger, and package validation.

## Guided authoring

Choose an emotional arc and visual language; Studio proposes rooms, shots, lyric moments, safe transitions, and reduced-motion equivalents. Creators adjust intent with plain-language controls such as “reveal at chorus” and “hold attention on the lyric.”

## Under the hood

Advanced mode exposes deterministic cue data, camera targets, easing, object state, performance budgets, fallback mappings, preloading, and timeline reconstruction. Every visual cue requires an emotional-purpose note, a fallback, and an accessibility equivalence.

Reusable systems proven here: audio-master scheduler, seek reconstruction, continuous scene state, Guide/unlock model, physicalized lyrics, object taxonomy, mode degradation, edition/certificate views, simulated provenance labelling, source-evidence ledger, hash inventory, and offline CSP.

Recommended integration: add the immersive extension as additive namespaced manifest data; compile creator data into the existing normalized release model; teach the current validator about timeline ordering, LRC monotonicity, ledger coverage, and remote-resource bans without weakening existing checks.
