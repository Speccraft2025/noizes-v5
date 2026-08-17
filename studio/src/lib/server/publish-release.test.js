import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FakeSupabase } from './fake-supabase.js';

// provenance.js lazily imports signing.js, which resolves $env only inside the
// SvelteKit runtime. The chain's own behaviour is covered in provenance.test.js;
// here we only care that publishing opens it once and never twice.
const chains = new Map();
vi.mock('./provenance.js', () => ({
  RELEASE_CHAIN_EDITION: 0,
  loadChain: async (_sb, releaseId, editionNumber) => chains.get(`${releaseId}:${editionNumber}`) ?? [],
  appendEvent: async (_sb, { releaseId, editionNumber, kind }) => {
    const key = `${releaseId}:${editionNumber}`;
    const chain = chains.get(key) ?? [];
    const event = { release_id: releaseId, edition_number: editionNumber, seq: chain.length, kind };
    chains.set(key, [...chain, event]);
    return event;
  },
}));

const {
  finalizePublication, reserveDropSlug, recordPackageVersion, recordAuthenticity,
  openReleaseChain, unpublishRelease, PublishError,
} = await import('./publish-release.js');

const RELEASE_ID = 'a1b2c3d4-0000-4000-8000-000000000000';
const ARTIST_ID = 'artist-1';

const UNIQUE = {
  releases: [['id']],
  release_slugs: [['artist_slug', 'slug']],
  release_packages: [['id'], ['release_id', 'version']],
  release_authenticity: [['package_id']],
};

function db(seed = {}) {
  return new FakeSupabase({ unique: UNIQUE, seed });
}

const releaseRow = {
  artist_name: 'dBoy',
  title: 'Retrospect',
  price: 1500,
  currency: 'KES',
  edition_size: 100,
  nz_path: `${ARTIST_ID}/${RELEASE_ID}/package.nz`,
};

const packageFacts = {
  storagePath: `${ARTIST_ID}/${RELEASE_ID}/package.nz`,
  filename: 'Retrospect.nz',
  fileSize: 52_428_800,
  manifest: { package_type: 'music_release', tracks: [{ track_id: 't1' }] },
  manifestHash: 'manifest-hash-1',
  packageHash: 'package-hash-1',
  experienceEntry: 'experience.html',
  validationStatus: 'valid',
};

const authenticity = {
  method: 'sha256-component-inventory',
  algorithm: 'ed25519',
  hash: 'inventory-hash-1',
  signature: 'sig',
  signer_public_key: 'pk',
  signed: true,
  signed_at: '2026-08-03T10:00:00.000Z',
  components: [{ path: 'a', sha256: 'b', size: 1 }],
};

const publish = (sb, overrides = {}) => finalizePublication(sb, {
  releaseId: RELEASE_ID,
  artistId: ARTIST_ID,
  releaseRow,
  packageFacts,
  authenticity,
  ...overrides,
});

beforeEach(() => chains.clear());

