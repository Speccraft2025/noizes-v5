/**
 * Turning a compiled .nz into a published release with a Drop Page.
 *
 * Publishing touches seven records across five tables. Postgres transactions
 * are not available through PostgREST, so integrity here is structural rather
 * than transactional:
 *
 *   1. The release row is written FIRST, but not as 'published'. Nothing is
 *      publicly visible until the last step flips the status, so a failure
 *      halfway through leaves an invisible draft rather than a release on the
 *      Exchange with no package behind it.
 *   2. Every step is idempotent and keyed on something stable — the release
 *      id, the package hash, the provenance seq. Clicking Publish twice, or a
 *      retry after a network timeout, converges on one release, one package
 *      version, one chain.
 *   3. The slug is reserved through a unique constraint, not a "does it exist"
 *      check, so two creators publishing the same title at the same moment
 *      cannot both win the address.
 *
 * A re-publish of an already-live release never passes back through 'draft':
 * pulling a release off the Exchange mid-flight would break checkouts that are
 * already in progress.
 */

import { dropSlugCandidates, dropPath } from '$lib/domain/drop-slug.js';
import { RELEASE_CHAIN_EDITION, appendEvent, loadChain } from './provenance.js';

/** Stage labels, surfaced to the creator so a slow publish is legible. */
export const PUBLISH_STAGES = Object.freeze([
  'Validating package',
  'Reserving Drop Page address',
  'Recording package',
  'Signing release',
  'Opening provenance',
  'Publishing to Exchange',
]);

export class PublishError extends Error {
  constructor(message, { status = 500, stage = null } = {}) {
    super(message);
    this.name = 'PublishError';
    this.status = status;
    this.stage = stage;
  }
}

/**
 * Reserve a permanent Drop Page address for a release.
 *
 * Returns the existing address unchanged when the release already has one: a
 * published URL is a promise, and a re-publish that quietly moved the page
 * would break every link already in circulation.
 */
export async function reserveDropSlug(sb, { releaseId, artistName, title, existing = null }) {
  if (existing?.artist_slug && existing?.slug) {
    return { artist_slug: existing.artist_slug, slug: existing.slug, reused: true };
  }

  for (const candidate of dropSlugCandidates({ artistName, title, releaseId })) {
    const { error } = await sb.from('release_slugs').insert({
      artist_slug: candidate.artist_slug,
      slug: candidate.slug,
      release_id: releaseId,
      is_canonical: true,
    });
    if (!error) return { ...candidate, reused: false };

    // A duplicate key is the expected outcome of a collision, and the whole
    // point of letting the database arbitrate. Anything else is a real fault.
    const duplicate = String(error.code) === '23505' || /duplicate key/i.test(error.message || '');
    if (!duplicate) {
      throw new PublishError(`Could not reserve a Drop Page address: ${error.message}`, {
        stage: 'Reserving Drop Page address',
      });
    }

    // The address may already belong to THIS release from an earlier attempt.
    const { data: owner } = await sb
      .from('release_slugs')
      .select('release_id')
      .eq('artist_slug', candidate.artist_slug)
      .eq('slug', candidate.slug)
      .maybeSingle();
    if (owner?.release_id === releaseId) return { ...candidate, reused: true };
  }

  throw new PublishError('Could not reserve a Drop Page address after exhausting every candidate.', {
    stage: 'Reserving Drop Page address',
  });
}

/**
 * Record the published package as a new immutable version, or return the
 * existing row when this exact package has already been recorded.
 *
 * Versions are never overwritten. A creator who publishes a revision after
 * copies have been acquired gets version 2 beside version 1; the collector who
 * holds a copy of version 1 keeps a package whose hashes still describe it.
 */
