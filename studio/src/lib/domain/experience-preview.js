/**
 * The Drop Page preview uses the same viewer as a full experience open, but
 * marks the route as embedded so it can be rendered without controls and
 * without counting as an intentional collector action.
 */
export function embeddedExperiencePath(release) {
  if (!release?.artist_slug || !release?.slug) return '';
  return `/experience/${encodeURIComponent(release.artist_slug)}/${encodeURIComponent(release.slug)}?embed=1`;
}

export function isEmbeddedExperience(url) {
  return url.searchParams.get('embed') === '1';
}
