# The House That Remembered Us

A five-track flagship Noizes reference object: one continuous memory-house directed by the album timeline, with Guided and Explore modes, synchronized lyrics, source documentation, simulated provenance, responsive controls, and a Canvas/CSS fallback that works offline.

## Build and open

Requirements: Node 22+, `curl`, `ffmpeg`, `ffprobe`, `zip`, and `unzip`.

```bash
npm run build
npm run validate
npm test
```

Open `dist/The-House-That-Remembered-Us.nz` in the Noizes `/open` viewer. For an extracted-folder preview, serve `build/The-House-That-Remembered-Us/` with any local static server and open `experience.html`.

The source snapshots and original downloads live in `sources/original/`; optimized delivery masters live only in the built object. Rebuilding never requires a network connection after these originals are present.

> The Noizes experience amplifies the emotional arc of the work. It must never compete with the work for attention.
