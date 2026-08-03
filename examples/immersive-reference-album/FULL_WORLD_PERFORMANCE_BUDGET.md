# Full-world performance budget

The package no longer targets landing-page weight. Budget is allocated to transportive value: runtime and shaders under 1.5 MB compressed; geometry under 15 MB; textures and photographic material under 20 MB; environmental audio under 8 MB; total non-album experience assets under 45 MB. A 50–80 MB final `.nz` is acceptable when added weight produces visible or audible world depth.

The current environment shares geometry and materials, uses one atlas, point-based dust, bounded shadows, adaptive pixel ratio and four quality profiles. Package size and render statistics are reported by the build and debug inspector.

## Current measurement

- Complete `.nz`: approximately 34 MB compressed.
- Inlined Three.js, GSAP, CSS and runtime HTML: approximately 478 KB uncompressed.
- Original world visuals: approximately 7.7 MB across the material atlas, panoramic environment and ephemera atlas, plus the preserved 2.5 MB cover.
- Album audio remains the dominant package weight.

The package is below the permitted 50–80 MB range because further weight was not added without a visible purpose. The budget is now permissive rather than restrictive; later device review may justify additional geometry, lightmaps or environment layers up to the documented ceiling.
