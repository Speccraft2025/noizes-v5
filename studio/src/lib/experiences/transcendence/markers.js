// The Transcendence document's marker contract, in one place.
//
// Two producers fill these markers: Studio's `buildTranscendenceHTML()` and the
// reference build's `build-transcendence.mjs`. Keeping the list and the fill
// logic here is what stops the two from drifting — if a marker is added to
// experience.html and only one producer learns about it, the other fails loudly
// at build time instead of shipping a page with `/* TX_TITLE */` in the header.

/** Every marker the document declares, and whether it is required. */
export const MARKERS = [
  // Assembled code and payloads.
  { token: '/* TRANSCENDENCE_CSS */', key: 'css', required: true },
  { token: '/* THREE_RUNTIME */', key: 'three', required: true },
  { token: '/* GSAP_RUNTIME */', key: 'gsap', required: true },
  { token: '/* TRANSCENDENCE_RUNTIME */', key: 'runtime', required: true },
  { token: '/* ANALYSIS_PAYLOAD */', key: 'analysis', required: true },
  { token: '/* EDITION_PAYLOAD */', key: 'edition', required: true },
  { token: '/* CONFIG_PAYLOAD */', key: 'config', required: true },
  { token: '/* SEQUENCE_PAYLOAD */', key: 'sequence', required: true },
  // Record-specific copy. The runtime knows nothing about any one recording.
  { token: '/* TX_TITLE */', key: 'title', required: true },
  { token: '/* TX_SUBTITLE */', key: 'subtitle', required: true },
  { token: '/* TX_CREDIT */', key: 'credit', required: true },
  { token: '/* TX_DURATION_LABEL */', key: 'durationLabel', required: true },
  { token: '/* TX_ARC_END */', key: 'arcEnd', required: true },
  { token: '/* TX_THRESHOLD_TITLE */', key: 'thresholdTitle', required: true },
  { token: '/* TX_THRESHOLD_ACTION */', key: 'thresholdAction', required: true },
  { token: '/* TX_THRESHOLD_HINT */', key: 'thresholdHint', required: true },
  { token: '/* TX_OPENING_TITLE */', key: 'openingTitle', required: true },
  { token: '/* TX_OPENING_SCENE */', key: 'openingScene', required: true },
  { token: '/* TX_LYRIC_PROVENANCE */', key: 'lyricProvenance', required: true },
  { token: '<!-- TX_AUDIO_SOURCES -->', key: 'audioSources', required: true },
  { token: '<!-- DEBUG_PANEL -->', key: 'debugPanel', required: false },
];

/**
 * Escape text destined for HTML body/attribute context. The creator's title and
 * credits are untrusted input as far as the document is concerned: a release
 * called `</script><script>…` must not become script in the exported package.
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Serialise a value for a `<script type="application/json">` block.
 *
 * `</script` inside a string would end the block early, and `<!--` can start a
 * comment in a legacy parser. Escaping the `<` closes both without changing what
 * JSON.parse sees.
 */
export function escapeJsonPayload(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

/**
 * Fill every marker in `template` from `values`, keyed as in MARKERS.
 *
 * Substitution is by split/join rather than String#replace, because a `$&` or
 * `$1` occurring naturally inside minified Three.js or a creator's prose would
 * otherwise be interpreted as a replacement pattern and corrupt the output.
 *
 * @throws if a required marker has no value, or if any marker survives the fill
 */
export function fillMarkers(template, values) {
  let html = template;
  const missing = [];

  for (const { token, key, required } of MARKERS) {
    const has = Object.prototype.hasOwnProperty.call(values, key) && values[key] != null;
    if (!has) {
      if (required) missing.push(key);
      else html = html.split(token).join('');
      continue;
    }
    const value = String(values[key]);
    html = html.split(token).join(value);
  }

  if (missing.length) {
    throw new Error(`Transcendence template: no value supplied for ${missing.join(', ')}`);
  }
  const leftover = findUnfilledMarkers(html);
  if (leftover.length) {
    throw new Error(`Transcendence template: unfilled markers remain: ${leftover.join(', ')}`);
  }
  return html;
}

/** Any marker-shaped token still present. The export validator gates on this. */
export function findUnfilledMarkers(html) {
  const found = new Set();
  for (const match of html.matchAll(/\/\* (TX_[A-Z_]+|[A-Z_]*PAYLOAD|THREE_RUNTIME|GSAP_RUNTIME|TRANSCENDENCE_[A-Z]+) \*\//g)) {
    found.add(match[1]);
  }
  for (const match of html.matchAll(/<!-- (TX_[A-Z_]+|DEBUG_PANEL) -->/g)) {
    found.add(match[1]);
  }
  return [...found];
}

/** `<source>` elements for an audio component, newest-format-first. */
export function audioSourceTags(sources) {
  return sources
    .filter(source => source?.src)
    .map(source => `<source src="${escapeHtml(source.src)}"${source.type ? ` type="${escapeHtml(source.type)}"` : ''}>`)
    .join('\n    ');
}

/** mm:ss, matching the runtime's own timecode helper. */
export function timecode(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
