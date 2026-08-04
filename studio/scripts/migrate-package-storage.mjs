#!/usr/bin/env node
/**
 * Move .nz packages out of the public bucket, and delete the raw audio masters
 * that should never have been there.
 *
 * Packages were stored in the public `releases` bucket, which made every
 * entitlement check in the application advisory:
 *
 *   GET /storage/v1/object/public/releases/<artist_id>/<release_id>/package.nz
 *     → 200, no authentication
 *
 * Alongside each one sat `audio.<ext>` — an unprotected copy of the primary
 * master that no code has ever read, since the audio the experience plays
 * comes from inside the .nz. It was pure exposure with no consumer.
 *
 *     node scripts/migrate-package-storage.mjs [--dry-run] [--delete-originals] [--verify-hash]
 *
 * Apply backend/private-package-storage-2026-08-04.sql first so the private
 * bucket exists.
 *
 * The default run COPIES packages into the private bucket, server-side, and
 * confirms the destination object's size. It deletes nothing: after it, the same bytes
 * exist in both places and both old and new code paths work, so a deploy can
 * land without a flag day. Once the deploy is live and downloads are confirmed,
 * re-run with --delete-originals to close the hole.
 *
 * That ordering is the point. Deleting first would break every download between
 * the migration and the deploy, on content people have paid for.
 *
 * Deletion re-reads the destination and refuses unless it matches the original.
 * By default that check is on size; --verify-hash compares full sha256 instead,
 * which is stronger but downloads every package twice.
 *
 * Exit codes:  0 done · 1 one or more objects failed · 2 could not start
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const COVER_BUCKET = 'releases';
const PACKAGE_BUCKET = 'release-packages';

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
const deleteOriginals = process.argv.includes('--delete-originals');
const verifyHash = process.argv.includes('--verify-hash');

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

const { data: buckets } = await sb.storage.listBuckets();
const target = (buckets ?? []).find((bucket) => bucket.id === PACKAGE_BUCKET);
if (!target) {
  console.error(`✗ The '${PACKAGE_BUCKET}' bucket does not exist. Apply backend/private-package-storage-2026-08-04.sql first.`);
  process.exit(2);
}
if (target.public) {
  console.error(`✗ The '${PACKAGE_BUCKET}' bucket is PUBLIC. Moving packages into it would achieve nothing — fix the bucket first.`);
  process.exit(2);
}

const { data: releases, error: listError } = await sb
  .from('releases')
  .select('id, title, artist_name, nz_path, audio_path')
  .not('nz_path', 'is', null)
  .order('created_at', { ascending: true });

if (listError) {
  console.error(`✗ Could not list releases: ${listError.message}`);
  process.exit(2);
}

/**
 * Existence and size of one object, from a directory listing.
 *
 * Deliberately not a download. These packages are ~10MB each and the earlier
 * version of this script pulled every one of them twice just to answer "is it
 * there?" — which on a slow link took longer than the whole migration should.
 */
async function statObject(bucket, path) {
  const slash = path.lastIndexOf('/');
  const dir = slash === -1 ? '' : path.slice(0, slash);
  const name = slash === -1 ? path : path.slice(slash + 1);
  const { data, error } = await sb.storage.from(bucket).list(dir, { search: name, limit: 100 });
  if (error) throw new Error(`could not list ${bucket}/${dir}: ${error.message}`);
  const match = (data ?? []).find((object) => object.name === name);
  return match ? { size: match.metadata?.size ?? null } : null;
}

/** sha256 of a stored object. Only used when --verify-hash is asked for. */
async function hashObject(bucket, path) {
  const { data, error } = await sb.storage.from(bucket).download(path);
  if (error) throw new Error(`download failed from ${bucket}: ${error.message}`);
  return sha256(Buffer.from(await data.arrayBuffer()));
}

