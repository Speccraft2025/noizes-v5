const CURRENT_REQUIRED_FILES = Object.freeze([
  'manifest.json', 'edition.json', 'rights.json', 'credits.json',
  'authenticity.json', 'technical.json', 'experience.json',
  'experience.html',
]);

const LEGACY_REQUIRED_FILES = Object.freeze(['manifest.json', 'edition.json', 'experience.html']);

function issue(label, status, note, code = '') {
  return { label, status, note, code };
}

export async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readJson(zip, path) {
  const entry = zip.file(path);
  if (!entry) return null;
  return JSON.parse(await entry.async('string'));
}

/** Normalize old one-song manifests at the viewer boundary without migration. */
export function normalizePackageManifest(manifest = {}, files = []) {
  if (manifest.package_type === 'music_release' && manifest.release && Array.isArray(manifest.tracks)) {
    return { ...manifest, compatibility: { format: 'normalized_release', legacy: false } };
  }
  const audioPath = files.find((path) => path.startsWith('audio/') && !path.endsWith('/')) || '';
  const legacyTrack = {
    track_id: 'legacy-primary-track',
    disc_number: 1,
    track_number: 1,
    position: 1,
    title: manifest.title || 'Untitled track',
    primary_artist: manifest.artist || manifest.artist_name || '',
    primary_audio_component: 'legacy-primary-audio',
    duration_ms: 0,
    hidden: false,
    bonus: false,
  };
  return {
    ...manifest,
    package_type: 'music_release',
    release: {
      release_id: manifest.release_id || 'legacy-release',
      release_type: 'single',
      title: manifest.title || '',
      primary_artist: legacyTrack.primary_artist,
      year: manifest.year || '',
      track_count: 1,
      disc_count: 1,
    },
    tracks: [legacyTrack],
    components: audioPath ? [{
      component_id: 'legacy-primary-audio',
      scope: 'track',
      track_id: legacyTrack.track_id,
      type: 'audio',
      role: 'primary_master',
      path: audioPath,
    }] : [],
    compatibility: { format: 'legacy_single', legacy: true },
  };
}

