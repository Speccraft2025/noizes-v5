# CLAUDE CODE MASTER PROMPT — Build the Ultimate Noizes `.nz` Music Experience

You are working in this repository:

`/Users/speccraftmedialtd./Documents/Web/Noizes V5`

Your task is to **design, implement, test, visually review and package a completely new flagship `.nz` demonstration** using the same locally available music and synchronized lyrics as the existing reference album.

This is not a landing page, a visualizer, a streaming interface, a lyric video, a WebGL toy or a reskin of the existing House demo. It must establish a higher category: a portable, ownable, authenticated music world in which the recording becomes a place, a physical phenomenon and a collectible digital object.

Do not stop at strategy, wireframes, documentation or a proof-of-concept. Build the working experience and produce the final `.nz` package.

## Authority and creative mandate

You have full creative-direction and technical-architecture authority within the principles below. Make strong decisions without asking for approval at every step. Inspect the repository before deciding. If an approach underperforms visually, replace it. If a free local dependency or tool materially raises the ceiling, add it and ledger it. Do not wait for the user to specify the art direction, sequence, camera language or interaction design.

The standard is not “good for a web demo.” The intended reaction is disbelief: **“I did not know an album could feel like this.”**

Do not dilute quality across all five tracks too early. First build one extraordinary, complete, 90–120 second vertical slice using Track One. It must contain a beginning, transformation, climax and final state. Only extend beyond that slice if its visual, emotional and technical grammar is already exceptional.

## Non-negotiable Noizes principles

The result must remain:

- **Fully offline:** no CDN, remote font, API, analytics, telemetry, account, server rendering, runtime download or network dependency.
- **Portable:** the intact `.nz` must contain everything required by the experience and open through the existing Noizes viewer boundary.
- **Ownable:** it behaves like a discrete album object, not rented access to a URL.
- **Authenticated:** preserve the manifest, component hashes, authenticity inventory, archive/history records and rights/provenance ledger. Never fabricate a production signature or secret key. If no signing key exists, label the signature honestly as a development placeholder.
- **Durable:** the experience must reconstruct deterministically from the recording time and continue to work without a service or vendor account.
- **Artist-first:** technology amplifies the emotional logic of the recording. It must not become a competing tech showcase.
- **Private by default:** no tracking, fingerprinting or background communication.
- **Accessible:** equivalent meaning and control must survive reduced motion, keyboard navigation, high contrast, screen readers and no-WebGL fallback.

## Demo-use instruction for supplied music and lyrics

The existing local music and lyrics are explicitly authorized by the project owner for this non-commercial demonstration. Do not block the build with repeated licensing warnings and do not replace the supplied music with stock music. Reuse the project’s existing local source audio, delivery audio, lyrics and source documentation.

This instruction does not authorize new unlicensed third-party media. Any new visual, font, runtime, model, sound layer or library must be original, generated locally, public domain, or under a free licence compatible with this demonstration. Record it accurately in the asset-rights ledger. Label the resulting edition as **demo-only / not cleared for commercial distribution** without interrupting the public experience.

## Existing source of truth

Start by reading:

- `CLAUDE.md`
- `examples/immersive-reference-album/README.md`
- `examples/immersive-reference-album/MASTERPIECE_ARCHITECTURE.md`
- `examples/immersive-reference-album/WORLD_STATE_MODEL.md`
- `examples/immersive-reference-album/FULL_WORLD_CREATIVE_DIRECTION.md`
- `examples/immersive-reference-album/FULL_WORLD_PERFORMANCE_BUDGET.md`
- `examples/immersive-reference-album/scripts/build.mjs`
- `examples/immersive-reference-album/scripts/build-masterpiece.mjs`
- `examples/immersive-reference-album/scripts/validate-masterpiece.mjs`
- `examples/immersive-reference-album/tests/*.test.mjs`

Reuse the audio and lyrics produced by the current build:

- `examples/immersive-reference-album/build/The-House-That-Remembered-Us-Guided/audio/`
- `examples/immersive-reference-album/build/The-House-That-Remembered-Us-Guided/lyrics/`
- `examples/immersive-reference-album/build/The-House-That-Remembered-Us-Guided/timeline/`
- `examples/immersive-reference-album/build/The-House-That-Remembered-Us-Guided/metadata/`

The preserved originals live under:

- `examples/immersive-reference-album/sources/original/`

Do not modify or delete the Guided Edition, Masterpiece Edition, their source snapshots, or their output packages. Create a new parallel source tree, build script, validator, tests, build directory and uniquely named `.nz` output.

Recommended working identity:

- Source: `examples/immersive-reference-album/transcendence/`
- Build: `examples/immersive-reference-album/build/The-House-That-Remembered-Us-Transcendence/`
- Output: `examples/immersive-reference-album/dist/The-House-That-Remembered-Us-Transcendence.nz`
- Commands: `npm run build:transcendence` and `npm run validate:transcendence`

