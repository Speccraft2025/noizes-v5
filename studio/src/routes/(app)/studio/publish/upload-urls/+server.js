import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

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

  const { release_id, audio_ext, cover_ext } = await request.json();
  // releases.id is a uuid column; human-readable ids like "nz-123456" live in
  // the package manifest only.
  const releaseId = UUID_RE.test(release_id || '') ? release_id : crypto.randomUUID();

  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const basePath = `${locals.user.id}/${releaseId}`;

  const targets = { nz: `${basePath}/package.nz` };
  if (audio_ext) targets.audio = `${basePath}/audio.${safeExt(audio_ext)}`;
  if (cover_ext) targets.cover = `${basePath}/cover.${safeExt(cover_ext)}`;

  const uploads = {};
  for (const [key, path] of Object.entries(targets)) {
    const { data, error: e } = await sb.storage
      .from('releases')
      .createSignedUploadUrl(path, { upsert: true });
    if (e) throw error(500, `Could not create upload URL for ${key}: ${e.message}`);
    uploads[key] = { path, signedUrl: data.signedUrl };
  }

  return json({ release_id: releaseId, uploads });
}
