import { error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { resolveDropAddress } from '$lib/server/drop-page.js';

// The authenticity certificate as a portable JSON document. Public on purpose:
// a certificate nobody can fetch is a certificate nobody can check.
//
// This is a convenience copy. The authoritative record is authenticity.json
// inside the .nz, and a verifier should check that one — it travels with the
// object and needs no server.
export async function GET({ params }) {
  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { release } = await resolveDropAddress(sb, {
    artistSlug: params.artistSlug,
    slug: params.releaseSlug,
  });
  if (!release || release.status === 'draft') throw error(404, 'No release lives at this address.');

  const { data: record } = await sb
    .from('release_authenticity')
    .select('*, release_packages(version, manifest_hash, package_hash, validation_status, validated_at)')
    .eq('release_id', release.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!record) throw error(404, 'No authenticity record has been written for this release.');

  const document = {
    schema_version: '1.0.0',
    kind: 'noizes-authenticity-certificate',
    issued_at: new Date().toISOString(),
    release: {
      release_id: release.id,
      title: release.title,
      artist: release.artist_name,
      edition_name: release.edition_name || release.edition_type || null,
      edition_size: release.edition_size ?? null,
    },
    package: {
      package_id: record.package_id,
      version: record.release_packages?.version ?? null,
      manifest_hash: record.release_packages?.manifest_hash ?? null,
      package_hash: record.release_packages?.package_hash ?? null,
      validation_status: record.release_packages?.validation_status ?? null,
      validated_at: record.release_packages?.validated_at ?? null,
    },
    authenticity: {
      method: record.method,
      signature_type: record.signature_type,
      content_hash: record.content_hash,
      signature: record.signature,
      signer_public_key: record.signer_public_key,
      verification_status: record.verification_status,
      verified_at: record.verified_at,
    },
    // Stated in the document itself, because a certificate travels away from
    // the page that explained it.
    notice: 'This certificate attests that the packaged components hash to the recorded inventory and that the '
      + 'creator signed that inventory. It is not a copyright registration and does not establish ownership of '
      + 'the underlying work. Verification requires no ledger and no connection to Noizes.',
  };

  const filename = `certificate_${release.slug || release.id}.json`;
  return new Response(JSON.stringify(document, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'public, max-age=0, s-maxage=300',
    },
  });
}