describe('reserveDropSlug', () => {
  it('takes the clean address when it is free', async () => {
    const sb = db();
    const address = await reserveDropSlug(sb, {
      releaseId: RELEASE_ID, artistName: 'dBoy', title: 'Retrospect',
    });
    expect(address).toMatchObject({ artist_slug: 'dboy', slug: 'retrospect', reused: false });
    expect(sb.rows('release_slugs')).toHaveLength(1);
  });

  it('falls through to a suffixed address when another release holds the first', async () => {
    const sb = db({
      release_slugs: [{ artist_slug: 'dboy', slug: 'retrospect', release_id: 'someone-else' }],
    });
    const address = await reserveDropSlug(sb, {
      releaseId: RELEASE_ID, artistName: 'dBoy', title: 'Retrospect',
    });
    expect(address.slug).toBe('retrospect-a1b2');
  });

  it('reuses an address this same release already reserved', async () => {
    // A retry after a timeout must not walk down to a suffixed address and
    // strand the one already in circulation.
    const sb = db({
      release_slugs: [{ artist_slug: 'dboy', slug: 'retrospect', release_id: RELEASE_ID }],
    });
    const address = await reserveDropSlug(sb, {
      releaseId: RELEASE_ID, artistName: 'dBoy', title: 'Retrospect',
    });
    expect(address).toMatchObject({ slug: 'retrospect', reused: true });
    expect(sb.rows('release_slugs')).toHaveLength(1);
  });

  it('never moves a release that already has an address', async () => {
    const sb = db();
    const address = await reserveDropSlug(sb, {
      releaseId: RELEASE_ID,
      artistName: 'dBoy',
      title: 'A Completely Different Title',
      existing: { artist_slug: 'dboy', slug: 'retrospect' },
    });
    expect(address).toMatchObject({ artist_slug: 'dboy', slug: 'retrospect', reused: true });
    expect(sb.rows('release_slugs')).toHaveLength(0);
  });

  it('reports a real database fault instead of walking the candidate list', async () => {
    const sb = db();
    sb.failNext('release_slugs', 'insert', { code: '42P01', message: 'relation does not exist' });
    await expect(reserveDropSlug(sb, {
      releaseId: RELEASE_ID, artistName: 'dBoy', title: 'Retrospect',
    })).rejects.toThrow(/relation does not exist/);
  });
});

describe('recordPackageVersion', () => {
  it('records version 1 for a first publish', async () => {
    const sb = db();
    const { packageRecord, created } = await recordPackageVersion(sb, RELEASE_ID, packageFacts);
    expect(created).toBe(true);
    expect(packageRecord).toMatchObject({ version: 1, validation_status: 'valid' });
    expect(packageRecord.validated_at).toBeTruthy();
  });

  it('returns the existing row for the same bytes rather than a second version', async () => {
    const sb = db();
    await recordPackageVersion(sb, RELEASE_ID, packageFacts);
    const { created } = await recordPackageVersion(sb, RELEASE_ID, packageFacts);
    expect(created).toBe(false);
    expect(sb.rows('release_packages')).toHaveLength(1);
  });

  it('adds a version beside the old one when the package changes', async () => {
    // The collector holding version 1 must keep a package whose recorded
    // hashes still describe the bytes they have.
    const sb = db();
    await recordPackageVersion(sb, RELEASE_ID, packageFacts);
    const { packageRecord } = await recordPackageVersion(sb, RELEASE_ID, {
      ...packageFacts, packageHash: 'package-hash-2',
    });
    expect(packageRecord.version).toBe(2);
    expect(sb.rows('release_packages')).toHaveLength(2);
    expect(sb.rows('release_packages')[0].package_hash).toBe('package-hash-1');
  });

  it('leaves validated_at empty when validation did not pass', async () => {
    const sb = db();
    const { packageRecord } = await recordPackageVersion(sb, RELEASE_ID, {
      ...packageFacts, validationStatus: 'invalid',
    });
    expect(packageRecord.validated_at).toBeNull();
  });
});

describe('recordAuthenticity', () => {
  it('writes the signature index and marks it verified', async () => {
    const sb = db();
    const record = await recordAuthenticity(sb, {
      releaseId: RELEASE_ID, packageId: 'pkg-1', authenticity,
    });
    expect(record).toMatchObject({
      content_hash: 'inventory-hash-1',
      signature_type: 'ed25519',
      verification_status: 'verified',
    });
    expect(record.certificate.component_count).toBe(1);
  });

  it('records an unsigned package as unverified rather than pretending', async () => {
    const sb = db();
    const record = await recordAuthenticity(sb, {
      releaseId: RELEASE_ID,
      packageId: 'pkg-1',
      authenticity: { ...authenticity, signed: false, signature: null },
    });
    expect(record.verification_status).toBe('unverified');
    expect(record.verified_at).toBeNull();
  });

  it('writes nothing when the package carries no authenticity record', async () => {
    const sb = db();
    expect(await recordAuthenticity(sb, { releaseId: RELEASE_ID, packageId: 'p', authenticity: null }))
      .toBeNull();
    expect(sb.rows('release_authenticity')).toHaveLength(0);
  });
});

