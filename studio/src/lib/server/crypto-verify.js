// Pure Ed25519 signature verification — no env, no I/O, safe to import from
// unit tests and the offline verifier. signing.js re-exports this so callers
// have one import site.
import crypto from 'node:crypto';

/** Verifies an Ed25519 signature. hash is hex, signature/publicKey are base64. */
export function verifySignature({ hash, signature, publicKey }) {
  try {
    const publicKeyObj = crypto.createPublicKey({
      key: Buffer.from(publicKey, 'base64'),
      format: 'der',
      type: 'spki',
    });
    return crypto.verify(null, Buffer.from(hash, 'hex'), publicKeyObj, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}
