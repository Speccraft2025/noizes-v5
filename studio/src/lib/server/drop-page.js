/**
 * Assembling a Drop Page.
 *
 * One query set, one view model, one place where the decision "is this viewer
 * allowed to see / open / download this" is made. Pages render what this
 * returns; they never re-derive entitlement, because a page that can compute
 * its own permissions is a page that can be argued out of them.
 *
 * Everything public here is safe for an anonymous visitor. Nothing in the
 * returned object identifies a collector unless that collector's own
 * provenance visibility allows it.
 */

import { isCanonicalAddress, dropPath } from '$lib/domain/drop-slug.js';
import { describePackageContents, describeExperienceSections, describeTrustIndicators } from '$lib/domain/drop-contents.js';
import { dropAvailability, canDownloadPackage, copiesAvailable } from '$lib/domain/drop-availability.js';
import { RELEASE_CHAIN_EDITION } from './provenance.js';

const RELEASE_COLUMNS = `
  id, artist_id, artist_name, title, slug, artist_slug, description, drop_description,
  genre, genres, year, location, release_type, release_date, catalogue_number, label,
  track_count, disc_count, total_duration_ms, featured_artists, compilation_artists,
  explicit, package_size, edition_type, edition_name, edition_size, price, currency,
  acquired_count, votes, cover_path, nz_path, status, visibility, published_at,
  withdrawn_at, allow_public_download, transferable, resale_enabled, offers_enabled,
  rights_summary, territory, upc, package_id, experience_entry, created_at
`;

/** Public-facing status labels for provenance kinds. */
const EVENT_LABELS = Object.freeze({
  created: 'Created',
  published: 'Published',
  acquired: 'Acquired',
  transferred: 'Transferred',
  note: 'Note added',
  verified: 'Verified',
  withdrawn: 'Withdrawn',
});

/**
 * Resolve a Drop Page address to a release, following slug history.
 *
 * Returns `{ release, redirectTo }` — a non-null redirectTo means the address
 * is a valid but superseded alias and the caller should send a 301. Old links
 * keep working forever; they just stop being the address people copy.
 */
export async function resolveDropAddress(sb, { artistSlug, slug }) {
  const { data: direct, error: directError } = await sb
    .from('releases')
    .select(RELEASE_COLUMNS)
    .eq('artist_slug', artistSlug)
    .eq('slug', slug)
    .maybeSingle();
  if (directError) throw directError;
  if (direct) return { release: direct, redirectTo: null };

  const { data: alias } = await sb
    .from('release_slugs')
    .select('release_id')
    .eq('artist_slug', artistSlug)
    .eq('slug', slug)
    .maybeSingle();
  if (!alias) return { release: null, redirectTo: null };

  const { data: release } = await sb
    .from('releases')
    .select(RELEASE_COLUMNS)
    .eq('id', alias.release_id)
    .maybeSingle();
  if (!release?.slug) return { release: null, redirectTo: null };

  return {
    release,
    redirectTo: isCanonicalAddress(release, artistSlug, slug)
      ? null
      : dropPath(release.artist_slug, release.slug),
  };
}

/**
 * Public timeline for the release's own chain.
 *
 * Copy-level history is deliberately excluded from the public page: who bought
 * number 12 is between them and the object. Only dates and event kinds appear
 * here, never names, never prices from private sales.
 */
function publicTimeline(events) {
  return (events ?? [])
    .filter((event) => event.edition_number === RELEASE_CHAIN_EDITION)
    .sort((a, b) => a.seq - b.seq)
    .map((event) => ({
      seq: event.seq,
      kind: event.kind,
      label: EVENT_LABELS[event.kind] || event.kind,
      date: event.occurred_at?.slice(0, 10) ?? null,
      content_hash: event.content_hash,
    }));
}

/**
 * How many copies have moved between collectors, as an aggregate. This is the
 * one thing a public page can honestly say about copy history without naming
 * anybody.
 */
function transferSummary(events) {
  const copies = (events ?? []).filter((event) => event.edition_number !== RELEASE_CHAIN_EDITION);
  return {
    acquisitions: copies.filter((event) => event.kind === 'acquired').length,
    transfers: copies.filter((event) => event.kind === 'transferred').length,
  };
}

function publicCoverUrl(sb, coverPath) {
  if (!coverPath) return null;
  const { data } = sb.storage.from('releases').getPublicUrl(coverPath);
  return data?.publicUrl ?? null;
}

/**
 * Build the complete Drop Page view model.
 *
 * @param {object} sb        service-role client (assembles public data that
 *                           RLS deliberately keeps private per-row, e.g. the
 *                           viewer's own acquisition)
 * @param {object} input
 * @param {string} input.artistSlug
 * @param {string} input.slug
 * @param {string|null} input.viewerId
 * @param {string} input.origin  absolute origin for canonical/share URLs
 */
