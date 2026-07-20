// Pure helpers for the KYC flow — no $env imports so vitest needs no mocks.

export const ID_TYPES = ['national_id', 'passport', 'drivers_license'];

// Statuses from which a (re)submission is allowed. 'pending' would clobber a
// submission under review; 'approved' must never silently reset verification.
export const RESUBMITTABLE_STATUSES = ['unverified', 'rejected'];

// Browser-renderable image formats only. HEIC (iPhone default) is explicitly
// rejected — admins review these in a browser, and a format nobody can open
// just produces a rejection round-trip (learned from the first real dogfood
// submission).
export const ALLOWED_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp'];
export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

export const YEARS_ACTIVE = ['<1', '1-3', '3-5', '5-10', '10+'];

// Canonical rejection reasons — shown as a dropdown in /admin/kyc so review
// doesn't require prose every time. Keep artist-readable: these appear
// verbatim on /verify.
export const REJECT_REASONS = [
  'ID photo is blurry or unreadable',
  'Selfie does not clearly show you holding the ID',
  'Selfie and ID photo appear to be different people',
  'Name does not match the ID document',
  'ID number does not match the document',
  'ID document appears expired',
  'Unsupported or unreadable file format — upload JPG or PNG',
  'Music links do not appear to be your own releases',
];

export function canSubmitKyc(kycStatus) {
  return RESUBMITTABLE_STATUSES.includes(kycStatus ?? 'unverified');
}

// Validates the text fields of a KYC submission. Returns null when valid,
// or a human-readable error string.
export function validateKycFields({ full_name, country, id_type, id_number, artist_name, years_active } = {}) {
  if (!full_name || full_name.trim().length < 2) return 'Full legal name is required.';
  if (full_name.trim().length > 200) return 'Full name is too long.';
  if (!country || country.trim().length < 2) return 'Country is required.';
  if (country.trim().length > 100) return 'Country is too long.';
  if (!ID_TYPES.includes(id_type)) return 'Choose a valid ID type.';
  if (!id_number || id_number.trim().length < 3) return 'ID number is required.';
  if (id_number.trim().length > 50) return 'ID number is too long.';
  if (!artist_name || artist_name.trim().length < 1) return 'Artist / stage name is required.';
  if (artist_name.trim().length > 100) return 'Artist name is too long.';
  if (!YEARS_ACTIVE.includes(years_active)) return 'Choose how long you have been active.';
  return null;
}

// Validates an uploaded image by declared MIME type and filename extension.
// Returns null when acceptable, or a human-readable error. `label` names the
// field in the message ("ID photo", "Selfie").
export function validateKycImage(file, label) {
  if (!file || file.size === 0) return `${label} is required.`;
  const ext = safeFileExt(file.name);
  const mimeOk = ALLOWED_IMAGE_MIMES.includes((file.type || '').toLowerCase());
  const extOk = ALLOWED_IMAGE_EXTS.includes(ext);
  if (!mimeOk || !extOk) {
    const isHeic = /hei[cf]/i.test(`${file.type} ${file.name}`);
    return isHeic
      ? `${label}: HEIC photos can't be reviewed — on iPhone, screenshot the photo or export it as JPG, then upload that.`
      : `${label}: use a JPG, PNG or WebP image.`;
  }
  return null;
}

// Parses a textarea of links (one per line, commas also accepted) into a
// clean array of https URLs. Returns { links, error }. Empty input → [].
export function parseLinks(text, { max = 5, label = 'Links' } = {}) {
  const raw = String(text || '')
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
  if (raw.length > max) return { links: null, error: `${label}: at most ${max} links.` };
  const links = [];
  for (let entry of raw) {
    if (entry.length > 300) return { links: null, error: `${label}: one of the links is too long.` };
    if (!/^https?:\/\//i.test(entry)) entry = `https://${entry}`;
    let url;
    try {
      url = new URL(entry);
    } catch {
      return { links: null, error: `${label}: "${entry.slice(0, 60)}" is not a valid link.` };
    }
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) {
      return { links: null, error: `${label}: "${entry.slice(0, 60)}" is not a valid link.` };
    }
    if (!links.includes(url.href)) links.push(url.href);
  }
  return { links, error: null };
}

// Storage paths are built from user-supplied filenames — never trust the
// extension. Alphanumeric only, max 5 chars, lowercased; 'bin' otherwise.
export function safeFileExt(filename) {
  const ext = String(filename || '').split('.').pop() || '';
  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean && clean.length <= 5 && clean !== String(filename || '').toLowerCase() ? clean : 'bin';
}
