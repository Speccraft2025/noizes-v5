# The House That Remembered Us — rooms test release

A playable Noizes release as a four-floor house: a corridor on every floor, five doors per corridor, a room for each song. It is one release-specific experience, not a Studio template.

- Package: `dist/The-House-That-Remembered-Us-Rooms.nz` (one ZIP, entry `experience.html`)
- Source: `src/`, `release.json`, `scripts/`
- Stills: `screenshots/` (`05-all-twenty-rooms.jpg` shows every room, silent)

## Open it

1. **Noizes viewer:** open `/open` and choose the `.nz`. This is the only way the room video plays on a phone, and it needs the viewer change described under "Video".
2. **Directly:** `npm run serve` in this folder, then open `http://localhost:4311/experience.html`.

Controls: tap or click doors and objects; drag to look; `1`–`5` door on this floor, `0`/`H` corridor, `PageUp`/`PageDown` or `L` lift, `A` tour on/off, `T` room list, `Space` play/pause, `Esc` back.

## What is in the house

- **Four floors, twenty rooms.** Ten layouts, each built twice with a different colour, size and light (`ROOM_DEFS` in `src/world.js`): listening room, rain room, light wall, still room (orb), courtyard, bar, neon studio, fireside library, bath house, terrace.
- **Songs.** `release.json` lists the tracks; rooms are filled by cycling through them (four songs across twenty rooms in this test), or by hand with `rooms.assign`. Nadai Kurap is the supplied 24-bit WAV; the others are the supplied MP3s. All are packaged byte for byte.
- **Tour (on by default).** After you step into the corridor it walks you into room 1, and when each song ends it walks on to the next room, taking the lift between floors. Turn it off in the room list or with `A`. It never interrupts a song.
- **Lift.** Brass doors on the left near the entrance, or the Lift button. A fade, then the corridor is re-dressed for that floor.
- **Guide.** One short tip at a time, each shown once: front door, corridor, first room, screen, note, lift, hidden item. "Show tips again" is in the room list.
- **Hidden reward.** `eggs` in `release.json` places a plant in a room (`room`, 0-based) or a corridor (`floor`, 1-based). Tapping it shows a card with a code. The current code and text are samples.
- **Corridor pictures.** `frames` in `release.json`: stills are scaled down; a `.gif` (or `animate: true` as a stand-in) becomes a sheet of 16 frames the house steps through. Four frames per floor, cycling through the list.
- **Notes.** `notes` in `release.json`, keyed by room number (0-based). The current text is a placeholder.
- **Video.** `screen` on a track puts a screen on a stand in every room that plays that track. Tap it to watch.

## Audio reactivity

Each song is read live while it plays (`E.levels` in `src/audio.js`): bass, mids, highs, overall level, kick, snare and hi-hat hits, and sixteen spectrum bands. Every room has its own response, for example a spectrum wall, woofers that kick, rings on water, neon tubes per band, a fire that flares with the bass, string lights that twinkle on hi-hats. In every room the lights swell with the level, the lamp glow pulses with the bass and the view nudges on kicks. In the corridor the door you are facing glows and pulses with its song. Without an audio graph (opened as a local file) the rooms follow the pre-analysed energy and tempo instead. Reduced motion damps all of it.

## Speed

The first version drew and lit the whole house every frame. This one keeps only the corridor and the room you are in (or walking to):

| Corridor view | Before | Now |
|---|---|---|
| Objects drawn | 695 | 180 |
| Lights | 17 (7 with shadow maps) | 5 (1 with a shadow map; none on phones) |
| Frame cost on the development Mac | 2.56 ms | 0.37 ms |

Also: walls and furniture use a cheaper material, each plant is one mesh, the screen redraws 15 times a second, and the house steps down by itself if a device averages under about 42 frames a second (resolution, then the glow-and-grade pass, then resolution again). These numbers are from one fast laptop; they show the relative change, not what a phone will reach.

## Video

In the viewer, the house asks the viewer to show the player (`noizes:media:open`). The viewer (`studio/src/routes/open/+page.svelte`, `studio/src/lib/utils/viewer.js`) accepts only a bare 11-character YouTube id, builds the `youtube-nocookie.com` embed itself, and offers full screen (or fills the viewer where the browser refuses). Served directly, the house shows the player in its own overlay. The video is the only thing that needs the internet.

## Rebuild

```
npm run analyze   # only when source-audio/ changes
npm run build
npm run validate
```

`source-audio/` holds the supplied masters and is not committed.

## Checks run (2026-11-14)

- Project validator: valid, 24 passed, 0 failed, 1 warning (unsigned local build). Audio byte-identical to the supplied files.
- Studio tests: 706 passed.
- Direct preview: all 20 rooms build; tour walks into room 1 and moves on at song end; travel across floors and under rapid changes; only one song ever playing; lift menu; hidden plant found by tap; note; video overlay.
- Viewer (`/open`, local): package opens, tour runs in real time, video plays through the viewer.
- Phone-size preview (375×812): corridor and a room.

Not checked: a physical phone or tablet, iPhone Safari, playing every song to its end in real time, and frame rate on any device other than the development Mac.

## Assumptions

- Titles are the filenames; artist, credits and lyrics are blank because none were supplied.
- Ujuzi ft Fello replaced Nakili in the first version; with four songs available, Nakili is back as track 4.
- Notes, the reward code and the animated picture are stand-ins.
- The entrance still shows the supplied exterior image projected onto simple geometry (`src/matte.js`); `plates/` holds guide images for re-rendering each stop.
