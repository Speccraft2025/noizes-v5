#!/usr/bin/env node
/**
 * Give releases published before Drop Pages existed a package record.
 *
 * Those releases have a .nz in storage but no row in `release_packages`, so a
 * Drop Page has nothing to describe them with. That is not merely a thin page:
 * the authenticity panel reads "Not signed" for a package whose
 * authenticity.json is signed, which is a false claim in the direction that
 * matters most. This script reads each package and records what is actually
 * in it.
 *
 *     node scripts/backfill-drop-packages.mjs [--dry-run]
 *
 * Needs PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, from the
 * environment or studio/.env. Safe to re-run: a release that already has a
 * package row for the same bytes is skipped.
 *
 * Provenance is deliberately NOT backfilled. The release chain's events are
 * signed attestations carrying dates; emitting a 'published' event dated today
 * for a release published in July would be attesting to something untrue. Old
 * releases keep the copy chains their acquisitions already created, and their
 * release chain simply starts empty.
 *
 * Exit codes:  0 done (or nothing to do) · 1 one or more releases failed · 2 could not start
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import { createClient } from '@supabase/supabase-js';
import { summarizeExperience } from '../src/lib/domain/drop-contents.js';

function loadEnvFile() {
  const path = fileURLToPath(new URL('../.env', import.meta.url));
  const out = {};
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) out[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const fileEnv = loadEnvFile();
const url = process.env.PUBLIC_SUPABASE_URL || fileEnv.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes('--dry-run');

if (!url || !key) {
  console.error('✗ Need PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment or studio/.env.');
  process.exit(2);
}
if (/placeholder/i.test(url) || /placeholder/i.test(key)) {
  console.error('✗ Refusing to run against placeholder credentials.');
  process.exit(2);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

async function readJson(zip, path) {
  const entry = zip.file(path);
  if (!entry) return null;
  try {
    return JSON.parse(await entry.async('string'));
  } catch {
    return null;
  }
}

async function backfill(release) {
  if (!release.nz_path) return { skipped: 'no package in storage' };

  const { data: blob, error: downloadError } = await sb.storage.from('releases').download(release.nz_path);
  if (downloadError) throw new Error(`download failed: ${downloadError.message}`);

  const bytes = Buffer.from(await blob.arrayBuffer());
  const packageHash = sha256(bytes);

  const { data: prior } = await sb
    .from('release_packages')
    .select('id')
    .eq('release_id', release.id)
    .eq('package_hash', packageHash)
    .maybeSingle();
  if (prior) return { skipped: 'already recorded' };

  const zip = await JSZip.loadAsync(bytes);

  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) throw new Error('package has no manifest.json');
  const manifestBytes = await manifestEntry.async('nodebuffer');
  const manifestHash = sha256(manifestBytes);
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch {
    throw new Error('manifest.json is not valid JSON');
  }

  const authenticity = await readJson(zip, 'authenticity.json');
  const experience = (await readJson(zip, 'experience.json')) ?? {};
  const trackRecords = [];
  for (const path of Object.keys(zip.files).filter((name) => /^tracks\/[^/]+\/track\.json$/.test(name)).sort()) {
    const record = await readJson(zip, path);
    if (record) trackRecords.push(record);
  }

  // Validation status is recorded as 'unvalidated' rather than asserted:
  // this script did not run the validator, and claiming a check that never
  // happened is the same failure the Drop Page exists to avoid.
  const facts = {
    release_id: release.id,
    version: 1,
    storage_path: release.nz_path,
    filename: `${release.title}.nz`,
    file_size: bytes.byteLength,
    manifest_json: manifest,
    manifest_hash: manifestHash,
    package_hash: packageHash,
    package_version: manifest?.noizes_version ?? null,
    experience_entry: manifest?.experience?.entry || 'experience.html',
    experience_summary: summarizeExperience(experience, trackRecords),
    validation_status: 'unvalidated',
  };

  if (dryRun) {
    return {
      dryRun: true,
      signed: Boolean(authenticity?.signature),
      tracks: manifest?.tracks?.length ?? 0,
      components: manifest?.components?.length ?? 0,
    };
  }

  const { data: latest } = await sb
    .from('release_packages')
    .select('version')
    .eq('release_id', release.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  facts.version = (latest?.version ?? 0) + 1;

  const { data: packageRecord, error: insertError } = await sb
    .from('release_packages')
    .insert(facts)
    .select()
    .single();
  if (insertError) throw new Error(`package insert failed: ${insertError.message}`);

  if (authenticity?.hash) {
    const { error: authError } = await sb.from('release_authenticity').upsert({
      release_id: release.id,
      package_id: packageRecord.id,
      signature_type: authenticity.algorithm || 'ed25519',
      method: authenticity.method || 'sha256-component-inventory',
      content_hash: authenticity.hash,
      signature: authenticity.signature ?? null,
      signer_public_key: authenticity.signer_public_key ?? null,
      certificate: {
        signed_at: authenticity.signed_at ?? null,
        component_count: Array.isArray(authenticity.components) ? authenticity.components.length : 0,
        backfilled: true,
      },
      verification_status: authenticity.signed ? 'verified' : 'unverified',
      verified_at: authenticity.signed ? (authenticity.signed_at ?? null) : null,
    }, { onConflict: 'package_id' });
    if (authError) throw new Error(`authenticity insert failed: ${authError.message}`);
  }

  const { error: linkError } = await sb
    .from('releases')
    .update({ package_id: packageRecord.id, experience_entry: facts.experience_entry })
    .eq('id', release.id);
  if (linkError) throw new Error(`could not link package to release: ${linkError.message}`);

  return {
    version: facts.version,
    signed: Boolean(authenticity?.signature),
    tracks: manifest?.tracks?.length ?? 0,
    components: manifest?.components?.length ?? 0,
  };
}

const { data: releases, error: listError } = await sb
  .from('releases')
  .select('id, title, artist_name, nz_path, package_id, status')
  .in('status', ['published', 'withdrawn', 'archived'])
  .is('package_id', null)
  .order('created_at', { ascending: true });

if (listError) {
  console.error(`✗ Could not list releases: ${listError.message}`);
  process.exit(2);
}

if (!releases.length) {
  console.log('✓ Nothing to backfill — every published release already has a package record.');
  process.exit(0);
}

console.log(`${dryRun ? 'Would back fill' : 'Backfilling'} ${releases.length} release${releases.length === 1 ? '' : 's'}\n`);

let failed = 0;
for (const release of releases) {
  const label = `${release.artist_name} — ${release.title}`.slice(0, 52).padEnd(54);
  try {
    const result = await backfill(release);
    if (result.skipped) {
      console.log(`  skipped  ${label} ${result.skipped}`);
    } else {
      console.log(`  ok       ${label} ${result.tracks} tracks · ${result.components} components · ${result.signed ? 'signed' : 'unsigned'}`);
    }
  } catch (cause) {
    failed += 1;
    console.error(`  FAILED   ${label} ${cause.message}`);
  }
}

console.log('');
if (failed) {
  console.error(`✗ ${failed} release${failed === 1 ? '' : 's'} could not be backfilled. The rest were recorded; re-run to retry.`);
  process.exit(1);
}
console.log(dryRun ? '✓ Dry run complete — nothing was written.' : '✓ Backfill complete.');
