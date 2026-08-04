import { error, redirect } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

import { getDropPage, bumpDropAnalytics } from '$lib/server/drop-page.js';
import { metaDescription, openGraphTags, shareMessage, shareTargets } from '$lib/domain/drop-share.js';
import { qrSvg } from '$lib/domain/qr.js';

// Server-rendered, because the page's job is to be shared: a social crawler
// does not run JavaScript, and a Drop Page whose card renders as a blank
// rectangle in WhatsApp has failed at the one thing it exists for.
export async function load({ params, locals, url, setHeaders }) {
  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let page;
  try {
    page = await getDropPage(sb, {
      artistSlug: params.artistSlug,
      slug: params.releaseSlug,
      viewerId: locals.user?.id ?? null,
      origin: url.origin,
    });
  } catch (cause) {
    console.error('[drop] load failed:', cause.message);
    throw error(503, 'This Drop Page could not be loaded just now. The release is safe — this is a fault on our side.');
  }

  // A superseded address still resolves; it just stops being the one people
  // copy out of the address bar.
  if (page.redirectTo) throw redirect(301, page.redirectTo);
  if (!page.found) throw error(404, 'No release lives at this address.');

  const { release } = page;
  const description = metaDescription({
    title: release.title,
    artist: release.artist_name,
    description: release.drop_description || release.description,
    editionName: release.edition_name || release.edition_type,
    editionSize: release.edition_size,
    trackCount: release.track_count,
  });

  // Counted server-side and in aggregate only — no visitor row is written, so
  // there is nothing here to correlate later.
  if (release.status === 'published') {
    await bumpDropAnalytics(sb, release.id, 'view');
  }

  // Public and shareable, but short-lived: availability and edition counts
  // change, and a stale "3 left" is worse than a slightly slower page.
  setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' });

  return {
    ...page,
    meta: {
      title: `${release.title} by ${release.artist_name} · Noizes`,
      description,
      canonical: page.canonicalUrl,
      tags: openGraphTags({
        url: page.canonicalUrl,
        title: release.title,
        artist: release.artist_name,
        description,
        imageUrl: release.cover_url,
      }),
    },
    share: {
      url: page.canonicalUrl,
      message: shareMessage({
        title: release.title,
        artist: release.artist_name,
        editionName: release.edition_name || release.edition_type,
        editionSize: release.edition_size,
        url: page.canonicalUrl,
      }),
      targets: shareTargets({
        url: page.canonicalUrl,
        title: release.title,
        artist: release.artist_name,
      }),
      // Generated here rather than in the browser so it is present in the
      // first paint, works with JavaScript disabled, and costs the visitor
      // nothing to download.
      qr: qrSvg(page.canonicalUrl, {
        moduleSize: 6,
        label: `Scan to open ${release.title} by ${release.artist_name}`,
      }),
    },
  };
}
