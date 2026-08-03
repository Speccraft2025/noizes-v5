# Architecture

The single app module uses package boundaries rather than premature Gradle modules:

- `data`: Room index/cache, Storage Access Framework traversal, repository, defensive ZIP parser.
- root UI: Compose for TV home, object, threshold, native Media3 player, and WebView runtime.
- `GalleryViewModel`: StateFlow boundary between UI and repository.

`manifest.json` remains authoritative. Room only stores a rebuildable local projection and playback progress. `GalleryRepository` performs I/O on `Dispatchers.IO`; scanning exposes progress without blocking Compose. Source URIs are persisted SAF grants. Removing or rebuilding the index never edits source objects.

The focused MVP deliberately has no online-service interfaces or placeholders. Those enter only when local fidelity is complete.
