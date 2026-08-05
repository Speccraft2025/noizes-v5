/**
 * In-app guidance for the Studio, mirroring docs/STUDIO-GUIDE.md.
 *
 * This is data, not markup, so the same words can appear in a tooltip, a step
 * panel, or the printed manual without being written three times and drifting
 * apart. Every `required` entry below corresponds to a field the compiler
 * actually refuses to build without — see help/blockers.js for the wiring.
 */

/** The eight Studio steps, in order. Ids match `steps` in the Studio page. */
export const STEP_IDS = { IDENTITY: 1, TRACKLIST: 2, ASSETS: 3, LYRICS: 4, EXTRAS: 5, EXPERIENCE: 6, EDITION: 7, PUBLISH: 8 };

/**
 * What a `.nz` is, said once, in the place a first-time creator will read it.
 * Shown on step 1 and never again unless asked for.
 */
export const PRIMER = {
  title: 'What you are making',
  body: 'A .nz is not an upload. It is a finished object: one file holding the music, '
    + 'the artwork, the words, the credits and the rights record, with a fingerprint of '
    + 'every piece inside it. When a collector opens it, nothing is fetched. That is why '
    + 'Studio asks for more than a file and a title.',
};

export const STEP_HELP = {
  [STEP_IDS.IDENTITY]: {
    label: 'Identity',
    settles: 'What this release is and who made it.',
    required: ['Release type', 'Release title', 'Primary artist', 'Year'],
    advice: {
      title: 'Get the artist name right now',
      body: 'It threads through the manifest, the credits and the provenance record. '
        + 'Changing it later means compiling again.',
    },
  },

  [STEP_IDS.TRACKLIST]: {
    label: 'Tracklist',
    settles: 'The works, in order, with their own credits.',
    required: ['At least one track, with a title'],
    advice: {
      title: 'A single still needs a tracklist',
      body: 'One track is a complete tracklist. The structure is identical either way, '
        + 'which is why an album is no harder to build than a single. The order here is '
        + 'the order a collector hears.',
    },
  },

  [STEP_IDS.ASSETS]: {
    label: 'Assets',
    settles: 'The actual audio and images.',
    required: ['Main cover image', 'A primary master for every track'],
    advice: {
      title: 'Upload the best quality you have',
      body: 'A .nz is meant to be the definitive copy, not a preview. Watch the size '
        + 'estimate as you add files: lossless masters across a long album make a large '
        + 'object. That is a legitimate choice, just make it knowingly.',
    },
  },

  [STEP_IDS.LYRICS]: {
    label: 'Lyrics',
    settles: 'The words, timed if you want them to move.',
    required: [],
    advice: {
      title: 'Stored as text, not pictures of text',
      body: 'Screen readers get the poem. Search finds it. It survives. Untimed lyrics '
        + 'still ship and still display, they simply sit still.',
    },
  },

  [STEP_IDS.EXTRAS]: {
    label: 'Extras',
    settles: 'What surrounds the music.',
    required: [],
    advice: {
      title: 'All of this is optional',
      body: 'A release with no statement, links or notes is still complete. Add these '
        + 'when you have something to say, not to fill the form.',
    },
  },

  [STEP_IDS.EXPERIENCE]: {
    label: 'Experience',
    settles: 'How the object behaves when someone opens it.',
    required: [],
    advice: {
      title: 'Built from what you actually included',
      body: 'The default journey is assembled from your package contents. Add no lyrics '
        + 'and no lyrics moment appears. Reorder or rename the moments, or let collectors '
        + 'explore freely instead.',
    },
  },

  [STEP_IDS.EDITION]: {
    label: 'Edition',
    settles: 'How many exist and what they cost.',
    required: ['Edition name', 'Fixed supply', 'Price'],
    advice: {
      title: 'Supply is a commitment, not a setting',
      body: 'The number is recorded inside the object and cannot quietly change '
        + 'afterwards. Choose one you are willing to honour permanently.',
    },
  },

  [STEP_IDS.PUBLISH]: {
    label: 'Publish',
    settles: 'Verify, preview, compile, release.',
    required: ['Every blocker below cleared'],
    advice: {
      title: 'Preview before you publish, every time',
      body: 'Preview is the only place you see the finished experience rather than the '
        + 'form you filled in. Check the cover, play the first track, read your statement. '
        + 'If a compile fails your draft is untouched.',
    },
  },
};

