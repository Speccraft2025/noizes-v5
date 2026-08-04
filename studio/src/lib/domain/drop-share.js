/**
 * Sharing a Drop Page.
 *
 * The page exists to be pasted into a thread, so the shared artefact — the
 * URL, the preview card, the message body — is product surface, not an
 * afterthought. Two rules:
 *
 *   1. The shared URL is always the canonical Drop Page. Never a signed
 *      storage URL (they expire, and they leak the object's location), never
 *      the raw .nz, never a URL carrying who shared it.
 *   2. Everything interpolated into a share target is encoded. Titles are
 *      creator-controlled text; an unencoded one is at best a broken link and
 *      at worst a query the receiving site misparses.
 */

/** Absolute canonical URL for a Drop Page. */
export function canonicalDropUrl(origin, artistSlug, slug) {
  return `${String(origin ?? '').replace(/\/+$/, '')}/drop/${artistSlug}/${slug}`;
}

/**
 * The message body people actually send. Kept short — the first line has to
 * survive a notification preview.
 */
export function shareMessage({ title, artist, editionName, editionSize, url }) {
  const edition = [editionName, editionSize ? `${editionSize} copies` : '']
    .filter(Boolean)
    .join(' • ');
  return [
    `${title} by ${artist}`,
    '',
    'A portable Noizes music experience.',
    edition,
    '',
    'Open the drop:',
    url,
  ].filter((line, index, all) => line !== '' || all[index - 1] !== '').join('\n');
}

/**
 * Per-network share targets. Only networks with a documented, stable web
 * intent are included; anything else gets Copy link, which always works.
 */
export function shareTargets({ url, title, artist }) {
  const text = `${title} by ${artist} — a portable Noizes music experience.`;
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return [
    { key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}` },
    { key: 'x', label: 'X', href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { key: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    {
      key: 'email',
      label: 'Email',
      href: `mailto:?subject=${encodeURIComponent(`${title} by ${artist}`)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
    },
  ];
}

/** Up to 200 characters of description, sentence-safe, for og:description. */
export function metaDescription({ title, artist, description, editionName, editionSize, trackCount }) {
  const facts = [
    editionName || null,
    editionSize ? `${editionSize} copies` : null,
    trackCount ? `${trackCount} track${trackCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' • ');

  const body = String(description || '').replace(/\s+/g, ' ').trim();
  const lead = body || `${title} by ${artist}. A portable Noizes release you can open offline and keep.`;
  const full = facts ? `${lead} ${facts}.` : lead;
  if (full.length <= 200) return full;
  return `${full.slice(0, 197).replace(/[\s,;:.]+\S*$/, '')}…`;
}

/**
 * Open Graph / Twitter card tags as a flat list the page can render. Social
 * crawlers do not run JavaScript, so these must come out of the server render
 * — which is why this returns data rather than touching the DOM.
 */
export function openGraphTags({ url, title, artist, description, imageUrl, siteName = 'Noizes' }) {
  const headline = `${title} by ${artist}`;
  const tags = [
    { property: 'og:type', content: 'music.album' },
    { property: 'og:site_name', content: siteName },
    { property: 'og:title', content: headline },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { name: 'twitter:card', content: imageUrl ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: headline },
    { name: 'twitter:description', content: description },
  ];
  if (imageUrl) {
    tags.push({ property: 'og:image', content: imageUrl });
    tags.push({ property: 'og:image:alt', content: `Cover artwork for ${headline}` });
    tags.push({ name: 'twitter:image', content: imageUrl });
  }
  return tags;
}
