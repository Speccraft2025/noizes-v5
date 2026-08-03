# The House That Remembered Us

A five-track flagship Noizes reference object: one continuous memory-house directed by the album timeline, with Guided and Explore modes, synchronized lyrics, source documentation, simulated provenance, responsive controls, and a Canvas/CSS fallback that works offline.

## Build and open

Requirements: Node 22+, `curl`, `ffmpeg`, `ffprobe`, `zip`, and `unzip`.

```bash
npm run build
npm run validate
npm test
```

Open `dist/The-House-That-Remembered-Us-Guided.nz` in the `/open` viewer. For an extracted-folder preview, serve `build/The-House-That-Remembered-Us-Guided/` with any local static server and open `experience.html`.

The default is now the **Guided Edition**: entering starts one continuous authored tour, tracks advance rooms automatically, and the main interactions are revealed memories and the unlocked-room archive. The former transport-led version is preserved at `src/experience-player.html` for comparison.

The **Masterpiece Edition** is intentionally held at Gate 2. Its rebuilt first 84 seconds are now one inhabited Three.js world: a physical `.nz` object unfolds into terrain, façade, porch, threshold and an impossible interior hall; music reconstructs materials, breath moves through architecture, a lyric forms on glass, a brass key occupies the hall table, spatial audio changes with location and a physical photograph becomes continuous with the room behind it. Three original generated atlases/panoramas and all runtimes remain local. Build it with `npm run build:masterpiece` and open `dist/The-House-That-Remembered-Us-Masterpiece.nz`.

The source snapshots and original downloads live in `sources/original/`; optimized delivery masters live only in the built object. Rebuilding never requires a network connection after these originals are present.

> The Noizes experience amplifies the emotional arc of the work. It must never compete with the work for attention.
