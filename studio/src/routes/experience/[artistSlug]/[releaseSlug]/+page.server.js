import { error, redirect } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

import { resolveDropAddress, bumpDropAnalytics } from '$lib/server/drop-page.js';
import { dropPath } from '$lib/domain/drop-slug.js';
import { signedPackageUrl } from '$lib/server/storage.js';

// The viewer fetches the whole package before it can start, so this window has
// to cover a large download beginning on a slow connection — longer than the
// download endpoint's, which hands off to the browser immediately.
const EXPERIENCE_URL_TTL_SECONDS = 300;

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

  // Opening the experience is deliberately not entitlement-gated: previewing
  // the release is what makes a Drop Page worth sharing, and the spec offers
  // "Preview experience" to visitors who do not own a copy. So this route will
  // mint a package URL for anyone who can see the release.
  //
  // Be precise about what that does and does not buy. It is NOT secrecy of the
  // audio — a determined visitor can load this page and take the bytes, and
  // that is the intended product behaviour. What the private bucket buys is
  // everything else: packages are no longer enumerable by guessing two UUIDs,
  // links cannot be hotlinked or pasted to outlive the session, and — most
  // importantly — a package belonging to a DRAFT or withdrawn release is no
  // longer reachable at all, which under the public bucket it always was.
  //
  // The status checks above are what decide whether a URL gets minted; this
  // call is what makes that decision load-bearing.
  let packageUrl;
  try {
    packageUrl = await signedPackageUrl(sb, release.nz_path, { expiresIn: EXPERIENCE_URL_TTL_SECONDS });
  } catch (cause) {
    console.error(`[experience] could not sign package for ${release.id}: ${cause.message}`);
    throw error(500, 'The package location could not be resolved.');
  }

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
    packageUrl,
    dropPath: dropPath(release.artist_slug, release.slug),
  };
}