/**
 * Field-level tooltips, one per input a creator can touch.
 *
 * Each answers the same two questions in the same order: what is this, and
 * what do I put in it. Entries open with "Required" or "Optional" because
 * that is the thing people actually scan for — a creator wanting to reach a
 * finished object fastest should be able to read only the Required ones.
 *
 * Keyed by a stable id, so rewording a label never breaks a tooltip.
 */
export const FIELD_HELP = {
  // ── Step 1 · Identity ──────────────────────────────────────────────────
  release_type: 'Required. Single, EP, album, mix, compilation or live. This choice changes which other fields Studio asks you for, so set it first.',
  title: 'Required. The release title as it should be remembered. Written into the manifest and every collector record.',
  artist: 'Required. The artist or band name exactly as it should appear forever. It threads through the credits and the provenance record, so changing it later means compiling again.',
  featured_artists: 'Optional. Comma-separated. These names appear in the credits, not in the main artist line.',
  compilation_artists: 'Optional. The artists gathered on this compilation, comma-separated. The curator goes in the primary artist field above.',
  label: 'Optional. Your label, or your own name if you release independently.',
  curator: 'Optional. Who chose and sequenced this collection.',
  compiler: 'Optional. Who assembled the material. Often the same person as the curator.',
  event_name: 'Optional. The concert, session or occasion this recording captures.',
  venue: 'Optional. Where it was performed — venue and city.',
  recording_date: 'Optional. When it was recorded, as distinct from when it is released.',
  year: 'Required. The year of release. The object carries its own date in its record.',
  release_date: 'Optional. The exact day, if the day matters. Only the year above is required.',
  genre: 'Optional. One or more genres, comma-separated. Helps collectors shelve and find it.',
  location: 'Optional. Where the work comes from, for example "Nairobi, KE".',
  catalogue_number: 'Optional. Your own reference for this release, such as NZ-001. Worth setting if you plan a series.',
  release_id: 'Generated for you, and not editable. The permanent internal identifier for this release.',
  description: 'Optional. A short statement about the complete work. Collectors tend to read this first.',

  // ── Step 2 · Tracklist ─────────────────────────────────────────────────
  disc_number: 'Which disc this track belongs to. Leave at 1 unless you are building a multi-disc release.',
  track_number: 'Position within the disc. This is the order a collector hears, so reorder here rather than renaming files.',
  track_title: 'Required. The title of this musical work, as it should appear in the tracklist.',
  track_subtitle: 'Optional. A movement, mix or performance qualifier — "Live at the Alliance", "Radio Edit".',
  track_artist: 'Required. Who performed this track. Use "Use release artist" if it is the same as the release.',
  track_featured: 'Optional. Guests on this track specifically, comma-separated.',
  track_producers: 'Optional. Producers for this track, comma-separated.',
  track_writers: 'Optional. Writers and composers, comma-separated. This is the songwriting credit, not the performance.',
  track_isrc: 'Optional. The 12-character industry recording code, if this track already has one. Leave empty if not.',
  track_description: 'Optional. Context, recording notes, or what the movement is doing.',
  track_inherit_credits: 'On by default: this track uses the release credits from the Publish step. Switch it off only if this track had a different team.',
  track_credits: 'Credits that apply to this track alone — performance, arrangement, engineering, mastering. One per line.',
  track_release_date: 'Optional. Use when a track was released earlier as a single.',
  track_recording_date: 'Optional. When this specific take was recorded.',
  track_recording_location: 'Optional. The studio, hall or room this track was captured in.',
  source_release: 'Optional. Where this recording came from originally — an earlier album or an archive.',
  track_flag_explicit: 'Tick if the lyrics contain explicit language. Players and stores read this flag.',
  track_flag_bonus: 'Tick if this sits outside the main run of the record — an extra rather than part of the sequence.',
  track_flag_hidden: 'Tick to keep this off the visible tracklist. It still ships inside the object for a listener who finds it.',
  track_flag_journey: 'On by default. Untick to leave this track out of the guided listen while keeping it in the package.',
  track_flag_archive: 'On by default. Untick to leave this track out of the browsable archive view.',

  // ── Step 3 · Assets ────────────────────────────────────────────────────
  main_cover: 'Required. The face of the object. Supply the largest version you have — it is embedded in the file, not linked to, so it will never go missing but it also cannot be improved later.',
  primary_master: 'Required for every track. WAV, FLAC, MP3 or M4A. Upload the best quality you hold: this is the definitive copy, not a preview.',
  continuous_master: 'Optional. One unbroken mix or concert recording that plays across the whole release, instead of track-by-track.',
  track_artwork: 'Optional. A per-track image. It must belong to the same track or the compiler will reject it.',

  // ── Step 4 · Lyrics ────────────────────────────────────────────────────
  lyric_language: 'The language of the lines below, as a short code such as en or sw. Add a separate set for each translation.',
  lyrics_text: 'Paste the words, one line per line. Timed lyrics move with the music; untimed lyrics still ship and still display, they simply sit still.',
  translation: 'Optional. Add as many languages as you like, each with its own language code.',
  lyric_credits: 'Optional. Who wrote the words, and who translated them.',

  // ── Step 5 · Extras ────────────────────────────────────────────────────
  story: 'Optional. Your artist statement or liner note — what lives behind this work. This is the longest piece of writing a collector will see.',
  // The three inputs of a link are one card and read as one idea, so they get
  // one explanation on the section rather than three marks per repeated row.
  extras_links: 'Optional. Each link needs a name a collector will recognise, a type, and a full https:// address. Links point outward, so unlike everything else in the object they need a network to work.',
  note_wall: 'Optional. PDFs kept inside the object: lyric booklets, scores, sleeve notes. They travel with the music.',

  // ── Step 6 · Experience ────────────────────────────────────────────────
  nav_track_skip: 'Lets a listener jump straight to any track. Turn off to hold them to the running order you authored.',
  nav_seek: 'Lets a listener scrub within a track. Turn off if a piece depends on being heard whole.',
  nav_shuffle: 'Off by default, and best left off: shuffle breaks an authored sequence.',
  nav_repeat: 'Lets a listener loop a track or the release.',
  nav_resume: 'Reopens the object where the listener stopped, rather than starting over.',
  nav_archive: 'Lets a listener browse the archive without leaving the guided listen.',
  playback_mode: 'How one track becomes the next: a clean gap, or a crossfade. Set the feel of the whole listen here.',
  crossfade_duration: 'How long each crossfade lasts, in milliseconds. 2000 is two seconds. Applies everywhere unless a pair overrides it.',
  track_crossfade: 'Overrides the global crossfade for this one join, when a particular transition needs more or less room.',
  moment_type: 'What kind of moment this is — words, an image, a document, or a change in atmosphere.',
  moment_placement: 'Whether it appears before the music, at a point during a track, or after the last note.',
  moment_time: 'Where in the track it appears, in seconds from the start.',
  moment_anchor: 'Which track this moment is attached to.',
  moment_title: 'The heading a collector sees when this moment arrives. Keep it short.',
  moment_effect: 'The atmosphere to shift to as this moment lands.',
  moment_body: 'The words themselves, or a direction to yourself about what should happen here.',
  moment_asset: 'The image or document to show. It must already be in the package, so add it in Assets or Extras first.',
  moment_duration: 'How long the moment stays on screen, in milliseconds, before the experience moves on.',

  // ── Step 7 · Edition ───────────────────────────────────────────────────
  edition_name: 'Required. The public name of this pressing, for example "Inaugural Pressing".',
  edition_description: 'Optional. What makes this pressing worth owning. Shown to collectors at the point of acquiring.',
  edition_size: 'Required. A positive whole number, recorded inside the object and unable to change quietly afterwards. Choose one you are willing to honour permanently — this is the promise.',
  price: 'Required. Must be greater than zero.',
  currency: 'The currency the price above is stated in.',
  transferable: 'Whether a collector may resell or pass on their copy. Off means the copy stays with the person who bought it.',

  // ── Step 8 · Publish ───────────────────────────────────────────────────
  copyright: 'The copyright line for the release, usually "© year, name".',
  license: 'What you permit others to do with this work. Leave at the default if you are keeping all rights.',
  producer: 'The producer credit for the release as a whole.',
  release_credits: 'Everyone who worked on this, by real name and role. Credits are part of the record, so add people here rather than in a note.',
  credit_notes: 'Free-form credits that do not fit the structured list above. One per line.',
  master_holder: 'Who owns the recording itself — usually you, your label, or whoever paid for the session.',
  master_copyright: 'The recording copyright line, usually "℗ year, name".',
  composition_holder: 'Who owns the song as written, which can differ from who owns the recording.',
  publisher: 'The publisher for the composition, if one is involved.',
  track_licence: 'Any specific permission or licence covering this track. Use it when a track carries terms the rest of the release does not.',
  asset_permission: 'How you came to have the right to include this file — you made it, you licensed it, or it is public domain. Answer honestly; it is recorded in the object.',
  credit_name: 'Required. The person, artist or organisation being credited, by their real name.',
  credit_role: 'Required. What they did — "Featured Artist", "Mixing Engineer", "Photography".',
  credit_email: 'Optional. Invites this collaborator to confirm their credit. Nothing is sent until you choose to send it.',

  // Experience — the Transcendence system. ULTRA needs no fields here; its
  // authoring lives in the Guide editor.
  experience_system: 'ULTRA arranges your media into a guided player and suits any release. Transcendence computes a landscape from one recording and flies through it in sync. Both ship offline.',
  terrain_track: 'Required for Transcendence. Which recording becomes the terrain. The rest of the release still ships in the package.',
  terrain_analyse: 'Measures the recording in your browser — nothing is uploaded. A four-minute track takes a few seconds and produces the terrain image the world is built from.',
  terrain_height: 'How tall the landscape stands. This changes only how the measured shape is presented, never the shape itself.',
  terrain_ridge: 'How far harmonics stand out as separate ridges. Higher turns a smooth swell into parallel ranges.',
  terrain_sun_elevation: 'How high the light sits. Low rakes long shadows across the ranges; high flattens them into a gallery light.',
  terrain_sun_azimuth: 'Which direction the light comes from, around the world.',
  terrain_flight_altitude: 'How high the flight travels. Scales every shot together, so each composed framing survives.',
  terrain_time_scale: 'How much ground a second of the recording covers. Lower packs the track into a denser landscape.',
  terrain_palette: 'Three fixed lighting designs. Each sets sun, ceiling, wall, floor and fog together, which is why there are no individual colour pickers.',
  terrain_terracing: 'Cuts the lower slopes into level steps like a topographic model, leaving the summits smooth.',
  landmark_time: 'Where in the track this line is cut into the terrain. Your decision, not a measurement — the package records it as creator-placed.',
  landmark_band: 'Which frequency band the line is cut into. Place it on a ridge the voice actually made, using the terrain above as your guide.',
  quality_preview: 'Where the experience opens. All four profiles ship; a collector\'s machine can pick another. Essential renders without WebGL at all.',
};

/** Ordered checklist shown on the Publish step. Mirrors the manual. */
export const PREFLIGHT = [
  'Artist name spelled exactly as it should be remembered',
  'Every track has a primary master at your best quality',
  'Cover is the largest version you have',
  'Everyone who worked on it is credited by real name and role',
  'Edition size is a number you will honour permanently',
  'You have previewed the object and played it',
  'Rights are yours to grant',
];

export function stepHelp(step) {
  return STEP_HELP[step] ?? null;
}

export function fieldHelp(id) {
  return FIELD_HELP[id] ?? '';
}
