// Pure helpers for the KYC flow — no $env imports so vitest needs no mocks.

export const ID_TYPES = ['national_id', 'passport', 'drivers_license'];

// Statuses from which a (re)submission is allowed. 'pending' would clobber a
// submission under review; 'approved' must never silently reset verification.
export const RESUBMITTABLE_STATUSES = ['unverified', 'rejected'];

export function canSubmitKyc(kycStatus) {
  return RESUBMITTABLE_STATUSES.includes(kycStatus ?? 'unverified');
}

// Validates the text fields of a KYC submission. Returns null when valid,
// or a human-readable error string.
export function validateKycFields({ full_name, country, id_type, id_number } = {}) {
  if (!full_name || full_name.trim().length < 2) return 'Full legal name is required.';
  if (full_name.trim().length > 200) return 'Full name is too long.';
  if (!country || country.trim().length < 2) return 'Country is required.';
  if (country.trim().length > 100) return 'Country is too long.';
  if (!ID_TYPES.includes(id_type)) return 'Choose a valid ID type.';
  if (!id_number || id_number.trim().length < 3) return 'ID number is required.';
  if (id_number.trim().length > 50) return 'ID number is too long.';
  return null;
}

// Storage paths are built from user-supplied filenames — never trust the
// extension. Alphanumeric only, max 5 chars, lowercased; 'bin' otherwise.
export function safeFileExt(filename) {
  const ext = String(filename || '').split('.').pop() || '';
  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean && clean.length <= 5 && clean !== String(filename || '').toLowerCase() ? clean : 'bin';
}
