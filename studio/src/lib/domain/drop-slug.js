/**
 * Drop Page addresses.
 *
 * A Drop Page URL is the thing people paste into a WhatsApp thread and scan
 * off a poster three years later. It therefore has one hard requirement that
 * outranks prettiness: it must never stop working. Two rules follow.
 *
 *   1. Canonical identity is the release id, not the title. A slug is a
 *      human-readable alias resolved through a lookup table; renaming a
 *      release mints a new alias and keeps the old one pointing at the same
 *      object.
 *   2. Collisions get a *stable* suffix derived from the release id, not a
 *      counter. A counter depends on insertion order, so re-running a backfill
 *      or restoring a snapshot can hand the same address to a different
 *      release. Four hex characters of the id cannot.
 *
 * Pure module: no I/O, no $env. The database half lives in
 * $lib/server/drop-page.js.
 */

/**
 * Reserved first path segments — an artist slug may never shadow a route.
 * Written in slug form, since that is what they are compared against: a slug
 * can never contain an underscore, so listing "_app" here would be a rule that
 * could never fire.
 */
export const RESERVED_ARTIST_SLUGS = Object.freeze([
  'admin', 'auth', 'api', 'studio', 'exchange', 'collection', 'validator',
  'verify', 'open', 'provenance', 'drop', 'experience', 'static', 'app',
]);

/**
 * Lowercase, ASCII, hyphen-separated. Diacritics are folded rather than
 * dropped so "Sauti Sól" becomes "sauti-sol" and not "sauti-sl".
 */
export function slugify(value, fallback = '') {
  const folded = String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
  const slug = folded
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || fallback;
}

/** The stable collision suffix for a release: four hex chars of its uuid. */
export function slugSuffix(releaseId) {
  const hex = String(releaseId ?? '').replace(/[^a-f0-9]/gi, '').toLowerCase();
  return hex.slice(0, 4) || '0000';
}

/**
 * Artist slug, guarded against reserved route names. A creator called "Studio"
 * gets "studio-artist" rather than a Drop Page that shadows /studio.
 */
export function artistSlugFor(artistName) {
  const base = slugify(artistName, 'artist');
  return RESERVED_ARTIST_SLUGS.includes(base) ? `${base}-artist` : base;
}

/**
 * Candidate addresses for a release, best first. The caller walks this list
 * and takes the first one the database will reserve; the last candidate is
 * unconditionally unique because it carries the full release id.
 *
 * @param {{artistName: string, title: string, releaseId: string}} input
 * @returns {Array<{artist_slug: string, slug: string}>}
 */
export function dropSlugCandidates({ artistName, title, releaseId }) {
  const artist_slug = artistSlugFor(artistName);
  const base = slugify(title, 'release');
  const suffix = slugSuffix(releaseId);
  const full = String(releaseId ?? '').replace(/[^a-f0-9]/gi, '').toLowerCase().slice(0, 12) || suffix;
  return [
    { artist_slug, slug: base },
    { artist_slug, slug: `${base}-${suffix}` },
    { artist_slug, slug: `${base}-${full}` },
  ];
}

/** The path a Drop Page lives at. */
export function dropPath(artistSlug, slug) {
  return `/drop/${artistSlug}/${slug}`;
}

/** The absolute, shareable URL. `origin` has no trailing slash. */
export function dropUrl(origin, artistSlug, slug) {
  return `${String(origin ?? '').replace(/\/+$/, '')}${dropPath(artistSlug, slug)}`;
}

/**
 * True when a stored address is still the one we want to serve. A release
 * whose title changed keeps answering on the old address, but the page it
 * renders should redirect to the current canonical one so that the URL people
 * copy from their address bar is the current name.
 */
export function isCanonicalAddress(release, artistSlug, slug) {
  return release?.artist_slug === artistSlug && release?.slug === slug;
}
