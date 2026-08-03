# `.nz` package support

An `.nz` object is read as ZIP and must contain a valid `manifest.json` with non-empty `title`, `artist`, and `release_id`. `experience.entry` defaults to `experience.html`.

Validation rejects traversal/ambiguous paths, unreadable ZIPs, manifests over 1 MiB, entries over 512 MiB, and total expansion over 2 GiB. It reports duplicate paths, absent experience/cover/audio, and missing referenced tracks as collector-readable warnings. A missing signature is never described as fake and does not block safe playback.

Paths are normalized with `/`; absolute paths, `.`, `..`, backslashes that resolve to unsafe paths, and empty segments are denied. ZIP contents are not bulk-extracted during indexing.