You may choose a stronger edition name if it emerges from the finished work, but keep all paths additive.

## Creative north star: enter the recording itself

Make this edition radically distinct from the House experience. Do not build another house, gallery, room menu, cover-art animation or conventional 3D environment.

The listener should cross into **the interior physics of the recording**. Rhythm becomes gravity. Harmony becomes scale and atmosphere. The voice produces matter, weather and memory. Silence changes distance. Lyrics do not sit on top of the image; they become physical evidence inside the world.

A promising direction is an impossible living instrument or memory cathedral assembled from waveform energy, resonant surfaces, suspended archival fragments and volumetric light. Treat this as a starting hypothesis, not a mandatory literal design. Replace it if you discover something more powerful while working with the actual music.

The sequence should create at least these emotional functions:

1. **Encounter:** The unopened `.nz` exists as a desirable, physical-feeling object in darkness. It has thickness, surface, weight and quiet behaviour. No hero heading.
2. **Consent:** One meaningful gesture crosses the threshold and starts the recording. This is not a decorative “Play” button.
3. **Translation:** The first musical information generates spatial law—scale, gravity, matter, weather or light.
4. **Embodiment:** The listener feels positioned inside the recording through camera, parallax, spatial sound and near-field events.
5. **Voice:** The vocal does something impossible yet musically inevitable. Lyrics appear as condensation, fracture, embossing, shadow, particles, refraction, threads, topology or another material event—not subtitles floating over the scene.
6. **Participation:** One or two optional presence-based interactions let the listener influence attention or reveal memory without changing the authored musical arc.
7. **Overwhelming convergence:** At the musical peak, separate systems become one coherent event. Avoid random particle explosions and generic beat pulses.
8. **Residue:** The world leaves behind an owned artefact, changed surface, recovered memory or authenticated edition state. The ending should feel collectible and replayable.

The music is sovereign. Never delay, remix, duck or interrupt the master recording merely to accommodate a visual effect. Any supplemental sound must support spatial perception and remain subordinate.

## Interface law

Anything resembling ordinary music consumption must disappear from the primary experience.

- No top navigation, brand bar, album header, playlist, track cards, permanent progress bar, previous/next buttons, large play button, guide button or visible player tray.
- No visible “NOIZES” branding during the world experience. Provenance belongs in the object/archive layer.
- The public frame should contain only the world and elements that belong diegetically inside it.
- One discreet universal icon may reveal a utility sheet containing pause/resume, seek, volume, captions/lyrics, guide, quality, accessibility, credits and exit.
- Hide that icon when the pointer is inactive; restore it immediately on pointer, touch, focus or keyboard activity.
- Support Space for pause/resume, Escape for closing utility layers and an accessible direct route to controls.
- On screen readers, expose stable conventional controls even when visual chrome is hidden.
- Never make essential pause, volume or exit behaviour dependent on a gesture that accessibility technology cannot perform.

The opening action may contain a triangular affordance only if it reads as part of the object rather than an app playback button.

## Technical foundation

Retain and advance the current zero-service stack:

- semantic HTML and CSS
- modern local JavaScript modules bundled into the package
- Three.js/WebGL2 as the dependable spatial renderer
- GSAP only as a paused choreography evaluator reconciled to the audio clock
- Web Audio API for analysis, buses, procedural ambience and spatial perception
- Canvas 2D and semantic DOM for fallback and stable information
- Node 22 build, validation and test scripts
- `ffmpeg`/`ffprobe`, zip/unzip and local asset tooling

You may add free, open-source build-time or runtime technology when it clearly improves the result. Suitable candidates include:

- glTF 2.0 assets and animation
- KTX2/Basis Universal texture compression
- Meshopt geometry compression
- free Three.js postprocessing passes or small custom passes
- custom GLSL shaders and signed-distance-field effects
- Rapier or another permissively licensed physics engine for a small number of meaningful physical interactions
- precomputed audio-feature analysis using local `ffmpeg`, Web Audio or a small permissive library
- Blender command-line tooling if already installed and useful

Do not add a framework or dependency simply because it is fashionable. Do not introduce React, a game engine, cloud asset processing, subscription software, proprietary SDKs or an online build service unless the existing viewer genuinely requires it. Runtime dependencies must be bundled locally, licence-ledgered and CSP compatible.

Progressive enhancement is welcome: WebGPU, device orientation, vibration, HDR-like rendering or advanced filters may enrich supported devices, but WebGL2 remains the baseline and every feature requires a graceful fallback. Do not make WebXR hardware mandatory.

## Music-derived direction, not generic audio reactivity

