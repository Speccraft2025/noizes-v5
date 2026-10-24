import { createHmac, randomUUID } from 'node:crypto';

import {
  EXCHANGE_ROTATION_HOURS,
  EXCHANGE_ROTATION_SECRET,
  SUPABASE_SERVICE_ROLE_KEY
} from '$app/env/private';

import { getSupabaseServiceRoleClient } from '#lib/server/supabase.js';
import {
  createExchangeRotation,
  exchangeCatalogueVersion,
  exchangeRotationWindow,
  isEligibleExchangeRelease,
  paginateExchangeReleases,
  searchExchangeReleases,
} from '#lib/domain/exchange-rotation.js';

const PAGE_SIZE = 20;
const PAGE_FETCH_SIZE = 1000;
const MAX_CATALOGUE_SIZE = 50000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const VISITOR_COOKIE = 'noizes_exchange_window';

function rotationSettings(now) {
  const configuredHours = Number.parseInt(EXCHANGE_ROTATION_HOURS ?? '4', 10) || 4;
  const window = exchangeRotationWindow(now, configuredHours);
  const secret = EXCHANGE_ROTATION_SECRET || SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Exchange Rotation requires a server-side secret.');
  return { window, secret };
}

function visitorCookie(event, window) {
  const cookieValue = event.cookies.get(VISITOR_COOKIE);
  const prefix = `${window.id}.`;
  const token = cookieValue?.startsWith(prefix) ? cookieValue : `${prefix}${randomUUID()}`;
  if (token !== cookieValue) {
    event.cookies.set(VISITOR_COOKIE, token, {
      path: '/exchange',
      httpOnly: true,
      secure: event.url.protocol === 'https:',
      sameSite: 'lax',
      maxAge: Math.max(60, Math.ceil((window.end.getTime() - Date.now()) / 1000)),
    });
  }
  return token;
}

function visitorHash(token, secret) {
  return createHmac('sha256', secret).update(token).digest('hex');
}

async function fetchEligibleReleases(admin) {
  const fields = [
    'id', 'artist_id', 'artist_name', 'title', 'description', 'drop_description',
    'genre', 'genres', 'label', 'catalogue_number', 'release_type', 'year',
    'location', 'track_count', 'edition_type', 'edition_name', 'edition_size',
    'price', 'currency', 'acquired_count', 'cover_path', 'slug', 'artist_slug',
    'status', 'visibility', 'withdrawn_at', 'created_at', 'published_at',
  ].join(', ');
  const releases = [];

  for (let offset = 0; offset < MAX_CATALOGUE_SIZE; offset += PAGE_FETCH_SIZE) {
    const { data, error } = await admin
      .from('releases')
      .select(fields)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .is('withdrawn_at', null)
      .not('slug', 'is', null)
      .not('artist_slug', 'is', null)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_FETCH_SIZE - 1);

    if (error) return { releases: [], error };
    const batch = data ?? [];
    releases.push(...batch.filter(isEligibleExchangeRelease));
    if (batch.length < PAGE_FETCH_SIZE) return { releases, error: null };
  }

  return { releases, error: { code: 'EXCHANGE_CATALOGUE_LIMIT', message: 'Catalogue exceeded the safe page size.' } };
}

function mapCounts(rows) {
  return Object.fromEntries((rows ?? []).map((row) => [row.release_id, Number(row.appreciation_count ?? row.impression_count ?? 0)]));
}

async function readRotationSnapshot(admin, releases, window, secret) {
  const catalogueVersion = exchangeCatalogueVersion(releases);
  const { data: existing, error: readError } = await admin
    .from('exchange_rotation_snapshots')
    .select('window_id, catalogue_version, release_ids')
    .eq('window_id', window.id)
    .maybeSingle();
  if (readError) return { releaseIds: null, error: readError };
  if (existing?.catalogue_version === catalogueVersion) {
    return { releaseIds: existing.release_ids ?? [], error: null };
  }

  const previousWindow = exchangeRotationWindow(new Date(window.start.getTime() - 1), window.hours);
  const [{ data: previous }, { data: exposureRows, error: exposureError }] = await Promise.all([
    admin.from('exchange_rotation_snapshots')
      .select('release_ids').eq('window_id', previousWindow.id).maybeSingle(),
    admin.rpc('exchange_recent_impression_counts', {
      p_since: new Date(window.start.getTime() - WEEK_MS).toISOString(),
      p_before: window.start.toISOString(),
    }),
  ]);
  const recentImpressions = Object.fromEntries((exposureRows ?? []).map((row) => [row.release_id, Number(row.impression_count ?? 0)]));
  const releaseIds = createExchangeRotation(releases, {
    secret,
    windowId: window.id,
    windowStart: window.start,
    recentImpressions,
    previousFirstReleaseId: previous?.release_ids?.[0] ?? null,
  });
  const snapshot = {
    window_id: window.id,
    catalogue_version: catalogueVersion,
    release_ids: releaseIds,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data: updated, error: updateError } = await admin
      .from('exchange_rotation_snapshots')
      .update(snapshot)
      .eq('window_id', window.id)
      .eq('catalogue_version', existing.catalogue_version)
      .select('release_ids')
      .maybeSingle();
    if (updateError) return { releaseIds, error: updateError };
    if (updated) return { releaseIds: updated.release_ids ?? [], error: exposureError };
  } else {
    const { data: inserted, error: insertError } = await admin
      .from('exchange_rotation_snapshots')
      .insert(snapshot)
      .select('release_ids')
      .maybeSingle();
    if (!insertError) return { releaseIds: inserted?.release_ids ?? [], error: exposureError };
    if (insertError.code !== '23505') return { releaseIds, error: insertError };
  }

  const { data: winner, error: winnerError } = await admin
    .from('exchange_rotation_snapshots')
    .select('catalogue_version, release_ids')
    .eq('window_id', window.id)
    .maybeSingle();
  if (winnerError || !winner) return { releaseIds, error: winnerError ?? exposureError };
  if (winner.catalogue_version === catalogueVersion) return { releaseIds: winner.release_ids ?? [], error: exposureError };
  return { releaseIds, error: exposureError };
}

