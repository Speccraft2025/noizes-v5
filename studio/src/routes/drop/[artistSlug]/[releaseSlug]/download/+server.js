import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

import { resolveDropAddress, bumpDropAnalytics } from '$lib/server/drop-page.js';
import { canDownloadPackage, packageFilename } from '$lib/domain/drop-availability.js';

// Hands back a download URL for the .nz, after checking on the server that
// this viewer is entitled to it. The bytes are served straight from Supabase
// Storage rather than proxied, because a Netlify function cannot pass a
// multi-megabyte body — but the decision to hand over the URL is made here.
//
// The browser-facing filename keeps the .nz extension. The container is a ZIP
// and always has been, but a collector who ends up with "album.zip" on a drive
// has lost the format: the extension is how the viewer, the OS and a stranger
// ten years from now recognise what the file is.
export async function GET({ params, locals }) {
  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { release } = await resolveDropAddress(sb, {
    artistSlug: params.artistSlug,
    slug: params.releaseSlug,
  });
  if (!release) throw error(404, 'No release lives at this address.');

  const viewerId = locals.user?.id ?? null;
  const isCreator = Boolean(viewerId) && release.artist_id === viewerId;

  // Ownership is read here, server-side, from the acquisitions table. A client
  // that says it owns a copy is making a claim, not proving one.
  let owned = false;
  let editionNumber = null;
  if (viewerId) {
    const { data: acquisition } = await sb
      .from('acquisitions')
      .select('id, edition_number')
      .eq('release_id', release.id)
      .eq('owner_id', viewerId)
      .order('acquired_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    owned = Boolean(acquisition);
    editionNumber = acquisition?.edition_number ?? null;
  }

  const verdict = canDownloadPackage({ release, owned, isCreator });
  if (!verdict.allowed) {
    if (verdict.reason === 'not_published') {
      throw error(404, 'No release lives at this address.');
    }
    throw error(403, viewerId
      ? 'This package is only available to collectors who hold a copy.'
      : 'Sign in with the account that holds this release to download the package.');
  }

  if (!release.nz_path) {
    throw error(409, 'This release has no downloadable package yet.');
  }

  const filename = packageFilename({
    artist: release.artist_name,
    title: release.title,
    editionNumber,
  });

  // The entitlement verdict above is the only thing standing between a visitor
  // and this URL, so the URL has to be one that cannot be reached any other
  // way: signed, short-lived, into the private package bucket.
  let url;
  try {
    url = await signedPackageUrl(sb, release.nz_path, { download: filename });
  } catch (cause) {
    console.error(`[drop] could not sign download for ${release.id}: ${cause.message}`);
    throw error(500, 'The download URL could not be resolved.');
  }

  await bumpDropAnalytics(sb, release.id, 'download');

  return json({ url, filename, entitlement: verdict.reason });
}
