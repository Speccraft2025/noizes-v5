# Transcendence Edition — *Sonic Terrain*

**Track One · "Home, Sweet Home" · Harry Macdonough, tenor, with Charles D'Almaine, violin · Victor, recorded 23 January 1902 · public domain (US)**

Authored arc: **0.000 → 104.000 seconds.** Master clock: `audio.currentTime`.

---

## 1. The premise

Every other music visual begins with a world and synchronises the music to it.
This one has no world until the recording supplies one.

`analysis/track-01.terrain.png` is the landscape. One pixel per *(time frame,
log-frequency band)* of the actual recording. The ground mesh is a plain grid
whose every vertex reads its height from that image in a vertex shader. **There
is no authored terrain geometry anywhere in this package.** Delete the audio and
there is nothing to fly through.

    forward (−Z)   = time            26 world units per second
    lateral (X)    = frequency       420 units across 6.32 octaves, 80 Hz – 6.4 kHz
    elevation (Y)  = energy          normalised dB, per-band noise floor removed

The consequence that matters: the parallel ranges running away toward the
horizon are the **harmonic series of the voice and the violin**. They undulate
because the players used vibrato. The plains are the passages where the record
is quiet. The frost at the right-hand edge is shellac surface noise. None of it
was modelled, sculpted or art-directed into being.

---

## 2. World law

| Law | Physical statement | Driven by |
| --- | --- | --- |
| **Geography is frequency** | Every octave gets equal ground. Low registers carry monumental mass; high registers are light, sharp and delicate. | constant-Q band index |
| **Elevation is energy** | Height is normalised dB with each band's own resting level subtracted, so the disc's hiss is flat ground and the music is what rises. | terrain R channel |
| **Ranges are harmonics** | Ridge salience — how far a band stands above its spectral neighbours — separates a harmonic series into distinct parallel ranges instead of one smooth swell. | terrain A channel |
| **Erosion is transients** | Per-band onsets break and scorch the surface; sustained tone leaves it smooth and stratified. | terrain B and G channels |
| **Climate is loudness** | Loudness controls environmental *force*: sun power, air clarity, how tall the world is allowed to be. Never particle count. | `loudness_medium`, `onsets` |
| **Silence is distance** | When the record breathes, the haze thins and the horizon retreats. | inverse `presence` |
| **Light is the playhead** | Music already heard stays quietly lit behind the flight; music not yet reached is held back in atmosphere. | `uPlayhead` vs vertex time |

**The music is sovereign.** No visual event delays, ducks, filters or interrupts
the master. Supplemental sound lives on separate buses and never on the music bus.

### What this recording could not give

The master is **exactly mono** — channel correlation 1.000000, maximum L/R
difference 1.04 × 10⁻⁴. The sound-field engine is implemented, but this record
has no width to give it, so the world is a single ribbon rather than a mirrored
pair. Nothing was widened, re-panned or synthesised to make the landscape look
better. The measurement is recorded in `analysis/track-01.analysis.json`.

---

## 3. The sequence

Every time below is a **measured** musical event, not an estimate by ear.

### Encounter — before the clock starts

The whole track lies below in the dark, unlit and untravelled: you can see the
shape of the record but none of it has been heard. One line of copy. No hero
heading, no play button, no branding.

**Consent gesture.** Press and hold (pointer, touch, `Enter` or `Space`). The
gesture unlocks the media element and the AudioContext together.

