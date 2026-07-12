import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import nodeCrypto from 'node:crypto';
import JSZip from 'jszip';
import { signHash } from '$lib/server/signing.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Finalizes a publish after the browser has uploaded the .nz (and optional
// audio/cover) directly to Supabase Storage via /studio/publish/upload-urls.
// The request body is metadata only — file bytes never pass through this
// function (Netlify caps request bodies at 6MB).
export async function POST({ request, locals }) {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (locals.profile?.kyc_status !== 'approved') {
    throw error(403, 'Identity verification required before publishing. Complete KYC at /verify first.');
  }

  const { release_id: releaseId, meta } = await request.json();
  if (!UUID_RE.test(releaseId || '')) throw error(400, 'release_id must be the uuid returned by upload-urls');
  if (!meta?.artist || !meta?.title) throw error(400, 'meta.artist and meta.title are required');

  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  // Derived from the session, never from the request — a client cannot
  // publish paths under another user's prefix.
  const basePath = `${locals.user.id}/${releaseId}`;

  const { data: objects, error: listErr } = await sb.storage.from('releases').list(basePath);
  if (listErr) throw error(500, `Storage list failed: ${listErr.message}`);
  const names = (objects || []).map(o => o.name);

  if (!names.includes('package.nz')) {
    throw error(400, 'package.nz not found in storage — upload it via upload-urls before finalizing');
  }
  const nz_path = `${basePath}/package.nz`;
  const audioName = names.find(n => n.startsWith('audio.'));
  const coverName = names.find(n => n.startsWith('cover.'));
  const audio_path = audioName ? `${basePath}/${audioName}` : null;
  const cover_path = coverName ? `${basePath}/${coverName}` : null;

  // Re-derive the integrity hash from the audio inside the package (the
  // validator hashes the zip's audio/ entry — never trust the client's
  // declared hash), sign it with the creator's custodial key, and embed the
  // finalized record in the package.
  const { data: nzBlob, error: dlErr } = await sb.storage.from('releases').download(nz_path);
  if (dlErr) throw error(500, `.nz download failed: ${dlErr.message}`);

  const zip = await JSZip.loadAsync(Buffer.from(await nzBlob.arrayBuffer()));
  const audioEntry = Object.keys(zip.files).find(f => f.startsWith('audio/') && !zip.files[f].dir);
  if (audioEntry) {
    const audioBuf = await zip.files[audioEntry].async('nodebuffer');
    const hash = nodeCrypto.createHash('sha256').update(audioBuf).digest('hex');
    const { signature, publicKey } = await signHash(sb, locals.user.id, Buffer.from(hash, 'hex'));

    zip.file('authenticity.json', JSON.stringify({
      method: 'sha256',
      hash,
      signed: true,
      algorithm: 'ed25519',
      signer_public_key: publicKey,
      signature,
      signed_at: new Date().toISOString(),
      release_id: releaseId,
    }, null, 2));
    const nzBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    const { error: upErr } = await sb.storage.from('releases').upload(nz_path, nzBuffer, {
      contentType: 'application/zip',
      upsert: true
    });
    if (upErr) throw error(500, `.nz upload failed: ${upErr.message}`);
  }

  const { data: release, error: dbErr } = await sb
    .from('releases')
    .upsert({
      id: releaseId,
      artist_id: locals.user.id,
      artist_name: meta.artist,
      title: meta.title,
      genre: meta.genre,
      year: meta.year,
      location: meta.location,
      description: meta.description,
      edition_type: meta.edition_type,
      edition_name: meta.edition_name,
      edition_size: meta.edition_size ? parseInt(meta.edition_size) : null,
      price: parseFloat(meta.price) || 0,
      currency: meta.currency,
      cover_path,
      audio_path,
      nz_path,
      status: 'published',
    }, { onConflict: 'id' })
    .select()
    .single();

  if (dbErr) throw error(500, `DB insert failed: ${dbErr.message}`);

  return json({ success: true, release_id: release.id });
}