export async function recordPackageVersion(sb, releaseId, facts) {
  if (facts.packageHash) {
    const { data: prior } = await sb
      .from('release_packages')
      .select('*')
      .eq('release_id', releaseId)
      .eq('package_hash', facts.packageHash)
      .maybeSingle();
    if (prior) return { packageRecord: prior, created: false };
  }

  const { data: latest } = await sb
    .from('release_packages')
    .select('version')
    .eq('release_id', releaseId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (latest?.version ?? 0) + 1;
  const { data, error } = await sb
    .from('release_packages')
    .insert({
      release_id: releaseId,
      version,
      storage_path: facts.storagePath,
      filename: facts.filename ?? null,
      file_size: facts.fileSize ?? 0,
      manifest_json: facts.manifest ?? {},
      manifest_hash: facts.manifestHash ?? null,
      package_hash: facts.packageHash ?? null,
      package_version: facts.packageVersion ?? null,
      experience_entry: facts.experienceEntry || 'experience.html',
      experience_summary: facts.experienceSummary ?? {},
      validation_status: facts.validationStatus || 'unvalidated',
      validated_at: facts.validationStatus === 'valid' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    throw new PublishError(`Could not record the package: ${error.message}`, { stage: 'Recording package' });
  }
  return { packageRecord: data, created: true };
}

/**
 * Lift the package's signed authenticity record into the database so the Drop
 * Page can show certificate state without downloading the .nz.
 *
 * This is an index of an attestation, never the attestation itself: the
 * signature that matters travels inside authenticity.json in the package, and
 * a verifier checks that copy, not this one.
 */
export async function recordAuthenticity(sb, { releaseId, packageId, authenticity }) {
  if (!authenticity?.hash) return null;

  const row = {
    release_id: releaseId,
    package_id: packageId,
    signature_type: authenticity.algorithm || 'ed25519',
    method: authenticity.method || 'sha256-component-inventory',
    content_hash: authenticity.hash,
    signature: authenticity.signature ?? null,
    signer_public_key: authenticity.signer_public_key ?? null,
    certificate: {
      signed_at: authenticity.signed_at ?? null,
      component_count: Array.isArray(authenticity.components) ? authenticity.components.length : 0,
    },
    verification_status: authenticity.signed ? 'verified' : 'unverified',
    verified_at: authenticity.signed ? (authenticity.signed_at ?? new Date().toISOString()) : null,
  };

  const { data, error } = await sb
    .from('release_authenticity')
    .upsert(row, { onConflict: 'package_id' })
    .select()
    .single();

  if (error) {
    throw new PublishError(`Could not record authenticity: ${error.message}`, { stage: 'Signing release' });
  }
  return data;
}

/**
 * Open the release's own provenance chain: 'created' by the artist, then
 * 'published'. Copy chains are opened separately at first sale.
 *
 * Best-effort by design. Provenance is a record OF a publication, not a
 * precondition FOR one — failing the publish because the ledger was briefly
 * unavailable would be the tail wagging the dog. Re-entrant: a second publish
 * finds the events already there and adds nothing.
 */
export async function openReleaseChain(sb, { releaseId, artistId, occurredAt = null }) {
  const chain = await loadChain(sb, releaseId, RELEASE_CHAIN_EDITION);
  const kinds = new Set(chain.map((event) => event.kind));
  const emitted = [];

  if (!kinds.has('created')) {
    emitted.push(await appendEvent(sb, {
      releaseId,
      editionNumber: RELEASE_CHAIN_EDITION,
      kind: 'created',
      toOwnerId: artistId ?? null,
      occurredAt,
    }));
  }
  if (!kinds.has('published')) {
    emitted.push(await appendEvent(sb, {
      releaseId,
      editionNumber: RELEASE_CHAIN_EDITION,
      kind: 'published',
      fromOwnerId: artistId ?? null,
      toOwnerId: artistId ?? null,
    }));
  }
  return emitted;
}

/**
 * Finalize a publication.
 *
 * @param {object} sb        service-role Supabase client
 * @param {object} input
 * @param {string} input.releaseId
 * @param {string} input.artistId
 * @param {object} input.releaseRow   columns to write on public.releases
 * @param {object} input.packageFacts see recordPackageVersion
 * @param {object} [input.authenticity] parsed authenticity.json
 * @param {(release: object) => Promise<void>} [input.onStaged] runs once the
 *   release row exists but before it becomes visible — where the normalized
 *   tracklist and audio inventory are written, since those need the row's
 *   foreign key but must be complete before anybody can see the release
 * @param {(stage: string) => void} [input.onStage]
 * @returns {Promise<{release: object, packageRecord: object, dropPath: string, provenance: object[]}>}
 */
export async function finalizePublication(sb, {
  releaseId,
  artistId,
  releaseRow,
  packageFacts,
  authenticity = null,
  onStaged = null,
  onStage = () => {},
}) {
  const { data: existing } = await sb
    .from('releases')
    .select('id, artist_id, status, slug, artist_slug, published_at')
    .eq('id', releaseId)
    .maybeSingle();

  // Publishing into someone else's release id must be impossible even if the
  // caller reached this function with a forged id.
  if (existing && existing.artist_id && existing.artist_id !== artistId) {
    throw new PublishError('This release belongs to another creator.', { status: 403 });
  }

  const alreadyLive = existing?.status === 'published';

  // For a first publish the release row does not exist yet. Seed a minimal
  // draft so the release_slugs FK (release_id → releases.id) is satisfiable.
  // The full upsert after slug reservation overwrites every column.
  if (!existing) {
    const { error: seedErr } = await sb.from('releases').insert({
      id: releaseId,
      artist_id: artistId,
      artist_name: releaseRow.artist_name ?? '',
      title: releaseRow.title ?? '',
      status: 'draft',
    });
    if (seedErr && String(seedErr.code) !== '23505') {
      throw new PublishError(`Could not initialize the release: ${seedErr.message}`, {
        stage: 'Validating package',
      });
    }
  }

  onStage('Reserving Drop Page address');
  const address = await reserveDropSlug(sb, {
    releaseId,
    artistName: releaseRow.artist_name,
    title: releaseRow.title,
    existing,
  });

  // Written as a draft on a first publish: the Exchange and the Drop Page both
  // filter on status, so nothing is reachable until the final flip below.
  const { data: staged, error: stageErr } = await sb
    .from('releases')
    .upsert({
      ...releaseRow,
      id: releaseId,
      artist_id: artistId,
      artist_slug: address.artist_slug,
      slug: address.slug,
      status: alreadyLive ? 'published' : 'draft',
    }, { onConflict: 'id' })
    .select()
    .single();
  if (stageErr) {
    throw new PublishError(`Could not save the release: ${stageErr.message}`, { stage: 'Validating package' });
  }

  if (onStaged) await onStaged(staged);

  onStage('Recording package');
  const { packageRecord } = await recordPackageVersion(sb, releaseId, packageFacts);

  onStage('Signing release');
  await recordAuthenticity(sb, { releaseId, packageId: packageRecord.id, authenticity });

  onStage('Opening provenance');
  let provenance = [];
  try {
    provenance = await openReleaseChain(sb, { releaseId, artistId, occurredAt: staged.created_at });
  } catch (cause) {
    console.error(`[publish] provenance chain failed for ${releaseId}: ${cause.message}`);
  }

  onStage('Publishing to Exchange');
  const { data: published, error: publishErr } = await sb
    .from('releases')
    .update({
      status: 'published',
      published_at: existing?.published_at ?? new Date().toISOString(),
      withdrawn_at: null,
      package_id: packageRecord.id,
      experience_entry: packageRecord.experience_entry,
    })
    .eq('id', releaseId)
    .select()
    .single();
  if (publishErr) {
    throw new PublishError(`Could not publish the release: ${publishErr.message}`, { stage: 'Publishing to Exchange' });
  }

  return {
    release: published,
    packageRecord,
    provenance,
    dropPath: dropPath(address.artist_slug, address.slug),
  };
}

/**
 * Take a release off the Exchange without erasing it. The Drop Page survives
 * as an archive record and copies already held are untouched — withdrawing a
 * release is a decision about future sales, not a revocation of what people
 * already own.
 */
export async function unpublishRelease(sb, { releaseId, artistId }) {
  const { data: release } = await sb
    .from('releases')
    .select('id, artist_id, status')
    .eq('id', releaseId)
    .maybeSingle();
  if (!release) throw new PublishError('Release not found', { status: 404 });
  if (release.artist_id !== artistId) throw new PublishError('Not your release', { status: 403 });

  const { data, error } = await sb
    .from('releases')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('id', releaseId)
    .select()
    .single();
  if (error) throw new PublishError(`Could not withdraw the release: ${error.message}`);
  return data;
}
