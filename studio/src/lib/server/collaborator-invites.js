const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCollaboratorInvite(input = {}) {
  const email = String(input.email || '').trim().toLocaleLowerCase();
  const name = String(input.name || '').trim();
  const role = String(input.role || '').trim();
  const releaseId = String(input.release_id || '').trim();
  const creditId = String(input.credit_id || '').trim();
  const trackIds = [...new Set((Array.isArray(input.track_ids) ? input.track_ids : []).map(String))];
  if (!EMAIL_RE.test(email) || email.length > 254) return { valid: false, message: 'Enter a valid collaborator email address.' };
  if (!name || name.length > 120) return { valid: false, message: 'Collaborator name is required and must be under 120 characters.' };
  if (!role || role.length > 120) return { valid: false, message: 'Credit role is required and must be under 120 characters.' };
  if (!UUID_RE.test(releaseId)) return { valid: false, message: 'The release must have a valid stable ID.' };
  if (!UUID_RE.test(creditId)) return { valid: false, message: 'The credit record must have a valid stable ID.' };
  if (trackIds.some((trackId) => !UUID_RE.test(trackId))) return { valid: false, message: 'One or more linked tracks are invalid.' };
  return { valid: true, value: { email, name, role, release_id: releaseId, credit_id: creditId, track_ids: trackIds } };
}

export function isExistingSupabaseUserError(message = '') {
  return /already.{0,40}(registered|exists|been registered)/i.test(String(message));
}

export function buildInviteAcceptanceUrl(origin, tokenHash) {
  const url = new URL('/auth/confirm', origin);
  url.searchParams.set('token_hash', String(tokenHash));
  return url.toString();
}
