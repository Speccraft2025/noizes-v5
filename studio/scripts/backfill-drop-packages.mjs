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
 *     node scripts/backfill-drop-packages.mjs [--dry-run] [--revalidate]
 *
 * Needs PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, from the
 * environment or studio/.env. Safe to re-run: a release that already has a
 * package row for the same bytes is skipped.
 *
 * --revalidate re-opens every recorded package and rewrites its verdict. Use it
 * after a validator change, or on packages recorded by an earlier version of
 * this script that stored 'unvalidated'.
 *
 * The verdict is the real one: the archive is opened, every declared component
 * is re-hashed, the inventory hash is recomputed, and the creator's Ed25519
 * signature is checked against the key in the package. A package whose
 * structure is sound but whose signature does not verify is recorded 'invalid'
 * — an unchecked "valid" would be worth less than no claim at all.
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
import { validateNzArchive } from '../src/lib/domain/package-validation.js';
import { verifySignature } from '../src/lib/server/crypto-verify.js';

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
const revalidate = process.argv.includes('--revalidate');

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

/**
 * Run the real validator over an archive and reduce it to a stored verdict.
 *
 * The signature callback is what makes this more than a structural check: the
 * validator otherwise records "signed, but not cryptographically checked in
 * this context", which is exactly the hedge a Drop Page should not repeat.
 */
async function validate(zip) {
  const result = await validateNzArchive(zip, {
    verifySignature: (authenticity) => verifySignature({
      hash: authenticity.hash,
      signature: authenticity.signature,
      publicKey: authenticity.signer_public_key,
    }),
  });
  const failures = result.checks.filter((check) => check.status === 'fail');
  return {
    status: result.valid ? 'valid' : 'invalid',
    format: result.format,
    summary: result.summary,
    failures: failures.map((check) => `${check.label}: ${check.note}`),
  };
}

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
    .select('id, validation_status')
    .eq('release_id', release.id)
    .eq('package_hash', packageHash)
    .maybeSingle();

  const zip = await JSZip.loadAsync(bytes);

  // An already-recorded package is re-opened only to rewrite its verdict.
  // Everything else about it is unchanged: the bytes hash the same, so the
  // manifest and hashes already stored are still the right ones.
  if (prior) {
    if (!revalidate) return { skipped: 'already recorded' };
    const verdict = await validate(zip);
    if (dryRun) return { dryRun: true, revalidated: true, was: prior.validation_status, verdict };
    const { error: updateError } = await sb
      .from('release_packages')
      .update({ validation_status: verdict.status, validated_at: new Date().toISOString() })
      .eq('id', prior.id);
    if (updateError) throw new Error(`could not store verdict: ${updateError.message}`);
    return { revalidated: true, was: prior.validation_status, verdict };
  }

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

  const verdict = await validate(zip);

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
    validation_status: verdict.status,
    validated_at: new Date().toISOString(),
  };

  if (dryRun) {
    return {
      dryRun: true,
      verdict,
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
    // `signed: true` is the package asserting something about itself. Whether
    // the signature actually verifies against the key it carries is a
    // different question, and it is the one the Drop Page reports — so check
    // it here rather than copying the claim across.
    const signatureVerifies = Boolean(authenticity.signature && authenticity.signer_public_key)
      && verifySignature({
        hash: authenticity.hash,
        signature: authenticity.signature,
        publicKey: authenticity.signer_public_key,
      });

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
      verification_status: signatureVerifies ? 'verified' : authenticity.signature ? 'failed' : 'unverified',
      verified_at: signatureVerifies ? new Date().toISOString() : null,
    }, { onConflict: 'package_id' });
    if (authError) throw new Error(`authenticity insert failed: ${authError.message}`);
    facts.signature_verifies = signatureVerifies;
  }

  const { error: linkError } = await sb
    .from('releases')
    .update({ package_id: packageRecord.id, experience_entry: facts.experience_entry })
    .eq('id', release.id);
  if (linkError) throw new Error(`could not link package to release: ${linkError.message}`);

  return {
    version: facts.version,
    verdict,
    signed: Boolean(authenticity?.signature),
    signatureVerifies: facts.signature_verifies ?? null,
    tracks: manifest?.tracks?.length ?? 0,
    components: manifest?.components?.length ?? 0,
  };
}

// Normally only releases that have no package record at all; with
// --revalidate, every release with a package, so stored verdicts can be
// refreshed after a validator change.
let query = sb
  .from('releases')
  .select('id, title, artist_name, nz_path, package_id, status')
  .in('status', ['published', 'withdrawn', 'archived']);
if (!revalidate) query = query.is('package_id', null);
const { data: releases, error: listError } = await query.order('created_at', { ascending: true });

if (listError) {
  console.error(`✗ Could not list releases: ${listError.message}`);
  process.exit(2);
}

if (!releases.length) {
  console.log('✓ Nothing to do — every published release already has a package record.');
  process.exit(0);
}

const verb = revalidate ? 'Revalidating' : dryRun ? 'Would back fill' : 'Backfilling';
console.log(`${verb} ${releases.length} release${releases.length === 1 ? '' : 's'}\n`);

let failed = 0;
let invalid = 0;
for (const release of releases) {
  const label = `${release.artist_name} — ${release.title}`.slice(0, 52).padEnd(54);
  try {
    const result = await backfill(release);
    if (result.skipped) {
      console.log(`  skipped  ${label} ${result.skipped}`);
      continue;
    }

    const verdict = result.verdict;
    if (verdict?.status === 'invalid') invalid += 1;
    const mark = verdict?.status === 'valid' ? 'valid  ' : 'INVALID';
    const signature = result.signatureVerifies === null || result.signatureVerifies === undefined
      ? (result.signed ? 'signed' : 'unsigned')
      : result.signatureVerifies ? 'signature verified' : 'SIGNATURE FAILED';

    if (result.revalidated) {
      console.log(`  ${mark}  ${label} was '${result.was}' · ${verdict.summary.passed} checks passed`);
    } else {
      console.log(`  ${mark}  ${label} ${result.tracks} tracks · ${result.components} components · ${signature}`);
    }
    // A failing check is the whole point of running the validator; printing
    // only the verdict would leave the operator with no idea what to fix.
    for (const failure of verdict?.failures ?? []) {
      console.log(`           ${' '.repeat(54)} ↳ ${failure}`);
    }
  } catch (cause) {
    failed += 1;
    console.error(`  FAILED   ${label} ${cause.message}`);
  }
}

console.log('');
if (failed) {
  console.error(`✗ ${failed} release${failed === 1 ? '' : 's'} could not be processed. The rest were recorded; re-run to retry.`);
  process.exit(1);
}
if (invalid) {
  // Not an error exit: recording that a package does not validate is a
  // successful run of this script, and the Drop Page will say so honestly.
  console.log(`⚠ ${invalid} package${invalid === 1 ? '' : 's'} did not validate. The verdict is recorded; the Drop Page will not claim otherwise.`);
}
console.log(dryRun ? '✓ Dry run complete — nothing was written.' : '✓ Done.');
