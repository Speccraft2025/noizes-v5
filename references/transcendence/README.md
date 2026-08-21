# Transcendence Flight Study References

These files preserve the approved perceptual references for the Transcendence v2 integration work.

- `v17-approved-flight-study.html`
  Approved landscape traversal study. This is the visual reference for terrain readability, low-altitude traversal, fog, lighting, palette restraint, and slow camera response.
- `v18-aerial-overview-study.html`
  Earlier aerial-overview study. This is the visual reference for the opening high overview and the descent from an elevated oblique read of the terrain into forward travel.

These files are not production architecture and must not be copied wholesale into Studio runtime code. They exist to preserve target behavior while implementation happens natively inside the existing Transcendence systems.

## Visual Acceptance Criteria

The integrated build is acceptable only when a real Ovacado recording demonstrates all of the following in one continuous run:

1. A true high aerial overview with multiple readable peaks, ridges, basins, and troughs visible at once.
2. A gradual transition from aerial downward-oblique framing into forward terrain traversal.
3. Travel over a detected peak rather than over abstract noise.
4. A real descent into a detected trough.
5. Sustained low traversal that preserves the V17 movement philosophy: slow positional response, slower look-target response, very slow orientation response, slow lens response, and no default shake.
6. A climb out of the trough toward a crest or pass derived from the generated geography.
7. A crest event where the camera clears the local terrain and reveals adjacent geography.
8. A readable reveal of a second nearby trough or basin beyond the crest.
9. A final descent into that adjacent trough without flattening, deleting, or otherwise cheating the terrain.

## Art-Direction Acceptance

The approved integrated preset must preserve the restrained V17 language:

- green and gold dominant palette
- grounded surface treatment rather than glossy spectacle
- fog that increases depth readability rather than hiding structure
- broad directional lighting with readable mountain relief
- subtle grain only
- overall restraint, with no default shake or hyper-reactive motion

## Integration Constraints

The production implementation must preserve:

- audio analysis
- terrain pipeline
- NED bridge
- direction tracks
- package baking
- offline runtime
- quality tiers
- deterministic behavior

## Review Stop Condition

Do not treat tests alone as acceptance.

Stop after producing one real Ovacado build recording for visual review. Merge decisions happen only after that review.