function buildSearchMetadata(release) {
  return [
    release.genre,
    ...Array.isArray(release.genres) ? release.genres : [],
    release.label,
    release.catalogue_number,
    release.release_type,
    release.description,
    release.drop_description,
    release.year,
    release.location,
  ].filter(Boolean).join(' ');
}

export async function loadExchangePage(event) {
  const now = new Date();
  const admin = getSupabaseServiceRoleClient();
  const { window, secret } = rotationSettings(now);
  const token = visitorCookie(event, window);
  const query = String(event.url.searchParams.get('q') ?? '').trim().slice(0, 100);
  const requestedPage = Number.parseInt(event.url.searchParams.get('page') ?? '1', 10) || 1;
  const { releases, error: releaseError } = await fetchEligibleReleases(admin);
  if (releaseError) {
    console.error('[exchange] release listing failed:', releaseError);
    return {
      items: [], query, page: 1, pages: 1, total: 0,
      rotationWindowId: window.id, rotationStale: false,
      openMarket: event.url.searchParams.get('market') === 'open',
      appreciatedReleaseIds: [],
      loadError: {
        message: releaseError.code === 'EXCHANGE_CATALOGUE_LIMIT'
          ? 'This catalogue is larger than Exchange can load safely. Please try again later.'
          : 'The Exchange could not be loaded just now. This is a fault on our side, not an empty shelf.',
      },
    };
  }

  const { releaseIds, error: snapshotError } = await readRotationSnapshot(admin, releases, window, secret);
  const byId = new Map(releases.map((release) => [release.id, release]));
  const rotationOrder = (releaseIds ?? []).map((id) => byId.get(id)).filter(Boolean);
  // If the snapshot store is briefly unavailable, the protected HMAC order is
  // still deterministic for this window and catalogue version.
  const fallbackOrder = rotationOrder.length === releases.length
    ? rotationOrder
    : createExchangeRotation(releases, { secret, windowId: window.id, windowStart: window.start });
  const searchable = releases.map((release) => ({ ...release, search_metadata: buildSearchMetadata(release) }));
  const displayOrder = query ? searchExchangeReleases(searchable, query) : fallbackOrder;
  const pagination = paginateExchangeReleases(displayOrder, requestedPage, PAGE_SIZE);

  const pageIds = pagination.items.map((release) => release.id);
  const [{ data: countRows, error: countError }, userRows] = await Promise.all([
    pageIds.length
      ? admin.rpc('exchange_appreciation_counts', { p_release_ids: pageIds })
      : Promise.resolve({ data: [], error: null }),
    event.locals.user && pageIds.length
      ? admin.from('release_appreciations').select('release_id')
        .eq('user_id', event.locals.user.id).eq('appreciated', true).in('release_id', pageIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const countByRelease = mapCounts(countRows);
  const countErrorValue = countError ?? null;
  if (snapshotError) console.error('[exchange] rotation snapshot unavailable:', snapshotError);
  if (countErrorValue) console.error('[exchange] appreciation counts failed:', countErrorValue);
  if (userRows.error) console.error('[exchange] current appreciation state failed:', userRows.error);

  const items = pagination.items.map((release) => ({
    ...release,
    cover_url: release.cover_path
      ? admin.storage.from('releases').getPublicUrl(release.cover_path).data?.publicUrl ?? null
      : null,
    short_description: String(release.drop_description || release.description || 'A complete .nz cultural object.')
      .replace(/\s+/g, ' ').trim().slice(0, 160),
    availability: release.edition_size == null
      ? 'Available'
      : `${Math.max(0, release.edition_size - (release.acquired_count ?? 0))} available`,
    edition_summary: `${release.edition_name || release.edition_type || 'First Edition'} · ${release.edition_size == null ? 'Available' : `${Math.max(0, release.edition_size - (release.acquired_count ?? 0))} available`}`,
    appreciation_count: countErrorValue ? null : countByRelease[release.id] ?? 0,
  }));

  event.setHeaders({ 'cache-control': 'private, max-age=30, stale-while-revalidate=60' });
  return {
    items,
    query,
    page: pagination.page,
    pages: pagination.pages,
    total: pagination.total,
    rotationWindowId: window.id,
    rotationStale: Boolean(snapshotError),
    openMarket: event.url.searchParams.get('market') === 'open',
    signedIn: Boolean(event.locals.user),
    appreciatedReleaseIds: (userRows.data ?? []).map((row) => row.release_id),
    countError: Boolean(countErrorValue),
    loadError: null,
  };
}

export function getExchangeWindow(now = new Date()) {
  return rotationSettings(now);
}

export function makeExchangeVisitorHash(token, secret) {
  return visitorHash(token, secret);
}

export function getExchangeVisitorCookieName() {
  return VISITOR_COOKIE;
}
