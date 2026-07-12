import { json } from '@sveltejs/kit';
import { verifySignature } from '$lib/server/signing.js';

export async function POST({ request }) {
  const { hash, signature, publicKey } = await request.json();
  if (!hash || !signature || !publicKey) {
    return json({ valid: false, error: 'Missing hash, signature, or publicKey' }, { status: 400 });
  }
  const valid = verifySignature({ hash, signature, publicKey });
  return json({ valid });
}