Create a deterministic, build-time analysis of Track One and store it inside the package. At minimum derive:

- waveform envelope
- short- and medium-window loudness
- low/mid/high energy bands
- onset and transient confidence
- spectral centroid or brightness
- spectral flux or change
- section boundaries
- existing lyric-line timings
- editable word-level timing estimates where useful

Save the result as documented JSON with its source audio hash and analysis parameters. The runtime must sample this data by `audio.currentTime`. Do not use microphone input or a second free-running animation clock.

Author meaningful cues on top of analysis. Raw frequency bins must not directly drive every object. A cue should express interpretation: “the vocal opens the membrane,” not “bass value scales mesh.”

Seeking, pause/resume, visibility changes and replay must reconstruct the same world state deterministically. Ambient noise may drift while paused only when it does not alter authored state.

## World-quality requirements

Avoid the recognizable weaknesses of browser demos:

- no primitive-box architecture presented as finished art
- no empty black background with particles
- no flat poster textures pretending to be environments
- no generic bloom-and-neon cyber aesthetic
- no excessive fog hiding missing detail
- no fake depth created solely with gradients
- no illegible tiny typography
- no indiscriminate camera shake
- no constant motion
- no effects without emotional function

Deliver convincing near, middle and far fields. Use occlusion, contact shadows, scale references, lens behaviour, foreground passage, room tone and parallax so the listener feels bodily located. Materials need variation, edge response and a believable relationship to light. Camera movement must have inertia, restraint and a motivated target.

Build at least one signature technique that is not already present in the House demo—for example a voice-driven topology field, a seamless transition from physical object to volumetric score, a lyric that exists across several depths and resolves only from one camera position, or an authenticated artefact generated from the listener’s completed journey. Document how it works.

## Asset and package budget

The total `.nz` may be **50–100 MB compressed**. This is permission to pursue depth, not permission to pad the archive.

Suggested budget:

- album audio and lyrics: reuse existing delivery assets
- runtime, shaders and optional WASM: up to 4 MB compressed
- geometry and animation: up to 20 MB compressed
- textures, lightmaps, atlases and photographic material: up to 35 MB compressed
- environmental and object sound: up to 10 MB compressed
- analysis, timelines, metadata and documentation: up to 5 MB compressed

Every large asset must have a visible or audible purpose. Prefer carefully authored hero assets over many mediocre assets. Generate lower-resolution variants for Lite mode. Do not duplicate the same uncompressed source in several package locations.

Use only free tooling. A dependency that requires a commercial runtime licence, paid cloud service, per-package fee or user subscription is disallowed.

## Audio experience

The master track remains full quality and central. Build a local audio graph with separate buses for:

- master music
- world ambience
- close objects
- transition energy
- accessibility narration if present

Use spatial layers to establish location, not to drown the historical recording. Procedural ambience is encouraged when it is authored, subtle and reproducible. Filter and occlude world sound as the listener crosses boundaries. Avoid fake “8D audio” panning and aggressive master processing.

If the browser or viewer prevents autoplay, the threshold gesture must unlock both media playback and the AudioContext in one action. Display a diegetic recovery affordance if playback fails.

## Performance and adaptation

Create four deliberate profiles:

- **Cinematic:** full-resolution hero treatment for strong desktop GPUs
- **Balanced:** default desktop/tablet profile
- **Lite:** reduced texture resolution, postprocessing, particles, shadows and render scale
- **Essential:** semantic/audio-led 2D fallback with the complete emotional and lyric arc

Targets:

- 60 fps on a capable recent desktop in Balanced mode
- stable 30 fps or better on a representative phone in Lite mode
- first meaningful frame without waiting for all optional assets
- no unbounded allocations, listeners, animation frames, audio nodes or GPU resources
- context-loss recovery or an immediate Essential fallback

Build a performance governor using measured frame time with hysteresis. Do not downgrade after one slow frame. Respect user-selected quality until the session ends.

## Accessibility as art direction

Accessibility is not a settings appendix. Provide:

- reduced-motion choreography designed scene by scene, not merely CSS animation removal
- stable synchronized lyrics in the utility sheet
- meaningful scene descriptions updated at cue boundaries
- keyboard-operable interactions
- visible focus when controls are revealed
- high-contrast mode
- captions for meaningful non-musical sound
- Essential mode that still feels authored
- no essential information encoded only by colour, spatial audio or motion

The reduced-motion version should replace travel with dissolves, lighting changes, focus shifts and meaningful still compositions.

## Package integrity and cost discipline

Preserve or improve the existing `.nz` contract:

- manifest component inventory
- SHA-256 for every declared component
- authenticity inventory
- edition metadata
- archive/history records
- rights and provenance ledger
- accessibility metadata
- technical metadata
- offline README
- deterministic timeline and analysis files

