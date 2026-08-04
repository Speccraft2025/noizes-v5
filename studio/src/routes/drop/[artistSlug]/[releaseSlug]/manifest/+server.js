import { error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { resolveDropAddress } from '$lib/server/drop-page.js';

// The package manifest, as stored at publish. manifest.json is the source of
// truth for what the object IS, so publishing it beside the Drop Page lets
// anyone check that the page's claims match the package's own description
// without downloading the whole thing.
export async function GET({ params }) {
  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { release } = await resolveDropAddress(sb, {
    artistSlug: params.artistSlug,
    slug: params.releaseSlug,
  });
  if (!release || release.status === 'draft') throw error(404, 'No release lives at this address.');

  const query = release.package_id
    ? sb.from('release_packages').select('manifest_json, version').eq('id', release.package_id).maybeSingle()
    : sb.from('release_packages').select('manifest_json, version').eq('release_id', release.id)
      .order('version', { ascending: false }).limit(1).maybeSingle();

  const { data: record } = await query;
  if (!record?.manifest_json || !Object.keys(record.manifest_json).length) {
    throw error(404, 'No manifest was recorded for this release.');
  }

  const filename = `manifest_${release.slug || release.id}_v${record.version}.json`;
  return new Response(JSON.stringify(record.manifest_json, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'public, max-age=0, s-maxage=300',
    },
  });
}