export async function validateNzArchive(zip, options = {}) {
  const checks = [];
  const files = Object.keys(zip.files).filter((path) => !zip.files[path].dir);
  let rawManifest;
  try {
    rawManifest = await readJson(zip, 'manifest.json');
  } catch {
    checks.push(issue('manifest.json', 'fail', 'Invalid JSON', 'manifest_invalid'));
  }
  if (!rawManifest) checks.push(issue('manifest.json', 'fail', 'Missing — required', 'manifest_missing'));
  const current = rawManifest?.package_type === 'music_release' && rawManifest?.release && Array.isArray(rawManifest?.tracks);
  const required = current ? CURRENT_REQUIRED_FILES : LEGACY_REQUIRED_FILES;
  for (const path of required) {
    const present = files.includes(path);
    let validJson = true;
    if (present && path.endsWith('.json') && path !== 'manifest.json') {
      try { await readJson(zip, path); } catch { validJson = false; }
    }
    checks.push(issue(
      path,
      present && validJson ? 'pass' : 'fail',
      !present ? 'Missing — required' : validJson ? (path.endsWith('.json') ? 'Present · valid JSON' : 'Present') : 'Invalid JSON',
      !present ? 'required_file_missing' : validJson ? '' : 'required_json_invalid',
    ));
  }

  const manifest = normalizePackageManifest(rawManifest || {}, files);
  checks.push(issue('package schema', rawManifest ? 'pass' : 'fail', current ? 'Normalized music release' : 'Legacy Single compatibility mode', current ? '' : 'legacy_single'));
  checks.push(issue('noizes_version field', rawManifest?.noizes_version ? 'pass' : 'fail', rawManifest?.noizes_version || 'Missing', rawManifest?.noizes_version ? '' : 'version_missing'));
  if (current) {
    for (const path of ['archive.json', 'history.json']) {
      checks.push(issue(path, files.includes(path) ? 'pass' : 'warn', files.includes(path) ? 'Present' : 'Missing — older normalized package', files.includes(path) ? '' : 'normalized_optional_missing'));
    }
  }

  const trackIds = new Set();
  const publicNumbers = new Set();
  const componentIds = new Set();
  const componentPaths = new Set();
  let relationshipFailure = '';
  if (current && Number(manifest.release?.track_count) !== manifest.tracks.length) {
    relationshipFailure ||= `Release track_count does not match ${manifest.tracks.length} manifest tracks`;
  }
  for (const track of manifest.tracks || []) {
    if (!track.track_id || trackIds.has(track.track_id)) relationshipFailure ||= 'Track IDs are missing or duplicated';
    trackIds.add(track.track_id);
    const number = `${Number(track.disc_number) || 1}:${Number(track.track_number) || 1}`;
    if (publicNumbers.has(number)) relationshipFailure ||= `Duplicate public track number ${number}`;
    publicNumbers.add(number);
  }
  for (const component of manifest.components || []) {
    if (!component.component_id || componentIds.has(component.component_id)) relationshipFailure ||= 'Component IDs are missing or duplicated';
    if (!component.path || componentPaths.has(component.path)) relationshipFailure ||= 'Component paths are missing or duplicated';
    if (current && (!component.sha256 || !Number.isFinite(Number(component.size)))) relationshipFailure ||= `Component integrity metadata is incomplete for ${component.path || component.component_id}`;
    componentIds.add(component.component_id);
    componentPaths.add(component.path);
    if (component.track_id && !trackIds.has(component.track_id)) relationshipFailure ||= `Component references unknown track ${component.track_id}`;
  }
  for (const track of manifest.tracks || []) {
    if (!track.hidden && !track.primary_audio_component) relationshipFailure ||= `Primary audio reference is missing for ${track.title || track.track_id}`;
    if (track.primary_audio_component && !componentIds.has(track.primary_audio_component)) relationshipFailure ||= `Primary audio is missing for ${track.title || track.track_id}`;
  }
  checks.push(issue('release relationships', relationshipFailure ? 'fail' : 'pass', relationshipFailure || `${manifest.tracks.length} track records are internally linked`, relationshipFailure ? 'relationships_invalid' : ''));

  if (current) {
    const credits = await readJson(zip, 'credits.json').catch(() => null);
    const records = Array.isArray(credits?.records) ? credits.records : [];
    const recordIds = new Set();
    let creditFailure = '';
    for (const record of records) {
      if (!record.credit_id || recordIds.has(record.credit_id)) creditFailure ||= 'Credit IDs are missing or duplicated';
      recordIds.add(record.credit_id);
      if (!record.name || !record.role) creditFailure ||= 'A structured credit is missing its name or role';
      if ('email' in record || 'invite_status' in record || 'collaborator_user_id' in record) {
        creditFailure ||= 'Private collaborator invitation data is present in the portable package';
      }
      if ((record.track_ids || []).some((trackId) => !trackIds.has(trackId))) creditFailure ||= `Credit ${record.credit_id || record.name} references an unknown track`;
    }
    for (const trackCredit of Array.isArray(credits?.tracks) ? credits.tracks : []) {
      if (trackCredit.track_id && !trackIds.has(trackCredit.track_id)) creditFailure ||= `Credits reference unknown track ${trackCredit.track_id}`;
      if ((trackCredit.linked_release_credit_ids || []).some((creditId) => !recordIds.has(creditId))) creditFailure ||= `Track ${trackCredit.track_id} references an unknown release credit`;
    }
    checks.push(issue('credit relationships', creditFailure ? 'fail' : 'pass', creditFailure || `${records.length} structured credits are public and internally linked`, creditFailure ? 'credits_invalid' : ''));
  }

  let componentFailures = 0;
  let componentVerified = 0;
  const computedComponents = [];
  for (const component of manifest.components || []) {
    const entry = zip.file(component.path);
    if (!entry) {
      componentFailures += 1;
      checks.push(issue(component.path || component.component_id, 'fail', 'Declared component missing from archive', 'component_missing'));
      continue;
    }
    const buffer = await entry.async('arraybuffer');
    const hash = await sha256Hex(buffer);
    const sizeMatches = !Number.isFinite(Number(component.size)) || Number(component.size) === 0 || Number(component.size) === buffer.byteLength;
    const hashMatches = !component.sha256 || component.sha256 === hash;
    if (!sizeMatches || !hashMatches) componentFailures += 1;
    else componentVerified += 1;
    checks.push(issue(component.path, sizeMatches && hashMatches ? 'pass' : 'fail', !sizeMatches ? 'Size mismatch' : !hashMatches ? 'Checksum mismatch — component may have changed' : 'sha256 and size verified', sizeMatches && hashMatches ? '' : 'component_integrity_failed'));
    computedComponents.push({ path: component.path, sha256: hash, size: buffer.byteLength });
  }
  if (!manifest.components?.length) {
    const legacyAudio = files.find((path) => path.startsWith('audio/'));
    checks.push(issue('component inventory', legacyAudio ? 'warn' : 'fail', legacyAudio ? 'Legacy package has audio but no normalized component inventory' : 'No audio or component inventory', legacyAudio ? 'legacy_inventory' : 'inventory_missing'));
  } else {
    checks.push(issue('component inventory', componentFailures ? 'fail' : 'pass', `${componentVerified}/${manifest.components.length} components verified`, componentFailures ? 'inventory_failed' : ''));
  }

  const htmlEntry = zip.file(manifest.experience?.entry || 'experience.html');
  if (htmlEntry) {
    const html = await htmlEntry.async('string');
    const externalRuntime = /<(?:script|link)\b[^>]+(?:src|href)=["']https?:\/\//i.test(html);
    checks.push(issue('offline runtime', externalRuntime ? 'fail' : 'pass', externalRuntime ? 'Experience loads external code or styles' : 'No external runtime dependencies', externalRuntime ? 'external_runtime_dependency' : ''));
  }

  const authenticity = await readJson(zip, 'authenticity.json').catch(() => null);
  if (current && authenticity?.hash && computedComponents.length) {
    const inventoryText = computedComponents
      .map((component) => `${component.path}:${component.sha256}:${component.size}`)
      .sort()
      .join('\n');
    const inventoryHash = await sha256Hex(new TextEncoder().encode(inventoryText));
    checks.push(issue('authenticity inventory hash', inventoryHash === authenticity.hash ? 'pass' : 'fail', inventoryHash === authenticity.hash ? 'Complete component inventory verified' : 'Inventory hash mismatch', inventoryHash === authenticity.hash ? '' : 'authenticity_hash_mismatch'));
    if (authenticity.signed && options.verifySignature) {
      const valid = await options.verifySignature(authenticity);
      checks.push(issue('platform signature', valid ? 'pass' : 'fail', valid ? 'Signature valid' : 'Signature invalid', valid ? '' : 'signature_invalid'));
    } else if (authenticity.signed) {
      checks.push(issue('platform signature', 'warn', 'Signed; cryptographic signature was not checked in this context', 'signature_not_checked'));
    } else {
      checks.push(issue('platform signature', 'warn', 'Not signed (local Studio export)', 'unsigned_export'));
    }
  } else if (current) {
    checks.push(issue('authenticity inventory hash', 'fail', 'Missing normalized authenticity evidence', 'authenticity_missing'));
  } else if (authenticity?.hash && computedComponents.length === 1) {
    const matches = computedComponents[0].sha256 === authenticity.hash;
    checks.push(issue('legacy audio hash', matches ? 'pass' : 'fail', matches ? 'Legacy primary audio verified' : 'Legacy primary audio hash mismatch', matches ? '' : 'legacy_audio_hash_mismatch'));
  }

  const failed = checks.filter((check) => check.status === 'fail').length;
  const warned = checks.filter((check) => check.status === 'warn').length;
  return {
    valid: failed === 0,
    checks,
    manifest,
    format: manifest.compatibility.format,
    summary: { passed: checks.length - failed - warned, failed, warned },
  };
}
