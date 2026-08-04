/**
 * What the Drop Page's primary button says, and what it does.
 *
 * There are eight states and they are easy to get subtly wrong — "Sold out"
 * on a release the viewer already owns, "Buy" on a withdrawn release, a live
 * checkout button on an archive record. Keeping the decision in one pure
 * function means the page cannot disagree with itself, and means every state
 * is reachable in a test rather than only in production.
 *
 * The server decides `owned` — never the client. A client-side ownership check
 * is a suggestion, not an authorization, and the download and experience
 * endpoints re-check it independently.
 */

/** Copies still available, or null for an open (unlimited) edition. */
export function copiesAvailable(release) {
  if (release?.edition_size == null) return null;
  return Math.max(0, Number(release.edition_size) - (Number(release.acquired_count) || 0));
}

export function isSoldOut(release) {
  const left = copiesAvailable(release);
  return left !== null && left === 0;
}

/**
 * @param {object} input
 * @param {object} input.release          the release row
 * @param {boolean} input.owned           viewer holds a copy (server-verified)
 * @param {boolean} input.isCreator       viewer published this release
 * @returns {{
 *   state: string,
 *   primary: {label: string, action: string, disabled: boolean},
 *   secondary: {label: string, action: string}|null,
 *   note: string
 * }}
 */
export function dropAvailability({ release, owned = false, isCreator = false } = {}) {
  const price = Number(release?.price) || 0;
  const free = price === 0;
  const limited = release?.edition_size != null;
  const soldOut = isSoldOut(release);
  const openExperience = { label: 'Open experience', action: 'experience' };

  // Ownership outranks everything else, including sold-out and withdrawn: a
  // collector who already holds a copy must always be able to reach it.
  if (owned) {
    return {
      state: 'owned',
      primary: { label: 'Open experience', action: 'experience', disabled: false },
      secondary: { label: 'Download .nz package', action: 'download' },
      note: 'You hold a copy of this release.',
    };
  }

  if (release?.status !== 'published') {
    const withdrawn = release?.status === 'withdrawn' || release?.status === 'archived';
    return {
      state: withdrawn ? 'withdrawn' : 'unavailable',
      primary: { label: 'Not currently available', action: 'none', disabled: true },
      secondary: isCreator ? { label: 'Manage release', action: 'manage' } : null,
      note: withdrawn
        ? 'This release has been withdrawn. The record stays here; copies already held are unaffected.'
        : 'This release is not published.',
    };
  }

  if (soldOut) {
    if (release?.offers_enabled) {
      return {
        state: 'sold_out_offers',
        primary: { label: 'Make an offer', action: 'offer', disabled: false },
        secondary: openExperience,
        note: 'Every copy is held. Offers go to current custodians.',
      };
    }
    return {
      state: 'sold_out',
      primary: { label: 'Sold out', action: 'none', disabled: true },
      secondary: openExperience,
      note: 'Every copy of this edition is held.',
    };
  }

  if (free) {
    return {
      state: 'free',
      primary: {
        label: limited ? 'Claim a copy' : 'Get the .nz package',
        action: 'acquire',
        disabled: false,
      },
      secondary: openExperience,
      note: limited ? 'A numbered copy, at no cost.' : 'Free to take, yours to keep.',
    };
  }

  return {
    state: limited ? 'buy_limited' : 'buy_open',
    primary: {
      label: limited ? 'Buy this edition' : 'Buy the .nz package',
      action: 'acquire',
      disabled: false,
    },
    secondary: openExperience,
    note: '',
  };
}

/**
 * Whether this viewer may download the .nz. Deliberately conservative: an
 * unauthenticated visitor gets the package only when the creator has said so
 * explicitly, and never for a release that is not published.
 */
export function canDownloadPackage({ release, owned = false, isCreator = false } = {}) {
  if (isCreator) return { allowed: true, reason: 'creator' };
  if (owned) return { allowed: true, reason: 'owner' };
  if (release?.status !== 'published') {
    return { allowed: false, reason: 'not_published' };
  }
  if (release?.allow_public_download && Number(release?.price) === 0) {
    return { allowed: true, reason: 'public' };
  }
  return { allowed: false, reason: 'not_entitled' };
}

/**
 * The browser-facing filename. The internal container is a ZIP, but a
 * collector who saves "Artist - Title.zip" has quietly lost the format: the
 * extension is how the object is recognised by the viewer, by the OS and by
 * the person who finds it on a drive in ten years.
 */
export function packageFilename({ artist, title, editionNumber } = {}) {
  const clean = (value, fallback) => String(value ?? '')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim() || fallback;
  const edition = editionNumber == null ? '' : ` (No. ${editionNumber})`;
  return `${clean(artist, 'Noizes')} - ${clean(title, 'Release')}${edition}.nz`;
}
