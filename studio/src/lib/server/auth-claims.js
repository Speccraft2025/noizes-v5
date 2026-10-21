export function authenticatedUserFromClaims(claims) {
  if (!claims?.sub) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : undefined
  };
}
