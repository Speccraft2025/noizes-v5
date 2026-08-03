#!/usr/bin/env node
/**
 * Fail loudly when the database is behind the application.
 *
 * Probes every table and column the app needs and exits non-zero if any are
 * missing, naming the migration that supplies them.
 *
 * Run it before a deploy, or after applying SQL, or any time the Exchange
 * looks suspiciously empty:
 *
 *     npm run check:schema
 *
 * Needs real credentials — PUBLIC_SUPABASE_URL and either
 * SUPABASE_SERVICE_ROLE_KEY or PUBLIC_SUPABASE_ANON_KEY, from the
 * environment or studio/.env. CI has only placeholders, so this is
 * deliberately not wired into the PR build; it is for environments that can
 * actually reach the database.
 *
 * Exit codes:  0 schema matches · 1 drift found · 2 could not verify
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schemaProbes, summarizeSchemaCheck } from '../src/lib/domain/required-schema.js';

/** Read studio/.env without pulling in a dependency, and without printing it. */
function loadEnvFile() {
  const path = fileURLToPath(new URL('../.env', import.meta.url));
  const out = {};
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return out;                                  // absent is fine; env may be set
  }
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    out[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const fileEnv = loadEnvFile();
const url = process.env.PUBLIC_SUPABASE_URL || fileEnv.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY
  || process.env.PUBLIC_SUPABASE_ANON_KEY || fileEnv.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('✗ Cannot check the schema: no Supabase URL/key in the environment or studio/.env.');
  process.exit(2);
}
if (/placeholder/i.test(url) || /placeholder/i.test(key)) {
  console.error('✗ Refusing to check against placeholder credentials — this would always "pass".');
  process.exit(2);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function probe({ table, select, target, migration }) {
  try {
    const response = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=0`, { headers });
    if (response.ok) return { target, migration, error: null };
    const body = await response.json().catch(() => ({}));
    // A body with no code is still a failure, just not a classifiable one.
    return { target, migration, error: { code: body.code ?? `HTTP_${response.status}`, message: body.message } };
  } catch (cause) {
    return { target, migration, error: { code: 'NETWORK', message: String(cause?.message ?? cause) } };
  }
}

const probes = schemaProbes();
const results = await Promise.all(probes.map(probe));
const verdict = summarizeSchemaCheck(results);

console.log(`Checked ${results.length} objects against ${url.replace(/https:\/\/([^.]+).*/, '$1')}\n`);

if (verdict.missing.length) {
  console.error('✗ SCHEMA DRIFT — the database is behind the application.\n');
  for (const item of verdict.missing) {
    console.error(`    missing  ${item.target.padEnd(34)} ${item.error.code}`);
  }
  console.error(`\n  Apply, in Supabase → SQL Editor:`);
  for (const migration of verdict.migrations) console.error(`    backend/${migration}`);
  console.error('\n  Until then, pages that read these will fail. Reads now report the');
  console.error('  fault rather than rendering an empty list, but nothing will load.\n');
  process.exit(1);
}

if (verdict.errored.length) {
  console.error('✗ Could not verify the schema — probes failed for reasons other than drift:\n');
  for (const item of verdict.errored) {
    console.error(`    ${item.target.padEnd(34)} ${item.error.code}  ${item.error.message ?? ''}`);
  }
  console.error('\n  This is not proof of drift. Check credentials and connectivity.\n');
  process.exit(2);
}

console.log(`✓ ${verdict.summary}`);