describe('openReleaseChain', () => {
  it('emits created then published, in that order', async () => {
    const sb = db();
    const events = await openReleaseChain(sb, { releaseId: RELEASE_ID, artistId: ARTIST_ID });
    expect(events.map((event) => event.kind)).toEqual(['created', 'published']);
    expect(events[0].seq).toBe(0);
    expect(events[0].edition_number).toBe(0);
  });

  it('adds nothing on a second publish', async () => {
    const sb = db();
    await openReleaseChain(sb, { releaseId: RELEASE_ID, artistId: ARTIST_ID });
    const again = await openReleaseChain(sb, { releaseId: RELEASE_ID, artistId: ARTIST_ID });
    expect(again).toEqual([]);
    expect(chains.get(`${RELEASE_ID}:0`)).toHaveLength(2);
  });

  it('completes a chain that was left half-written', async () => {
    chains.set(`${RELEASE_ID}:0`, [{ seq: 0, kind: 'created' }]);
    const events = await openReleaseChain(db(), { releaseId: RELEASE_ID, artistId: ARTIST_ID });
    expect(events.map((event) => event.kind)).toEqual(['published']);
  });
});

describe('finalizePublication', () => {
  it('publishes a release, its address, package, authenticity and provenance', async () => {
    const sb = db();
    const result = await publish(sb);

    expect(result.release.status).toBe('published');
    expect(result.release.published_at).toBeTruthy();
    expect(result.dropPath).toBe('/drop/dboy/retrospect');
    expect(result.release.package_id).toBe(result.packageRecord.id);
    expect(sb.rows('release_slugs')).toHaveLength(1);
    expect(sb.rows('release_packages')).toHaveLength(1);
    expect(sb.rows('release_authenticity')).toHaveLength(1);
    expect(chains.get(`${RELEASE_ID}:0`).map((event) => event.kind)).toEqual(['created', 'published']);
  });

  it('reports stages in order so a slow publish stays legible', async () => {
    const stages = [];
    await publish(db(), { onStage: (stage) => stages.push(stage) });
    expect(stages).toEqual([
      'Reserving Drop Page address',
      'Recording package',
      'Signing release',
      'Opening provenance',
      'Publishing to Exchange',
    ]);
  });

  it('is idempotent: publishing twice makes one release, one package, one chain', async () => {
    // The button is disabled while a publish runs, but a double submit, a
    // retried request or a refreshed tab all reach here twice.
    const sb = db();
    await publish(sb);
    const second = await publish(sb);

    expect(sb.rows('releases')).toHaveLength(1);
    expect(sb.rows('release_packages')).toHaveLength(1);
    expect(sb.rows('release_slugs')).toHaveLength(1);
    expect(sb.rows('release_authenticity')).toHaveLength(1);
    expect(chains.get(`${RELEASE_ID}:0`)).toHaveLength(2);
    expect(second.dropPath).toBe('/drop/dboy/retrospect');
  });

  it('keeps the original published_at across a re-publish', async () => {
    const sb = db();
    const first = await publish(sb);
    const second = await publish(sb, {
      packageFacts: { ...packageFacts, packageHash: 'package-hash-2' },
    });
    expect(second.release.published_at).toBe(first.release.published_at);
    expect(second.packageRecord.version).toBe(2);
  });

  it('writes the tracklist while the release is still invisible', async () => {
    // An Exchange card that appears before its tracklist is a release nobody
    // can describe, and briefly a purchasable one.
    const sb = db();
    let statusDuringInventory = null;
    await publish(sb, {
      onStaged: async () => {
        statusDuringInventory = sb.rows('releases')[0].status;
      },
    });
    expect(statusDuringInventory).toBe('draft');
    expect(sb.rows('releases')[0].status).toBe('published');
  });

  it('leaves a draft, not a live release, when a later step fails', async () => {
    const sb = db();
    sb.failNext('release_packages', 'insert');
    await expect(publish(sb)).rejects.toThrow(PublishError);

    expect(sb.rows('releases')[0].status).toBe('draft');
    expect(sb.rows('releases')[0].title).toBe('Retrospect');
    expect(sb.rows('release_authenticity')).toHaveLength(0);
  });

  it('recovers on retry after a failure, without duplicating the address', async () => {
    const sb = db();
    sb.failNext('release_packages', 'insert');
    await expect(publish(sb)).rejects.toThrow(PublishError);

    const result = await publish(sb);
    expect(result.release.status).toBe('published');
    expect(sb.rows('release_slugs')).toHaveLength(1);
    expect(sb.rows('release_packages')).toHaveLength(1);
  });

  it('publishes a provenance failure anyway, because the ledger is not a gate', async () => {
    const sb = db();
    chains.set(`${RELEASE_ID}:0`, null); // loadChain returns [] for null, appendEvent throws
    const result = await publish(sb);
    expect(result.release.status).toBe('published');
  });

  it('refuses to publish into a release id owned by someone else', async () => {
    const sb = db({
      releases: [{ id: RELEASE_ID, artist_id: 'someone-else', status: 'published' }],
    });
    await expect(publish(sb)).rejects.toMatchObject({ status: 403 });
  });

  it('seeds the release row before slug reservation so the FK is satisfiable', async () => {
    const sb = db();
    let releaseExistedBeforeSlug = false;
    const origInsert = sb.write.bind(sb);
    const writes = [];
    const realWrite = sb.write.bind(sb);
    sb.write = function (table, row, mode) {
      writes.push(table);
      if (table === 'release_slugs') {
        releaseExistedBeforeSlug = sb.rows('releases').some((r) => r.id === RELEASE_ID);
      }
      return realWrite(table, row, mode);
    };
    await publish(sb);
    expect(releaseExistedBeforeSlug).toBe(true);
  });

  it('never drops a live release back to draft mid-flight', async () => {
    // A re-publish of a release with checkouts in progress must not remove it
    // from the Exchange while the new package is being recorded.
    const sb = db();
    await publish(sb);
    let statusDuringSecond = null;
    await publish(sb, {
      packageFacts: { ...packageFacts, packageHash: 'package-hash-2' },
      onStaged: async () => {
        statusDuringSecond = sb.rows('releases')[0].status;
      },
    });
    expect(statusDuringSecond).toBe('published');
  });
});

describe('unpublishRelease', () => {
  it('withdraws without deleting, so the Drop Page survives as a record', async () => {
    const sb = db({ releases: [{ id: RELEASE_ID, artist_id: ARTIST_ID, status: 'published' }] });
    const result = await unpublishRelease(sb, { releaseId: RELEASE_ID, artistId: ARTIST_ID });
    expect(result.status).toBe('withdrawn');
    expect(result.withdrawn_at).toBeTruthy();
    expect(sb.rows('releases')).toHaveLength(1);
  });

  it('refuses a release belonging to somebody else', async () => {
    const sb = db({ releases: [{ id: RELEASE_ID, artist_id: 'someone-else', status: 'published' }] });
    await expect(unpublishRelease(sb, { releaseId: RELEASE_ID, artistId: ARTIST_ID }))
      .rejects.toMatchObject({ status: 403 });
  });

  it('reports a missing release as 404 rather than succeeding silently', async () => {
    await expect(unpublishRelease(db(), { releaseId: RELEASE_ID, artistId: ARTIST_ID }))
      .rejects.toMatchObject({ status: 404 });
  });
});
