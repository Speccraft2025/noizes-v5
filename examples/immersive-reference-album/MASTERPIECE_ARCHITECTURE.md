# Masterpiece architecture

`ExperienceDirector` coordinates independently testable systems. `AudioClock` supplies authoritative time. `CueEngine` reduces authored cues into a deterministic state. `SceneManager` selects WebGL or 2D rendering. `CameraDirector`, `MotionSystem`, `MaterialSystem`, `ParticleSystem`, `TypographyDirector`, `LyricDirector` and `TransitionEngine` project that state. `InteractionManager` handles optional presence and the returned-key interaction. `MemoryState` records discoveries. `ArchiveSystem` exposes stable information. `PerformanceGovernor` adapts quality. `AccessibilityController` selects equivalent motion and contrast behavior.

The GSAP master timeline is paused. Every animation frame reconciles its time to `audio.currentTime`; it never becomes a second clock. The developer cue inspector can jump to arbitrary authored times and reconstruct the complete state, but is omitted from production builds.

Source modules live in `masterpiece/runtime/`. The package builder concatenates them with a locally bundled GSAP runtime into one CSP-safe `experience.html`, keeping the viewer boundary offline and deterministic.