export async function getDropPage(sb, { artistSlug, slug, viewerId = null, origin = '' }) {
  const { release, redirectTo } = await resolveDropAddress(sb, { artistSlug, slug });
  if (!release) return { found: false, release: null, redirectTo: null };
  if (redirectTo) return { found: true, redirectTo, release: null };

  const isCreator = Boolean(viewerId) && release.artist_id === viewerId;

  // A draft is visible to its creator alone. Everyone else gets the same
  // answer they would get for an id that does not exist — an unpublished
  // release should not be confirmable by a stranger.
  if (release.status === 'draft' && !isCreator) {
    return { found: false, release: null, redirectTo: null };
  }

  const [packageResult, authenticityResult, linksResult, eventsResult, ownershipResult] = await Promise.all([
    release.package_id
      ? sb.from('release_packages').select('*').eq('id', release.package_id).maybeSingle()
      : sb.from('release_packages').select('*').eq('release_id', release.id)
        .order('version', { ascending: false }).limit(1).maybeSingle(),
    sb.from('release_authenticity').select('*').eq('release_id', release.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('release_links').select('id, label, url, link_type, position')
      .eq('release_id', release.id).eq('enabled', true).order('position', { ascending: true }),
    sb.from('provenance_events').select('edition_number, seq, kind, occurred_at, content_hash')
      .eq('release_id', release.id).order('seq', { ascending: true }),
    viewerId
      ? sb.from('acquisitions').select('id, edition_number, acquired_at')
        .eq('release_id', release.id).eq('owner_id', viewerId)
        .order('acquired_at', { ascending: true }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Loaded only for the creator, and only ever as totals.
  let analytics = null;
  if (isCreator) {
    const { data: counters } = await sb
      .from('drop_analytics')
      .select('event, count')
      .eq('release_id', release.id);
    analytics = {};
    for (const row of counters ?? []) {
      analytics[row.event] = (analytics[row.event] ?? 0) + row.count;
    }
  }

  const packageRecord = packageResult?.data ?? null;
  const authenticity = authenticityResult?.data ?? null;
  const manifest = packageRecord?.manifest_json ?? {};
  const owned = Boolean(ownershipResult?.data);

  const availability = dropAvailability({ release, owned, isCreator });
  const download = canDownloadPackage({ release, owned, isCreator });

  const experienceSummary = packageRecord?.experience_summary ?? {};
  const lyricTrackCount = Number(experienceSummary.lyric_track_count) || 0;

  return {
    found: true,
    redirectTo: null,
    isCreator,
    owned,
    ownership: ownershipResult?.data ?? null,
    release: {
      ...release,
      cover_url: publicCoverUrl(sb, release.cover_path),
      copies_available: copiesAvailable(release),
    },
    package: packageRecord && {
      id: packageRecord.id,
      version: packageRecord.version,
      file_size: packageRecord.file_size,
      manifest_hash: packageRecord.manifest_hash,
      package_hash: packageRecord.package_hash,
      package_version: packageRecord.package_version,
      experience_entry: packageRecord.experience_entry,
      validation_status: packageRecord.validation_status,
      validated_at: packageRecord.validated_at,
    },
    authenticity: authenticity && {
      method: authenticity.method,
      signature_type: authenticity.signature_type,
      content_hash: authenticity.content_hash,
      signer_public_key: authenticity.signer_public_key,
      verification_status: authenticity.verification_status,
      verified_at: authenticity.verified_at,
      certificate: authenticity.certificate,
      signed: Boolean(authenticity.signature),
    },
    contents: describePackageContents(manifest, { lyricTrackCount }),
    sections: describeExperienceSections(manifest, experienceSummary),
    trust: describeTrustIndicators({ authenticity, release, packageRecord }),
    timeline: publicTimeline(eventsResult?.data),
    transfers: transferSummary(eventsResult?.data),
    links: linksResult?.data ?? [],
    analytics,
    availability,
    download,
    canonicalUrl: `${String(origin).replace(/\/+$/, '')}${dropPath(release.artist_slug, release.slug)}`,
  };
}

/**
 * Count a Drop Page event. Advisory: analytics must never be able to break the
 * page it measures, so every failure is swallowed after one console line.
 */
export async function bumpDropAnalytics(sb, releaseId, event) {
  try {
    const { error } = await sb.rpc('bump_drop_analytics', { p_release_id: releaseId, p_event: event });
    if (error) console.error(`[drop] analytics ${event} failed: ${error.message}`);
  } catch (cause) {
    console.error(`[drop] analytics ${event} threw: ${cause.message}`);
  }
}
