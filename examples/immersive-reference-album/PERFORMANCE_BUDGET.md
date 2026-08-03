# Performance budget

| Metric | Gate 2 target |
|---|---:|
| Critical non-audio runtime | < 500 KB excluding locally bundled GSAP |
| Total non-audio visual assets | < 5 MB |
| Desktop | 60 FPS where feasible |
| Midrange mobile | 30 FPS minimum |
| WebGL draw calls | 1–3 |
| Active particles | 120 / 70 / 35 / 0 by profile |
| Device pixel ratio | 2 / 1.5 / 1 / 1 by profile |
| Shader programs | 1, prewarmed before entry |

The `PerformanceGovernor` samples rolling frame time and can step Cinematic → Balanced → Lite. Essential is selected for no-WebGL or explicit accessibility preference. Adaptation never changes cue timing or narrative content.

## Gate 2 measurement

This document records the superseded motion-design slice. The full-world rebuild now uses the budget in `FULL_WORLD_PERFORMANCE_BUDGET.md` and preserves this baseline for comparison.
