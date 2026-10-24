import { createHash, createHmac } from 'node:crypto';

const DAY_MS = 24 * 60 * 60 * 1000;
const FRESHNESS_BOOST_MAX = 0.04;
const EXPOSURE_BOOST_MAX = 0.04;
const EXPOSURE_TARGET = 5;

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function compactIso(date) {
  const iso = date.toISOString();
  return [iso.slice(0, 4), iso.slice(5, 7), iso.slice(8, 10), iso.slice(11, 13), iso.slice(14, 16), iso.slice(17, 19), iso.slice(20, 23)].join('');
}

export function exchangeRotationWindow(now = new Date(), configuredHours = 4) {
  const hours = Math.max(1, Math.min(24, Number.parseInt(configuredHours, 10) || 4));
  const duration = hours * 60 * 60 * 1000;
  const startMs = Math.floor(new Date(now).getTime() / duration) * duration;
  const start = new Date(startMs);
  const end = new Date(startMs + duration);
  return {
    hours,
    id: `${hours}-${compactIso(start)}`,
    start,
    end,
  };
}

export function isEligibleExchangeRelease(release) {
  return Boolean(
    release &&
    release.status === 'published' &&
    release.visibility === 'public' &&
    !release.withdrawn_at &&
    release.slug &&
    release.artist_slug &&
    String(release.title ?? '').trim() &&
    String(release.artist_name ?? '').trim()
  );
}

export function exchangeCatalogueVersion(releases) {
  const catalogue = releases
    .map((release) => [release.id, release.artist_id ?? release.artist_name, release.published_at ?? ''].join(':'))
    .sort()
    .join('|');
  return createHash('sha256').update(catalogue).digest('hex');
}

function hashUnit(secret, windowId, catalogueVersion, releaseId) {
  const digest = createHmac('sha256', secret)
    .update(`${windowId}:${catalogueVersion}:${releaseId}`)
    .digest('hex');
  return Number.parseInt(digest.slice(0, 13), 16) / 0x10000000000000;
}

function boundedBoosts(release, impressions, windowStart) {
  const published = asDate(release.published_at ?? release.created_at);
  const age = published ? Math.max(0, windowStart.getTime() - published.getTime()) : DAY_MS * 7;
  const freshness = FRESHNESS_BOOST_MAX * Math.max(0, 1 - age / (DAY_MS * 7));
  const count = Math.max(0, Number(impressions) || 0);
  const lowExposure = EXPOSURE_BOOST_MAX * (1 - Math.min(count / EXPOSURE_TARGET, 1));
  return { freshness, lowExposure };
}

export function exchangeRotationScore(release, {
  secret,
  windowId,
  catalogueVersion,
  windowStart,
  recentImpressions = 0,
}) {
  if (!secret) throw new Error('Exchange Rotation requires a server-side secret.');
  const start = asDate(windowStart) ?? new Date(0);
  const boosts = boundedBoosts(release, recentImpressions, start);
  return hashUnit(secret, windowId, catalogueVersion, release.id) - boosts.freshness - boosts.lowExposure;
}

export function createExchangeRotation(releases, {
  secret,
  windowId,
  windowStart,
  recentImpressions = {},
  previousFirstReleaseId = null,
}) {
  const eligible = releases.filter(isEligibleExchangeRelease);
  if (!eligible.length) return [];
  if (!secret) throw new Error('Exchange Rotation requires a server-side secret.');

  const catalogueVersion = exchangeCatalogueVersion(eligible);
  const ranked = eligible.map((release) => ({
    release,
    score: exchangeRotationScore(release, {
      secret,
      windowId,
      catalogueVersion,
      windowStart,
      recentImpressions: recentImpressions[release.id] ?? 0,
    }),
    artistKey: String(release.artist_id ?? release.artist_name).trim().toLocaleLowerCase(),
  })).sort((a, b) => a.score - b.score || String(a.release.id).localeCompare(String(b.release.id)));

  const order = [];
  let previousArtist = null;
  while (ranked.length) {
    let pick = ranked.findIndex((candidate) => candidate.artistKey !== previousArtist);
    if (pick < 0) pick = 0;

    if (order.length === 0 && ranked.length > 1 && ranked[pick].release.id === previousFirstReleaseId) {
      const alternate = ranked.findIndex((candidate) => candidate.release.id !== previousFirstReleaseId && candidate.artistKey !== previousArtist);
      pick = alternate >= 0 ? alternate : ranked.findIndex((candidate) => candidate.release.id !== previousFirstReleaseId);
    }

    const [chosen] = ranked.splice(pick, 1);
    order.push(chosen.release.id);
    previousArtist = chosen.artistKey;
  }
  return order;
}

function searchRelevance(release, query) {
  const title = String(release.title ?? '').toLocaleLowerCase();
  const artist = String(release.artist_name ?? '').toLocaleLowerCase();
  const edition = String(release.edition_name ?? release.edition_type ?? '').toLocaleLowerCase();
  const metadata = String(release.search_metadata ?? '').toLocaleLowerCase();
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  if (artist === query) return 3;
  if (artist.startsWith(query)) return 4;
  if (artist.includes(query)) return 5;
  if (edition === query) return 6;
  if (edition.includes(query)) return 7;
  return metadata.includes(query) ? 8 : null;
}

export function searchExchangeReleases(releases, query) {
  const normalized = String(query ?? '').trim().toLocaleLowerCase();
  if (!normalized) return releases;

  return releases
    .map((release) => ({ release, relevance: searchRelevance(release, normalized) }))
    .filter((entry) => entry.relevance !== null)
    .sort((a, b) => {
      if (a.relevance !== b.relevance) return a.relevance - b.relevance;
      const aDate = asDate(a.release.published_at ?? a.release.created_at)?.getTime() ?? 0;
      const bDate = asDate(b.release.published_at ?? b.release.created_at)?.getTime() ?? 0;
      return bDate - aDate || String(a.release.title).localeCompare(String(b.release.title));
    })
    .map(({ release }) => release);
}

export function paginateExchangeReleases(releases, requestedPage = 1, pageSize = 24) {
  const size = Math.max(1, Number.parseInt(pageSize, 10) || 24);
  const pages = Math.max(1, Math.ceil(releases.length / size));
  const page = Math.max(1, Math.min(pages, Number.parseInt(requestedPage, 10) || 1));
  return {
    items: releases.slice((page - 1) * size, page * size),
    page,
    pages,
    total: releases.length,
  };
}