No credentials, private keys, API tokens or machine-specific absolute paths may enter the package or Git diff. Run the repository’s credential/secret checks before any requested commit or push. Do not bypass pre-push protection.

The experience must impose zero ongoing hosting, API, inference or licence cost. Build-time use of free local tools is allowed; paid online generation is not a dependency of rebuilding the package.

## Required implementation structure

Create, at minimum:

- a new isolated source directory
- modular runtime systems for audio clock, cue reduction, analysis sampling, world rendering, camera, materials/shaders, interaction, spatial audio, accessibility, archive and performance
- a dedicated build script
- a dedicated validator
- automated tests
- a unique package build directory and `.nz` output
- a developer-only cue inspector activated by `?debug=1`
- a frame-review directory and HTML contact sheet not included in the release package
- creative-direction, sequence, camera, lighting, material, shader, spatial-audio, accessibility, performance and QA documents

Do not expose the cue inspector or debug controls in the production public interface.

## Mandatory quality gates

### Gate 0 — protect the repository

- Inspect Git status and preserve unrelated user work.
- Do not overwrite existing demos.
- Inventory available audio, lyrics, tools, dependencies and viewer constraints.

### Gate 1 — treatment and score map

- Listen to or analyse Track One locally.
- Produce a timestamped 90–120 second treatment with emotional intention, camera, world state, lyric behaviour, sound and interaction.
- Define the signature technique and final residue/artefact.
- Then proceed directly into implementation.

### Gate 2 — extraordinary vertical slice

- Build the entire chosen sequence at final quality.
- The sequence must include the actual audio and synchronized lyrics.
- Do not expand to other tracks until this gate is visually approved through rendered frames.

### Gate 3 — real browser review

- Serve the extracted package locally and test the package output, not only source files.
- Review at opening, transformation, first vocal, signature interaction, climax and ending.
- Capture desktop frames at every major beat.
- Capture at least one 390 × 844 portrait frame.
- Test Cinematic, Balanced, Lite, Essential, reduced motion, high contrast and a simulated WebGL failure.
- Inspect console errors, missing assets, playback state, draw calls, triangles, texture counts and frame time.
- Fix visual and runtime failures before continuing.

### Gate 4 — package verification

- Build the final `.nz`.
- Validate required files, component hashes, manifest references, rights-ledger coverage, offline CSP, absence of external URLs, unresolved runtime markers and credentials.
- Test archive integrity with `unzip -t`.
- Run all existing tests plus new regression tests.
- Report exact package size and asset allocation.

## Tests that must exist

Add tests proving:

- the new edition builds without mutating previous editions
- the `.nz` is offline and archive-valid
- every manifest component exists and matches its size/hash
- every audio and new media component is ledgered
- no external runtime URL or network request exists
- audio time is the only authored clock
- cue reduction reconstructs the same state after seeking
- lyrics remain ordered and synchronized
- conventional player/navigation chrome is absent from the primary interface
- utility controls and keyboard alternatives remain accessible
- all four quality modes and reduced motion preserve narrative meaning
- a missing WebGL context selects Essential mode without losing playback or lyrics
- the local Three.js/runtime bundle contains its required core namespace and no unresolved ESM conversion markers
- no secret-like credentials appear in the package or generated diff

## Definition of done

The task is complete only when all of the following are true:

1. A new, uniquely named `.nz` package exists in `examples/immersive-reference-album/dist/`.
2. The package opens offline and uses the real supplied Track One audio and lyrics.
3. The experience contains a complete 90–120 second authored arc, not disconnected effects.
4. The world visibly exceeds the existing Masterpiece demo in composition, material finish, transition invention and emotional synchronization.
5. Conventional player chrome is hidden behind one discreet icon while accessible controls remain available.
6. Browser-captured desktop and mobile frames prove the implemented result.
7. No fresh console errors remain.
8. The dedicated validator and all automated tests pass.
9. Archive integrity passes.
10. Package size is reported honestly; 50–100 MB is acceptable when the weight has purpose.
11. No existing edition, unrelated work or user-owned file has been damaged.

## Final report format

Lead with the delivered experience, not the implementation process. Include:

- clickable path to the new `.nz`
- one-paragraph creative description
- the finished timestamped sequence
- signature technical/creative achievements
- actual package size and asset breakdown
- measured rendering statistics
- accessibility and fallback results
- validator/test/archive results
- clickable frame-review page
- three representative screenshots
- any honest limitation that remains

Do not claim a visual or playback result you did not render and inspect. Do not call the work finished while the package is still recognizably a website, music player, generic visualizer or collection of placeholders.

Begin now by auditing the current repository and protecting the existing editions. Then build the new experience through Gate 4 without stopping at the plan.
