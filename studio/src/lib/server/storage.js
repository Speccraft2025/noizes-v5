/**
 * Where release bytes live, and who is allowed to reach them.
 *
 * Two buckets, because artwork and the paid good have opposite requirements:
 *
 *   COVER_BUCKET    public. og:image is fetched by WhatsApp, X and Facebook
 *                   crawlers at unpredictable times — often long after a
 *                   share, and again on every re-scrape. A signed URL would
 *                   expire and silently turn every shared link into a blank
 *                   card, so cover artwork is deliberately public.
 *
 *   PACKAGE_BUCKET  private. The .nz is the thing somebody paid for. It is
 *                   reachable only through a short-lived signed URL minted
 *                   after an entitlement check.
 *
 * This split replaced a single public bucket in which every .nz was fetchable
 * by anyone who could guess two UUIDs — with the release id printed on the
 * public Drop Page. The endpoints all returned 403 correctly; the bytes simply
 * did not require going through them.
 */

export const COVER_BUCKET = 'releases';
export const PACKAGE_BUCKET = 'release-packages';

/**
 * How long a package link stays valid. Long enough to start a large download
 * on a slow connection, short enough that a URL pasted into a group chat is
 * useless by the time anyone else opens it.
 *
 * Note this bounds the START of the transfer, not its duration: Supabase
 * validates the token when the request is made, so a download already in
 * flight is not cut off when the window closes.
 */
export const PACKAGE_URL_TTL_SECONDS = 120;

/**
 * A public URL for cover artwork. Returns null rather than a broken URL when
 * there is no cover, so callers can decide what to render.
 */
export function publicCoverUrl(sb, path) {
  if (!path) return null;
  const { data } = sb.storage.from(COVER_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

/**
 * A signed, expiring URL for a .nz package.
 *
 * `download` sets the filename the browser saves as. It must keep the .nz
 * extension: the internal container is a ZIP, but a collector who ends up with
 * "album.zip" has lost the format — the extension is how the viewer, the OS,
 * and the person who finds the file in ten years recognise the object.
 *
 * Callers MUST have established entitlement before calling this. There is no
 * check here on purpose: a permission test buried in a URL helper is one that
 * every new call site silently inherits and nobody re-reads.
 *
 * @param {object} sb service-role client
 * @returns {Promise<string>} the signed URL
 * @throws when the object is missing or the URL cannot be signed
 */
export async function signedPackageUrl(sb, path, { download = null, expiresIn = PACKAGE_URL_TTL_SECONDS } = {}) {
  if (!path) throw new Error('No package path for this release');
  const options = download ? { download } : undefined;
  const { data, error } = await sb.storage
    .from(PACKAGE_BUCKET)
    .createSignedUrl(path, expiresIn, options);
  if (error) throw new Error(`Could not sign package URL: ${error.message}`);
  if (!data?.signedUrl) throw new Error('Storage returned no signed URL');
  return data.signedUrl;
}

/** Download the raw bytes of a package (server-side use: validation, hashing). */
export async function downloadPackage(sb, path) {
  const { data, error } = await sb.storage.from(PACKAGE_BUCKET).download(path);
  if (error) throw new Error(`Package download failed: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}
