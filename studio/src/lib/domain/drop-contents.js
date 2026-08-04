/**
 * What a Drop Page is allowed to say about a package.
 *
 * Every line in the "What you get" and "Experience" sections is derived from
 * the package's own manifest. Nothing is assumed, defaulted or padded: if the
 * manifest declares no video components, the page has no Video row. A Drop
 * Page that lists contents the .nz does not contain is not a cosmetic bug —
 * it is a false claim about a thing somebody is about to buy.
 *
 * manifest.json is the source of truth. These functions read it and produce
 * display records; they never invent one.
 *
 * Pure module: no I/O, no $env, no Svelte.
 */

const AUDIO_ROLES_SECONDARY = new Set(['stem', 'stems', 'acapella', 'instrumental']);

function components(manifest) {
  return Array.isArray(manifest?.components) ? manifest.components : [];
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Rounded minutes, omitted entirely when the manifest carries no duration. */
export function formatDuration(totalMs) {
  const ms = Number(totalMs) || 0;
  if (ms <= 0) return '';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return pluralize(minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : pluralize(hours, 'hour');
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let index = 0;
  let size = value;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size >= 10 || index === 0 ? Math.round(size) : size.toFixed(1)} ${units[index]}`;
}

/**
 * The contents rows for the Drop Page, in the order they should be read.
 * Returns [] for a manifest that declares nothing — the caller renders the
 * section only when there is something true to put in it.
 *
 * @param {object} manifest  parsed manifest.json
 * @param {{ lyricTrackCount?: number }} [extra]  facts the manifest cannot
 *   carry (timed lyrics live in per-track records inside the package)
 * @returns {Array<{key: string, label: string, detail: string, count: number}>}
 */
export function describePackageContents(manifest, extra = {}) {
  const rows = [];
  const parts = components(manifest);
  const tracks = Array.isArray(manifest?.tracks) ? manifest.tracks : [];

  const audio = parts.filter((part) => part.type === 'audio');
  const primaryAudio = audio.filter((part) => !AUDIO_ROLES_SECONDARY.has(part.role));
  if (tracks.length || primaryAudio.length) {
    const count = tracks.length || primaryAudio.length;
    const duration = formatDuration(manifest?.release?.total_duration_ms);
    rows.push({
      key: 'audio',
      label: 'Audio',
      count,
      detail: [pluralize(count, 'track'), duration].filter(Boolean).join(' · '),
    });
  }

  // Alternate takes are a real part of what a collector receives, but they are
  // not "more tracks" — counting them as such would inflate the tracklist.
  const alternates = audio.filter((part) => part.version_id && !part.role?.includes('primary'));
  const alternateVersions = new Set(alternates.map((part) => part.version_id));
  if (alternateVersions.size) {
    rows.push({
      key: 'versions',
      label: 'Alternate versions',
      count: alternateVersions.size,
      detail: pluralize(alternateVersions.size, 'additional take'),
    });
  }

  const stems = audio.filter((part) => AUDIO_ROLES_SECONDARY.has(part.role));
  if (stems.length) {
    rows.push({
      key: 'stems',
      label: 'Stems',
      count: stems.length,
      detail: pluralize(stems.length, 'stem file'),
    });
  }

  const images = parts.filter((part) => part.type === 'image');
  if (images.length) {
    const cover = images.filter((part) => part.role === 'main_cover').length;
    rows.push({
      key: 'artwork',
      label: 'Artwork',
      count: images.length,
      detail: [
        pluralize(images.length, 'image'),
        cover ? 'including the release cover' : '',
      ].filter(Boolean).join(' · '),
    });
  }

  const video = parts.filter((part) => part.type === 'video');
  if (video.length) {
    rows.push({
      key: 'video',
      label: 'Video',
      count: video.length,
      detail: pluralize(video.length, 'visual piece'),
    });
  }

  const documents = parts.filter((part) => part.type === 'document');
  if (documents.length) {
    rows.push({
      key: 'notes',
      label: 'Notes & documents',
      count: documents.length,
      detail: pluralize(documents.length, 'document'),
    });
  }

  const lyricTracks = Number(extra.lyricTrackCount) || 0;
  if (lyricTracks) {
    rows.push({
      key: 'lyrics',
      label: 'Lyrics',
      count: lyricTracks,
      detail: `Synced lyrics for ${pluralize(lyricTracks, 'track')}`,
    });
  }

  // Credits and rights ship in every normalized package, but say so only when
  // the manifest actually points at those records.
  if (manifest?.rights?.path || manifest?.archive?.path) {
    rows.push({
      key: 'metadata',
      label: 'Metadata',
      count: 1,
      detail: 'Full credits and rights documentation',
    });
  }

  if (manifest?.authenticity?.path) {
    rows.push({
      key: 'authenticity',
      label: 'Authenticity',
      count: 1,
      detail: 'Signed component checksum inventory',
    });
  }

  return rows;
}

// The sections a published experience can offer, in reading order. Only those
// the package actually declares are shown; `anchor` is what the viewer scrolls
// to when a preview card is opened.
const SECTION_LIBRARY = Object.freeze([
  { key: 'opening', label: 'Opening', anchor: 'opening', blurb: 'How the release introduces itself' },
  { key: 'tracklist', label: 'Tracklist', anchor: 'tracks', blurb: 'Every track, in sequence' },
  { key: 'lyrics', label: 'Lyrics', anchor: 'lyrics', blurb: 'Words, timed to the music' },
  { key: 'story', label: 'Story', anchor: 'story', blurb: 'The account behind the record' },
  { key: 'gallery', label: 'Gallery', anchor: 'gallery', blurb: 'Images packaged with the release' },
  { key: 'notes', label: 'Liner notes', anchor: 'notes', blurb: 'Documents kept with the object' },
  { key: 'video', label: 'Video', anchor: 'video', blurb: 'Moving image inside the package' },
  { key: 'play', label: 'Play', anchor: 'play', blurb: 'Interactive pieces built into the release' },
  { key: 'guide', label: 'Guide', anchor: 'guide', blurb: 'How to move through the experience' },
  { key: 'credits', label: 'Credits', anchor: 'credits', blurb: 'Who made it, and what they did' },
]);

/**
 * Summarize experience.json into the handful of facts a Drop Page needs.
 *
 * Computed once at publish and stored, so the page never opens a multi-hundred
 * megabyte package to find out whether it has an opening sequence. Kept pure
 * and separate from the rendering below so the shape stored in the database
 * has one definition rather than two.
 *
 * @param {object} experience  parsed experience.json
 * @param {Array<object>} trackRecords  parsed tracks/&#42;/track.json records
 */
export function summarizeExperience(experience = {}, trackRecords = []) {
  return {
    has_opening: Boolean(experience?.journey?.release_moments?.length),
    has_story: Boolean(experience?.guide?.story?.trim?.() || experience?.story?.trim?.()),
    has_play: Boolean(experience?.play?.games?.length),
    has_guide: Boolean(experience?.guide),
    lyric_track_count: (trackRecords ?? []).filter((track) =>
      track?.lyrics?.timed_lines?.length || track?.lyrics?.plain_text?.trim?.()
    ).length,
  };
}

/**
 * Preview cards for the experience, derived from the stored experience summary
 * plus the manifest's component inventory.
 *
 * @param {object} manifest
 * @param {object} summary  see summarizeExperience
 * @returns {Array<{key,label,anchor,blurb,count}>}
 */
export function describeExperienceSections(manifest, summary = {}) {
  const parts = components(manifest);
  const has = {
    opening: Boolean(summary.has_opening),
    tracklist: Boolean(manifest?.tracks?.length),
    lyrics: Number(summary.lyric_track_count) > 0,
    story: Boolean(summary.has_story),
    gallery: parts.filter((part) => part.type === 'image').length > 1,
    notes: parts.some((part) => part.type === 'document'),
    video: parts.some((part) => part.type === 'video'),
    play: Boolean(summary.has_play),
    guide: Boolean(summary.has_guide),
    credits: Boolean(manifest?.rights?.path),
  };

  return SECTION_LIBRARY
    .filter((section) => has[section.key])
    .map((section) => ({
      ...section,
      count: section.key === 'tracklist' ? (manifest?.tracks?.length || 0) : 0,
    }));
}

/**
 * The signature and validation verdicts, as words rather than booleans.
 *
 * Three states each, because two is not enough to be honest. A package that
 * was checked and failed is not in the same position as one nobody has looked
 * at, and a signature that is present but does not verify is a *stronger*
 * statement than no signature at all — collapsing either pair into "not
 * verified" throws away the part the reader most needs.
 */
export function describeVerificationStatus({ authenticity, packageRecord } = {}) {
  const signature = authenticity?.verification_status === 'verified'
    ? { state: 'verified', tone: 'good', icon: '◈', label: 'Signature verified' }
    : authenticity?.verification_status === 'failed'
      ? { state: 'failed', tone: 'bad', icon: '▲', label: 'Signature did not verify' }
      : authenticity?.signature
        ? { state: 'unchecked', tone: 'unknown', icon: '○', label: 'Signed · not yet verified' }
        : { state: 'absent', tone: 'unknown', icon: '○', label: 'Not signed' };

  const validation = packageRecord?.validation_status === 'valid'
    ? { state: 'valid', tone: 'good', icon: '◎', label: 'Package validated' }
    : packageRecord?.validation_status === 'invalid'
      ? { state: 'invalid', tone: 'bad', icon: '▲', label: 'Package failed validation' }
      : { state: 'unknown', tone: 'unknown', icon: '○', label: 'Package not yet validated' };

  return { signature, validation };
}

/**
 * Trust indicators the release data actually supports. Each entry is a claim
 * with evidence behind it; a claim without evidence is simply absent rather
 * than shown greyed out, because a greyed-out "Verified authentic" still reads
 * as a badge at a glance.
 *
 * "Works offline" is evidence-gated like everything else, and that is not
 * pedantry: the validator's offline-runtime check exists precisely because a
 * package *can* fail it by referencing an external script or stylesheet, and
 * one in the live catalogue does. Asserting it by default would put the single
 * most load-bearing Noizes claim on the one page that has been proven wrong.
 */
export function describeTrustIndicators({ authenticity, release, packageRecord } = {}) {
  const { signature, validation } = describeVerificationStatus({ authenticity, packageRecord });

  // True by construction: one file, opened by the viewer, no installer.
  const out = [
    { key: 'portable', label: 'Portable', detail: 'One file, no installer, no account required to open' },
  ];

  if (validation.state === 'valid') {
    out.push({ key: 'offline', label: 'Works offline', detail: 'No external code or styles — checked, not assumed' });
    out.push({ key: 'validated', label: 'Package validated', detail: 'Structure and every component checksum verified' });
  }
  if (signature.state === 'verified') {
    out.push({ key: 'signed', label: 'Artist-signed', detail: 'Ed25519 signature over the component inventory' });
  }
  if (release?.transferable) {
    out.push({ key: 'transferable', label: 'Transferable', detail: 'Custody can move to another collector' });
  }
  return out;
}
