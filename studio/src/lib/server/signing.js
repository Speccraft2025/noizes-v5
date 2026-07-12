import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';

const CIPHER = 'aes-256-gcm';

function getKek() {
  if (!env.SIGNING_KEK) {
    throw new Error('SIGNING_KEK env var is not set — cannot access custodial signing keys. Generate one with `openssl rand -base64 32`.');
  }
  const key = Buffer.from(env.SIGNING_KEK, 'base64');
  if (key.length !== 32) {
    throw new Error('SIGNING_KEK must decode to exactly 32 bytes (base64-encoded).');
  }
  return key;
}

function encrypt(plaintext) {
  const key = getKek();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(CIPHER, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(payloadB64) {
  const key = getKek();
  const payload = Buffer.from(payloadB64, 'base64');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const enc = payload.subarray(28);
  const decipher = crypto.createDecipheriv(CIPHER, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

/**
 * Fetches (or lazily generates) a creator's custodial Ed25519 keypair.
 * Returns the public key (base64 SPKI DER) and a signer function bound to the decrypted private key.
 */
async function loadKeypair(sb, userId) {
  const { data: existing } = await sb
    .from('creator_signing_keys')
    .select('public_key, private_key_encrypted')
    .eq('id', userId)
    .single();

  if (existing) {
    const privateKey = crypto.createPrivateKey({
      key: decrypt(existing.private_key_encrypted),
      format: 'der',
      type: 'pkcs8',
    });
    return { publicKeyB64: existing.public_key, privateKey };
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const privateKeyEncrypted = encrypt(privateKey.export({ type: 'pkcs8', format: 'der' }));

  const { error } = await sb.from('creator_signing_keys').insert({
    id: userId,
    public_key: publicKeyB64,
    private_key_encrypted: privateKeyEncrypted,
  });
  if (error) throw new Error(`Failed to store signing key: ${error.message}`);

  await sb.from('profiles').update({ signing_public_key: publicKeyB64 }).eq('id', userId);

  return { publicKeyB64, privateKey };
}

export async function getOrCreateSigningPublicKey(sb, userId) {
  const { publicKeyB64 } = await loadKeypair(sb, userId);
  return publicKeyB64;
}

/** Signs a buffer (typically a sha256 digest) with the creator's custodial key. Returns { signature, publicKey } as base64 strings. */
export async function signHash(sb, userId, hashBuffer) {
  const { publicKeyB64, privateKey } = await loadKeypair(sb, userId);
  const signature = crypto.sign(null, hashBuffer, privateKey);
  return { signature: signature.toString('base64'), publicKey: publicKeyB64 };
}

/** Verifies an Ed25519 signature. hash is hex, signature/publicKey are base64 strings. */
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
