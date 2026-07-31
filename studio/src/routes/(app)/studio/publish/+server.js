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
  if (!meta?.title || (!meta?.artist && meta?.release_type !== 'compilation')) {
    throw error(400, 'meta.title and a primary artist are required (Compilation may use Various Artists)');
  }

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
  let packageManifest = null;
  let declaredComponents = [];
  const manifestEntry = zip.file('manifest.json');
  if (manifestEntry) {
    try {
      packageManifest = JSON.parse(await manifestEntry.async('string'));
      declaredComponents = packageManifest.components || [];
    } catch {
      throw error(400, 'Package manifest.json is not valid JSON');
    }
  }
  if (packageManifest?.release?.release_id && packageManifest.release.release_id !== releaseId) {
    throw error(400, 'Package release ID does not match the publish target');
  }
  const inventoryEntries = declaredComponents.length
    ? declaredComponents.map((component) => component.path).filter(Boolean)
    : Object.keys(zip.files).filter((path) =>
        !zip.files[path].dir && (
          path.startsWith('audio/')
          || /^tracks\/[^/]+\/audio\//.test(path)
          || path.startsWith('release/audio/')
        )
      );
  if (inventoryEntries.length) {
    const components = [];
    for (const path of [...new Set(inventoryEntries)].sort()) {
      const entry = zip.file(path);
      if (!entry) throw error(400, `Manifest component is missing from package: ${path}`);
      const audioBuf = await entry.async('nodebuffer');
      const sha256 = nodeCrypto.createHash('sha256').update(audioBuf).digest('hex');
      const declared = declaredComponents.find((component) => component.path === path);
      if (declared?.sha256 && declared.sha256 !== sha256) {
        throw error(400, `Component checksum mismatch: ${path}`);
      }
      components.push({
        component_id: declared?.component_id || null,
        path,
        sha256,
        size: audioBuf.byteLength,
      });
    }
    const inventory = Buffer.from(components.map((component) => `${component.path}:${component.sha256}:${component.size}`).join('\n'));
    const hash = nodeCrypto.createHash('sha256').update(inventory).digest('hex');
    const { signature, publicKey } = await signHash(sb, locals.user.id, Buffer.from(hash, 'hex'));

    zip.file('authenticity.json', JSON.stringify({
      method: 'sha256-component-inventory',
      hash,
      components,
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
      artist_name: meta.artist || 'Various Artists',
      title: meta.title,
      release_type: meta.release_type || 'single',
      featured_artists: Array.isArray(meta.featured_artists) ? meta.featured_artists : [],
      compilation_artists: Array.isArray(meta.compilation_artists) ? meta.compilation_artists : [],
      release_date: meta.release_date || null,
      genres: String(meta.genre || '').split(',').map((entry) => entry.trim()).filter(Boolean),
      catalogue_number: meta.catalogue_number || null,
      label: meta.label || null,
      track_count: Number(meta.track_count) || 0,
      disc_count: Number(meta.disc_count) || 1,
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

  // The package manifest and track.json records are authoritative. Replace the
  // normalized rows from the service-role publish boundary; acquisitions
  // remain linked only to the complete release row.
  if (packageManifest?.package_type === 'music_release') {
    const trackRecords = [];
    for (const path of Object.keys(zip.files).filter((name) => /^tracks\/[^/]+\/track\.json$/.test(name)).sort()) {
      try {
        trackRecords.push(JSON.parse(await zip.files[path].async('string')));
      } catch {
        throw error(400, `Invalid track record: ${path}`);
      }
    }

    const { error: clearErr } = await sb.from('tracks').delete().eq('release_id', releaseId);
    if (clearErr) throw error(500, `Could not replace published tracklist: ${clearErr.message}`);

    if (trackRecords.length) {
      const { error: trackErr } = await sb.from('tracks').insert(trackRecords.map((track) => ({
        id: track.track_id,
        release_id: releaseId,
        position: track.position,
        disc_number: track.disc_number,
        track_number: track.track_number,
        title: track.title,
        subtitle: track.subtitle || null,
        primary_artist: track.primary_artist,
        featured_artists: track.featured_artists || [],
        producers: track.producers || [],
        writers: track.writers || [],
        isrc: track.isrc || null,
        explicit: Boolean(track.explicit),
        bonus: Boolean(track.bonus),
        hidden: Boolean(track.hidden),
        description: track.description || null,
        artwork_ref: track.artwork_ref || null,
        primary_version_id: track.audio_versions?.find((version) => version.is_primary)?.version_id || null,
        primary_audio_asset_id: track.primary_audio_component || null,
        appears_in_journey: track.appears_in_journey !== false,
        appears_in_archive: track.appears_in_archive !== false,
        lyrics: track.lyrics || {},
        credits: track.credits || {},
        rights: track.rights || {},
      })));
      if (trackErr) throw error(500, `Could not publish tracklist: ${trackErr.message}`);

      const versions = trackRecords.flatMap((track) => (track.audio_versions || []).map((version) => ({
        id: version.version_id,
        release_id: releaseId,
        track_id: track.track_id,
        role: version.role,
        title: version.title || '',
        is_primary: Boolean(version.is_primary),
        notes: version.notes || null,
      })));
      if (versions.length) {
        const { error: versionErr } = await sb.from('audio_versions').insert(versions);
        if (versionErr) throw error(500, `Could not publish audio versions: ${versionErr.message}`);
      }

      const audioAssets = declaredComponents.filter((component) => component.type === 'audio').map((component) => ({
        id: component.component_id,
        release_id: releaseId,
        track_id: component.track_id || null,
        version_id: component.version_id || null,
        scope: component.scope,
        role: component.role,
        title: component.title || null,
        filename: component.filename || null,
        storage_path: `${nz_path}#${component.path}`,
        mime: component.mime || null,
        duration_ms: Number(component.duration_ms) || 0,
        sample_rate: Number(component.sample_rate) || 0,
        bit_depth: Number(component.bit_depth) || 0,
        channels: Number(component.channels) || 0,
        size_bytes: Number(component.size) || 0,
        sha256: component.sha256 || null,
      }));
      if (audioAssets.length) {
        const { error: assetErr } = await sb.from('audio_assets').insert(audioAssets);
        if (assetErr) throw error(500, `Could not publish audio assets: ${assetErr.message}`);
      }
    }
  }

  return json({ success: true, release_id: release.id });
}
