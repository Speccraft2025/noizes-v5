import JSZip from 'jszip';
import { buildExperienceHTML } from './experience.js';

export async function buildPackage({ identity, edition, rights, assets }) {
  const zip = new JSZip();

  const releaseId = identity.release_id || `nz-${Date.now()}`;
  const now = new Date().toISOString();

  // manifest.json
  const manifestData = {
    noizes_version: '1.0.0',
    package_type: 'music',
    artist: identity.artist,
    title: identity.title,
    release_id: releaseId,
    year: identity.year,
    genre: identity.genre,
    location: identity.location,
    description: identity.description,
    created_at: now
  };
  zip.file('manifest.json', JSON.stringify(manifestData, null, 2));

  // edition.json
  const editionData = {
    edition_name: edition.edition_name || edition.edition_type,
    edition_type: edition.edition_type,
    edition_size: edition.edition_size || 'unlimited',
    price: edition.price,
    currency: edition.currency,
    transferable: edition.transferable
  };
  zip.file('edition.json', JSON.stringify(editionData, null, 2));

  // rights.json
  const rightsData = {
    copyright: rights.copyright,
    license: rights.license,
    producer: rights.producer
  };
  zip.file('rights.json', JSON.stringify(rightsData, null, 2));

  // credits.json
  const creditsData = {
    credits: rights.credits
      ? rights.credits.split('\n').map(l => l.trim()).filter(Boolean)
      : []
  };
  zip.file('credits.json', JSON.stringify(creditsData, null, 2));

  // authenticity.json
  const authenticityData = {
    method: 'sha256',
    signed: false,
    release_id: releaseId
  };
  zip.file('authenticity.json', JSON.stringify(authenticityData, null, 2));

  // technical.json
  const technicalData = {
    packaged_at: now,
    packager: 'Noizes Studio v1.0.0',
    noizes_version: '1.0.0'
  };
  zip.file('technical.json', JSON.stringify(technicalData, null, 2));

  // audio
  let audioName = '';
  if (assets.audioFile) {
    audioName = assets.audioFile.name;
    const audioBuffer = await assets.audioFile.arrayBuffer();
    zip.folder('audio').file(audioName, audioBuffer);
  }

  // cover — read as base64 for experience.html
  let coverBase64 = '';
  let coverMime = '';
  if (assets.coverFile) {
    const coverBuffer = await assets.coverFile.arrayBuffer();
    coverMime = assets.coverFile.type || 'image/jpeg';
    coverBase64 = arrayBufferToBase64(coverBuffer);
    zip.folder('cover').file(assets.coverFile.name, coverBuffer);
  }

  // lyrics
  if (assets.lyricsFile) {
    const lyricsBuffer = await assets.lyricsFile.arrayBuffer();
    zip.folder('lyrics').file(assets.lyricsFile.name, lyricsBuffer);
  }

  // experience.html
  const experienceHTML = buildExperienceHTML({
    identity,
    edition,
    rights,
    audioName,
    coverBase64,
    coverMime
  });
  zip.file('experience.html', experienceHTML);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  const safeName = (identity.title || 'untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `${safeName}_${edition.edition_type.replace(/\s+/g, '_').toLowerCase()}.nz`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  return filename;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
