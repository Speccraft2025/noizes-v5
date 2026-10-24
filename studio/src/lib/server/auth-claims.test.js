import { describe, expect, it } from 'vitest';
import { authenticatedUserFromClaims } from './auth-claims.js';

describe('authenticatedUserFromClaims', () => {
  it('returns no user when claims have not been validated', () => {
    expect(authenticatedUserFromClaims(null)).toBeNull();
    expect(authenticatedUserFromClaims({ email: 'collector@noizes.xyz' })).toBeNull();
  });

  it('keeps only the identity fields used by server routes', () => {
    expect(authenticatedUserFromClaims({ sub: 'user-123', email: 'collector@noizes.xyz', role: 'authenticated' }))
      .toEqual({ id: 'user-123', email: 'collector@noizes.xyz' });
  });
});
