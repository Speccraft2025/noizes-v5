import { error, redirect } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

import { resolveDropAddress, bumpDropAnalytics } from '$lib/server/drop-page.js';
import { dropPath } from '$lib/domain/drop-slug.js';

// The web viewer for a published release.
//
// This is an ecosystem convenience and nothing more. The package it plays is
// byte-identical to the one a collector downloads, it is fetched whole and
// opened in the browser, and nothing about running it here changes what the
// .nz is or requires. The downloaded package still opens offline with no
// server involved — that property is the product, and this route must not
// quietly become a dependency of it.
export async function load({ params, locals, url }) {
  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { release, redirectTo } = await resolveDropAddress(sb, {
    artistSlug: params.artistSlug,
    slug: params.releaseSlug,
  });
  if (redirectTo) throw redirect(301, `/experience/${release.artist_slug}/${release.slug}${url.hash ?? ''}`);
  if (!release) throw error(404, 'No release lives at this address.');

  const isCreator = Boolean(locals.user) && release.artist_id === locals.user.id;
  if (release.status === 'draft' && !isCreator) throw error(404, 'No release lives at this address.');

  if (!release.nz_path) {
    throw error(409, 'This release has no package to open yet.');
  }

  // The package URL is public — the releases bucket is public, and the .nz is
  // meant to be portable — so the viewer streams it directly. Entitlement
  // gates the *download endpoint's* named file, not this playback convenience.
  const { data: object } = sb.storage.from('releases').getPublicUrl(release.nz_path);
  if (!object?.publicUrl) throw error(500, 'The package location could not be resolved.');

  await bumpDropAnalytics(sb, release.id, 'experience_open');

  return {
    release: {
      id: release.id,
      title: release.title,
      artist_name: release.artist_name,
      artist_slug: release.artist_slug,
      slug: release.slug,
      experience_entry: release.experience_entry || 'experience.html',
    },
    packageUrl: object.publicUrl,
    dropPath: dropPath(release.artist_slug, release.slug),
  };
}
