/**
 * Noizes — Pocketbase Schema Seed Script
 *
 * Usage:
 *   1. Start Pocketbase: ./pocketbase serve
 *   2. Set PB_URL and PB_ADMIN_* below or via env vars
 *   3. node seed.js
 *
 * Pocketbase collections mirror the Noizes .nz data model.
 */

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@noizes.local';
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || 'noizes1234';

async function pb(path, method = 'GET', body) {
  const res = await fetch(`${PB_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

let token = '';

async function main() {
  // Authenticate as superadmin
  const auth = await pb('/admins/auth-with-password', 'POST', {
    identity: PB_ADMIN_EMAIL,
    password: PB_ADMIN_PASSWORD
  });
  token = auth.token;
  console.log('Authenticated as admin.');

  const collections = [
    {
      name: 'works',
      type: 'base',
      schema: [
        { name: 'title',       type: 'text',   required: true,  options: { max: 500 } },
        { name: 'artist',      type: 'text',   required: true,  options: { max: 500 } },
        { name: 'release_id',  type: 'text',   required: false, options: { max: 100 } },
        { name: 'year',        type: 'text',   required: false, options: { max: 10 } },
        { name: 'genre',       type: 'text',   required: false, options: { max: 200 } },
        { name: 'location',    type: 'text',   required: false, options: { max: 200 } },
        { name: 'description', type: 'editor', required: false }
      ]
    },
    {
      name: 'editions',
      type: 'base',
      schema: [
        { name: 'work_id',      type: 'relation', required: true,  options: { collectionId: '', cascadeDelete: false } },
        { name: 'edition_name', type: 'text',     required: false, options: { max: 300 } },
        { name: 'edition_type', type: 'select',   required: true,  options: {
            values: ['First Edition','Open Edition','Founder Edition','Collector Edition','Archive Edition','Artist Proof']
          }
        },
        { name: 'edition_size', type: 'number',  required: false, options: { min: 1 } },
        { name: 'price',        type: 'number',  required: false, options: { min: 0 } },
        { name: 'currency',     type: 'select',  required: true,  options: { values: ['KES','USD','EUR'] } },
        { name: 'transferable', type: 'bool',    required: false }
      ]
    },
    {
      name: 'ownership_events',
      type: 'base',
      schema: [
        { name: 'edition_id', type: 'relation', required: true, options: { collectionId: '', cascadeDelete: false } },
        { name: 'event_type', type: 'select',   required: true, options: {
            values: ['created','purchased','transferred','gifted','donated','exhibited','archived']
          }
        },
        { name: 'from_user', type: 'relation', required: false, options: { collectionId: '_pb_users_auth_', cascadeDelete: false } },
        { name: 'to_user',   type: 'relation', required: false, options: { collectionId: '_pb_users_auth_', cascadeDelete: false } },
        { name: 'price',     type: 'number',   required: false, options: { min: 0 } },
        { name: 'currency',  type: 'select',   required: false, options: { values: ['KES','USD','EUR'] } },
        { name: 'notes',     type: 'text',     required: false, options: { max: 2000 } },
        { name: 'date',      type: 'date',     required: true }
      ]
    },
    {
      name: 'packages',
      type: 'base',
      schema: [
        { name: 'work_id',     type: 'relation', required: true, options: { collectionId: '', cascadeDelete: false } },
        { name: 'filename',    type: 'text',     required: true, options: { max: 500 } },
        { name: 'size_bytes',  type: 'number',   required: false, options: { min: 0 } },
        { name: 'packaged_at', type: 'date',     required: true }
      ]
    }
  ];

  for (const col of collections) {
    try {
      await pb('/collections', 'POST', col);
      console.log(`Created collection: ${col.name}`);
    } catch (e) {
      const err = JSON.parse(e.message);
      if (err?.data?.name?.code === 'validation_not_unique') {
        console.log(`Collection already exists: ${col.name}`);
      } else {
        console.error(`Error creating ${col.name}:`, e.message);
      }
    }
  }

  console.log('\nSeed complete. Collections: works, editions, ownership_events, packages');
  console.log('Note: update relation fields with actual collection IDs after creation.');
}

main().catch(console.error);
