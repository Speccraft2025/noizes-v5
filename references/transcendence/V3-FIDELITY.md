# Transcendence V3 Spectral Fidelity

V3 preserves the approved V17 green/gold visual language, continuous terrain topology,
comfort-directed camera, deterministic bake, NED direction tracks, and offline runtime.

## Acceptance criteria

- Time maps monotonically from left to right across the traversable world.
- Frequency maps monotonically from low to high across the other world axis.
- Persistent harmonic and ridge energy determines connected mountain ranges.
- Local energy, ridge, and transient maxima determine massifs and peaks.
- Measured quiet windows and low-energy regions determine troughs and basins.
- The four-channel downsampled spectrogram remains baked into the continuous surface.
- Every source-derived macro feature records source seconds, band fraction, band index,
  frequency when available, and the measurements used to create it.
- Journey anchors use detected landmarks and retain their measured source timestamps.
- Moving a spectral structure in time or frequency must move its geography accordingly.
- V3 must never construct separate mountain slabs or valley-floor planes.

V3 is a geographic interpretation of a real spectrogram, not a literal mesh plot. Geological
regularization and cinematic scaling may shape continuity and navigability, but may not replace
or randomize the measured time-frequency structure that controls macro geography.