| Time | Beat | What happens |
| --- | --- | --- |
| **0.000** | **Atlas** | The track entire, from 210 units up. Time to the horizon, frequency left to right. |
| **0.400** | **The announcer** | The first sound is not the song: a man in 1902 speaking the title into the horn. His three measured syllables are the first three ridges below. |
| **4.600** | **Descent** | The violin's first sustained tone becomes a long unbroken range, and the view falls toward it. |
| **8.000** | **Between the ranges** | Flying in the trough between two harmonic ranges — two partials of one bowed note. Attention becomes available. |
| **15.200** | **Expanse** | Brightness peaks; the high-frequency country rises at the right and the horizon pulls away. |
| **18.650** | **The voice raises a ridge** | Measured onset of the tenor's entry. A range lifts at 614 Hz — *his own strongest partial* — and line 1 is cut into its flank as it is sung. |
| **29.500** | **Breath** | Measured breath. The ridge falls away. What was cut stays cut. |
| **31.250** | **Second line** | The flight banks across the frequency axis and line 2 is cut at 657 Hz. |
| **37.000** | **Summit** | The loudest frame of the passage. Every range reaches its greatest elevation at once. |
| **42.900 – 58.000** | **Sustain, thin air, approach** | The long sustained passage, two measured breaths, then a descent until the harmonic walls stand overhead. |
| **64.710** | **Third line — ground level** | Read off the wall of the singer's own ridge at 7 units altitude. The rock is one sustained note. |
| **75.500** | **Rise** | Measured breath; the climb out. |
| **79.040** | **Fourth line** | The longest line of the verse, cut along the crest. |
| **88.000** | **Ascent** | The climb begins; light hardens, air clears. |
| **91.500** | **Apex** | The largest low-frequency event in the slice. The entire sung verse is one continuous landform with four lines cut along its length. |
| **94.500** | **Return** | Measured end of the sung passage. Back to atlas altitude; the travelled ground is lit, the rest of the record is not. |
| **99.000** | **Condensation** | The continent draws in on itself. |
| **101.000** | **The specimen** | The complete track as a relief object, its surface the same data the world was made from. The listened portion is lit; the remainder stays in shadow. |
| **104.000** | **Final state** | The transport holds inside the record's own near-silence (`rms` 0.10, the quietest frame after 95 s). Nothing is faded and nothing is cut. |

---

## 4. Signature techniques

### 4.1 The landscape is the recording

Not a visualisation of it. The terrain image is a first-class package component
with its own SHA-256, ledgered and inspectable — open it in any image viewer and
you are looking at the world you flew through. The ground mesh is a
camera-carried grid with quadratic row spacing; all of its shape comes from a
texture fetch in a vertex shader.

### 4.2 Lyrics cut into the ridge the voice made

A line is not typeset over the image and does not float above the world. Both of
its coordinates are **measured at build time**:

- **z** = the second the sung phrase actually begins (vocal-phrase onset)
- **x** = the band the singer was actually strongest in across that phrase

The landmark mesh evaluates the *same terrain function* as the ground, so it
follows the rock exactly and cannot hover. It runs *along* the flight, so the
words pass the viewer at the speed they were sung, and it is written left to
right as the phrase is sung. Line 1 is cut at 614 Hz, line 2 at 657 Hz, line 3
at 657 Hz, line 4 at 594 Hz — the tenor's own second partial.

### 4.3 Determinism as an architecture

Every position in the world is `f(worldPosition)` or `f(seed, audioTime)`, with
no integration and no frame history. The cue reducer reads the sequence from the
beginning on every frame rather than remembering where it was. Consequences:

- seeking to any time reconstructs the exact world state immediately;
- pause, resume, tab-hide and replay are free;
- the determinism tests are real tests rather than gestures.

Only two things are stateful, and both are explicitly non-authorial: where the
listener is attending, and which lines they chose to press deeper.

---

## 5. Accessibility as direction

Reduced motion is a **different edit**: the rails are not travelled at all. Each
of the eighteen shots resolves to a single authored still composed to work as a
photograph, and the transitions become dissolves.

Essential mode (no WebGL, or chosen) draws the same terrain data, on the same
clock, through the same cue engine, as a raked-light contour relief in Canvas 2D.
The lyric is live document text, so a screen reader receives the poem rather
than a description of a picture of one.

Nothing essential is carried only by colour, by motion or by spatial audio.

---

## 6. Honest limitations

1. **Lyric alignment is not forced alignment.** The supplied `.lrc` carries
   evenly spaced reference timings (27.57 s apart) that do not match the sung
   phrases. Lines are re-anchored to measured vocal-phrase onsets by an
   order-preserving fit; declared time, aligned time and the drift between them
   are all recorded in the analysis file. Word timings inside a line are
   proportional syllable estimates and are labelled as such.
2. **The mono master gives the sound-field engine nothing to do.** Declared, not
   disguised.
3. **The edition is unsigned.** No production signing key exists in this
   repository and none was fabricated. `authenticity.json` says so.
4. **Demonstration only.** Not cleared for commercial distribution.
