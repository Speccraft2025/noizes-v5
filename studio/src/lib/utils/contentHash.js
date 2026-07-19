// Shared canonical-serialization + content_hash module (NZ_EXPERIENCE_SCHEMA.md §8).
// One implementation, three call sites: packager (browser), validator (browser),
// publish server (Node ≥20). Keep this file isomorphic — no DOM, no node: imports.

/**
 * Canonical JSON: keys sorted lexicographically (code-unit order) at every
 * depth, arrays in document order, no insignificant whitespace, no trailing
 * newline. Keys with undefined values are dropped (matching JSON.stringify).
 */
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(v => canonicalize(v === undefined ? null : v)).join(',') + ']';
  return '{' + Object.keys(value)
    .filter(k => value[k] !== undefined)
    .sort()
    .map(k => JSON.stringify(k) + ':' + canonicalize(value[k]))
    .join(',') + '}';
}

/**
 * content_hash = SHA-256 over:
 *   utf8(canonical(experience.json))
 *   ‖ utf8(canonical(resources.json))   (omitted entirely when absent)
 *   ‖ raw audio bytes of every rendition, in renditions[] order
 *
 * @param {object} experience          parsed experience.json
 * @param {object|null} resources      parsed resources.json, or null when absent
 * @param {ArrayBuffer[]|Uint8Array[]} audioBuffers  rendition bytes in order
 * @returns {Promise<string>} lowercase hex digest
 */
export async function computeContentHash(experience, resources, audioBuffers) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto unavailable — content_hash requires crypto.subtle (browser or Node ≥20)');

  const enc = new TextEncoder();
  const parts = [enc.encode(canonicalize(experience))];
  if (resources !== null && resources !== undefined) parts.push(enc.encode(canonicalize(resources)));
  for (const buf of audioBuffers || []) parts.push(buf instanceof Uint8Array ? buf : new Uint8Array(buf));

  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const joined = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { joined.set(p, off); off += p.byteLength; }

  const digest = await subtle.digest('SHA-256', joined);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}
