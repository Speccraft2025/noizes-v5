import JSZip from 'jszip';
import { buildExperienceHTML } from './experience.js';

export async function buildPackage({ identity, edition, rights, assets, template, play }) {
  const zip = new JSZip();
  const releaseId = identity.release_id || `nz-${Date.now()}`;
  const now = new Date().toISOString();

  zip.file('manifest.json', JSON.stringify({
    noizes_version: '1.0.0',
    package_type:   'music',
    artist:         identity.artist,
    title:          identity.title,
    release_id:     releaseId,
    year:           identity.year,
    genre:          identity.genre,
    location:       identity.location,
    description:    identity.description,
    created_at:     now,
  }, null, 2));

  zip.file('edition.json', JSON.stringify({
    edition_name:  edition.edition_name || edition.edition_type,
    edition_type:  edition.edition_type,
    edition_size:  edition.edition_size || 'unlimited',
    price:         edition.price,
    currency:      edition.currency,
    transferable:  edition.transferable,
  }, null, 2));

  zip.file('rights.json', JSON.stringify({
    copyright: rights.copyright,
    license:   rights.license,
    producer:  rights.producer,
  }, null, 2));

  zip.file('credits.json', JSON.stringify({
    credits: rights.credits
      ? rights.credits.split('\n').map(l => l.trim()).filter(Boolean)
      : [],
  }, null, 2));

  // Audio — embed as data URI in NZ_CONFIG (works on iOS Safari in iframe)
  let audioBase64 = '';
  let audioMime   = '';
  let audioHash   = null;
  if (assets.audioFile) {
    const buf  = await assets.audioFile.arrayBuffer();
    audioMime  = assets.audioFile.type || 'audio/mpeg';
    audioBase64 = arrayBufferToBase64(buf);
    audioHash  = await sha256Hex(buf);
    // Also store the file in the zip for archival
    zip.folder('audio').file(assets.audioFile.name, buf);
  }

  // Provisional client-side integrity record. This gets recomputed from the
  // actual uploaded bytes and signed with the creator's custodial key
  // server-side at publish time — this copy is only for local/offline exports.
  zip.file('authenticity.json', JSON.stringify({
    method: 'sha256',
    hash: audioHash,
    signed: false,
    release_id: releaseId,
  }, null, 2));
  zip.file('technical.json',    JSON.stringify({ packaged_at: now, packager: 'Noizes Studio v1.0.0', noizes_version: '1.0.0' }, null, 2));

  // experience.json — canonical v2 experience data (additive; v1 viewers ignore it).
  // Emitted only when v2 content exists; today that's the play (games) block.
  if (play && play.games?.length) {
    zip.file('experience.json', JSON.stringify({
      schema_version: '2.0.0',
      release_id:     releaseId,
      play: {
        games:      play.games,
        difficulty: play.difficulty || 'standard',
        intensity:  typeof play.intensity === 'number' ? play.intensity : 1,
      },
    }, null, 2));
  }

  // Cover
  let coverBase64 = '';
  let coverMime   = '';
  if (assets.coverFile) {
    const buf  = await assets.coverFile.arrayBuffer();
    coverMime  = assets.coverFile.type || 'image/jpeg';
    coverBase64 = arrayBufferToBase64(buf);
    zip.folder('cover').file(assets.coverFile.name, buf);
  }

  // experience.html — fully self-contained
  const experienceHTML = buildExperienceHTML({
    identity, edition, rights,
    audioBase64, audioMime,
    coverBase64, coverMime,
    lyrics:   assets.lyrics || [],
    template: template      || 'ultra',
    play,
  });
  zip.file('experience.html', experienceHTML);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  const safeName = (identity.title || 'untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `${safeName}_${(template || 'ultra')}_noizes.nz`;

  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  return { filename, blob, audioFile: assets.audioFile, coverFile: assets.coverFile, audioHash };
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}
