import { describe, expect, it } from 'vitest';
import { buildInviteAcceptanceUrl, isExistingSupabaseUserError, validateCollaboratorInvite } from './collaborator-invites.js';

describe('collaborator invitations', () => {
  const valid = {
    email: ' Guest@Example.com ',
    name: 'Guest Artist',
    role: 'Featured Artist',
    release_id: '4fd9fc3a-67fb-4f0e-ae40-c0ccd4655c87',
    credit_id: 'ce179b9c-d1ef-469d-b6ba-e8cda646ee04',
    track_ids: ['07ca4904-bbda-4a11-b121-f68d141c9802'],
  };

  it('normalizes a valid creator invitation', () => {
    expect(validateCollaboratorInvite(valid)).toMatchObject({
      valid: true,
      value: { email: 'guest@example.com', track_ids: valid.track_ids },
    });
  });

  it('rejects invalid email and relationship identifiers', () => {
    expect(validateCollaboratorInvite({ ...valid, email: 'bad' }).valid).toBe(false);
    expect(validateCollaboratorInvite({ ...valid, email: `${'x'.repeat(244)}@example.com` }).valid).toBe(false);
    expect(validateCollaboratorInvite({ ...valid, track_ids: ['not-a-track'] }).valid).toBe(false);
  });

  it('recognizes the non-failure response for an existing account', () => {
    expect(isExistingSupabaseUserError('A user with this email address has already been registered')).toBe(true);
  });

  it('builds a same-origin server confirmation URL for the Supabase token hash', () => {
    expect(buildInviteAcceptanceUrl('https://noizes.xyz/studio', 'hash/+ value')).toBe(
      'https://noizes.xyz/auth/confirm?token_hash=hash%2F%2B+value',
    );
  });
});
