# Experience architecture

The audio element is the master clock. Every `timeupdate`, seek, resume, track change, and reload computes the current state from audio time; no chain of timers controls scenes. Each track timeline contains declarative cues and can be reconstructed by reducing all cues at or before the playhead.

The world is one house rendered as an archival paper-theatre on Canvas. Track changes alter the same architecture, room lighting, revealed object, lyric plane, and narrative layer. Guided Mode directs sequence and framing. The minimized Guide provides unlocked rooms, objects, archive, provenance, rights, settings, and a return to the guided sequence.

Full and Balanced use the live Canvas world; Lite reduces motion; Accessible adds contrast, suppresses decorative grain, pins lyrics, and leaves every archive function available semantically. If canvas rendering fails, playback, controls, lyrics, narrative, Guide, rights, and provenance remain ordinary HTML.

Security is intentionally narrow: a CSP blocks connections, frames, and remote runtime assets. Metadata is rendered as text. The release contains no external scripts, fonts, stylesheets, authentication, tracking, DRM, or mandatory verification.
