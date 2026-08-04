import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { findPublishSchemaError, publishSchemaMessage } from '$lib/server/publish-schema.js';
import { PACKAGE_BUCKET, COVER_BUCKET } from '$lib/server/storage.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeExt(ext) {
  return String(ext || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
}

// Publishing uploads go straight from the browser to Supabase Storage via
// signed upload URLs — Netlify functions cap request bodies at 6MB, so the
// multi-MB .nz/audio/cover can never pass through this server. This endpoint
// only mints the upload targets; /studio/publish finalizes after upload.
export async function POST({ request, locals }) {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (locals.profile?.kyc_status !== 'approved') {
    throw error(403, 'Identity verification required before publishing. Complete KYC at /verify first.');
  }

  const { release_id, cover_ext } = await request.json();
  // releases.id is a uuid column; human-readable ids like "nz-123456" live in
  // the package manifest only.
  const releaseId = UUID_RE.test(release_id || '') ? release_id : crypto.randomUUID();

  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const schemaFailure = await findPublishSchemaError(sb);
  if (schemaFailure) throw error(503, publishSchemaMessage(schemaFailure));
  const basePath = `${locals.user.id}/${releaseId}`;

  // The package goes to the private bucket; the cover stays public because
  // og:image is fetched by social crawlers long after any signed URL expires.
  //
  // The primary audio master is deliberately NOT uploaded. It used to be
  // written to `<base>/audio.<ext>` in the public bucket, where it sat as a
  // 2.5MB unprotected copy of the paid master that no code ever read — the
  // audio the experience plays comes from inside the .nz. An asset nothing
  // consumes cannot justify the exposure, so the target is gone.
  const targets = [
    { key: 'nz', bucket: PACKAGE_BUCKET, path: `${basePath}/package.nz` },
  ];
  if (cover_ext) {
    targets.push({ key: 'cover', bucket: COVER_BUCKET, path: `${basePath}/cover.${safeExt(cover_ext)}` });
  }

  const uploads = {};
  for (const { key, bucket, path } of targets) {
    const { data, error: e } = await sb.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: true });
    if (e) throw error(500, `Could not create upload URL for ${key}: ${e.message}`);
    uploads[key] = { path, signedUrl: data.signedUrl };
  }

  return json({ release_id: releaseId, uploads });
}
