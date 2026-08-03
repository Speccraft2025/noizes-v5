# Masterpiece audit

## Decision

The Guided Edition is a successful portable reference object and remains untouched. The Masterpiece Edition begins in `masterpiece/` and stops at Gate 2: one final-quality 84-second vertical slice of Track One.

## Preserve

- The `.nz` package model, five-track manifest, verified Library of Congress sources, MP3/OGG masters, rights ledger, component hashes, archive metadata and offline viewer boundary.
- `audio.currentTime` as the only narrative clock.
- Explicit entry gesture, guided playback, semantic HTML, reduced-motion support and mobile-first framing.
- The single persistent house, recurring threshold, window, wallpaper, clock and tree motifs.

## Refactor

- Replace the monolithic runtime with named systems coordinated by `ExperienceDirector`.
- Replace percentage-only scene logic with authored second-based cues and deterministic reconstruction.
- Separate narrative, audio, visual, rendering, interaction, accessibility and performance state.
- Move animation choreography into a paused GSAP master timeline reconciled to the audio clock every frame.
- Replace the generic room-change overlay with spatial transformations inside the world.

## Current limits

Visual quality is limited by a single flat Canvas house, primitive rectangles, constant camera drift and no material/depth model. Emotional impact is limited by three generic text phases per track and a memory beacon that behaves like UI rather than an object in the room. Spatial depth is limited by the absence of perspective, focus, occlusion and distinct camera grammar.

Synchronization risks come from `timeupdate` granularity, asynchronous CSS timeouts and state transitions that are not reconstructed after arbitrary jumps. Performance risks in the next edition are shader cost, excessive device-pixel ratio, particle overdraw, background-tab frame spikes and mobile thermal throttling.

## Baseline

- Guided runtime: 19.7 KB HTML, one 2D canvas, roughly 90 dust points, no runtime library dependency.
- Package: approximately 26 MB, dominated by duplicated MP3 and OGG audio plus 2.6 MB cover art.
- Visual memory and frame rate were not instrumented in the Guided build; the Masterpiece slice adds a rolling frame-time governor and quality profiles.
- Viewer asset resolution is secure and offline, using validated package bytes and Blob URLs inside an opaque sandbox.

## Gate 2 success criteria

The slice must prove: ceremonial entry; audio-locked choreography; a dimensional breathing house; one environmental lyric; one tactile memory object; one spatial transition; deterministic pause/resume and debug seek reconstruction; intentional mobile framing; Cinematic/Balanced/Lite/Essential profiles; reduced motion; and no-WebGL equivalence.

