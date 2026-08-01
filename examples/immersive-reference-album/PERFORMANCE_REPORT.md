# Performance report

The runtime is one HTML file with no library or network dependency. Visuals use a single 2D canvas, CSS gradients, and at most 55 dust points; no model, texture, shader, or video allocation is required. Audio is preloaded one track at a time. Full/Balanced/Lite/Accessible retain the same music, narrative, lyrics, rights, provenance, and navigation.

The package intentionally includes MP3 and OGG fallbacks, increasing archive size but improving long-term playback coverage. A production Studio compiler should select codecs per target and expose the duplication cost before export.