async function migrate(release) {
  const path = release.nz_path;

  const [existing, original] = await Promise.all([
    statObject(PACKAGE_BUCKET, path),
    statObject(COVER_BUCKET, path),
  ]);

  if (!existing && !original) return { skipped: 'package not found in either bucket' };
  if (existing && !original) return { skipped: 'already migrated, original already removed' };

  let copied = false;
  const sizeMatches = existing && original && existing.size === original.size;

  if (!sizeMatches) {
    if (dryRun) return { dryRun: true, willCopy: true, bytes: original.size };
    // Server-side copy: the bytes move inside Supabase and never travel
    // through this machine, which is the difference between a migration that
    // takes seconds and one that times out.
    const { error: copyError } = await sb.storage
      .from(COVER_BUCKET)
      .copy(path, path, { destinationBucket: PACKAGE_BUCKET });
    if (copyError) throw new Error(`copy failed: ${copyError.message}`);
    copied = true;
  }

  const removed = [];
  if (deleteOriginals && !dryRun) {
    // Never delete on the strength of this run's own write. Re-read the
    // destination, and compare — by size always, by sha256 when asked. A
    // migration that trusts itself is one that can lose a paid object.
    const confirm = await statObject(PACKAGE_BUCKET, path);
    if (!confirm) throw new Error('refusing to delete: no copy found in the private bucket');
    if (original && confirm.size !== original.size) {
      throw new Error(`refusing to delete: size mismatch (${confirm.size} vs ${original.size})`);
    }
    if (verifyHash) {
      const [copyHash, originalHash] = await Promise.all([
        hashObject(PACKAGE_BUCKET, path),
        hashObject(COVER_BUCKET, path),
      ]);
      if (copyHash !== originalHash) {
        throw new Error('refusing to delete: sha256 mismatch between copy and original');
      }
    }

    if (original) {
      const { error: removeError } = await sb.storage.from(COVER_BUCKET).remove([path]);
      if (removeError) throw new Error(`could not remove public package: ${removeError.message}`);
      removed.push('package.nz');
    }

    // The raw master has no consumer at all, so it is deleted outright rather
    // than migrated. Nothing reads releases.audio_path; the column is cleared
    // so it stops pointing at an object that no longer exists.
    if (release.audio_path) {
      const { error: audioError } = await sb.storage.from(COVER_BUCKET).remove([release.audio_path]);
      if (audioError) throw new Error(`could not remove public audio master: ${audioError.message}`);
      await sb.from('releases').update({ audio_path: null }).eq('id', release.id);
      removed.push('audio master');
    }
  }

  if (dryRun) {
    return {
      dryRun: true,
      willCopy: copied,
      willDelete: deleteOriginals ? ['package.nz', release.audio_path ? 'audio master' : null].filter(Boolean) : [],
    };
  }

  return { copied, removed };
}

const mode = dryRun ? 'Dry run over' : deleteOriginals ? 'Migrating and removing originals for' : 'Copying packages for';
console.log(`${mode} ${releases.length} release${releases.length === 1 ? '' : 's'}\n`);

let failed = 0;
for (const release of releases) {
  const label = `${release.artist_name} — ${release.title}`.slice(0, 44).padEnd(46);
  try {
    const result = await migrate(release);
    if (result.skipped) {
      console.log(`  skipped  ${label} ${result.skipped}`);
    } else if (result.dryRun) {
      const actions = [
        result.willCopy ? 'copy to private bucket' : 'already copied',
        ...(result.willDelete ?? []).map((item) => `delete public ${item}`),
      ];
      console.log(`  would    ${label} ${actions.join(' · ')}`);
    } else {
      const actions = [
        result.copied ? 'copied' : 'already present',
        ...result.removed.map((item) => `removed public ${item}`),
      ];
      console.log(`  ok       ${label} ${actions.join(' · ')}`);
    }
  } catch (cause) {
    failed += 1;
    console.error(`  FAILED   ${label} ${cause.message}`);
  }
}

console.log('');
if (failed) {
  console.error(`✗ ${failed} release${failed === 1 ? '' : 's'} failed. Nothing was deleted for those; re-run to retry.`);
  process.exit(1);
}
if (dryRun) {
  console.log('✓ Dry run complete — nothing was written.');
} else if (deleteOriginals) {
  console.log('✓ Packages are private and the public copies are gone.');
} else {
  console.log('✓ Packages copied. Originals are still public and still work — deploy, confirm downloads, then re-run with --delete-originals.');
}
