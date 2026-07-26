import ULTRA_HTML from '../templates/ULTRA.html?raw';

// Theme colour palettes
const THEMES = {
  ultra:       { primary: '#7B5CF0', accent: '#F04BD8', bg: '#030303' },
  codex:       { primary: '#4B6BF0', accent: '#6BE0F0', bg: '#030608' },
  transmission:{ primary: '#F0A84B', accent: '#F04B6B', bg: '#060300' },
  monument:    { primary: '#C8A96E', accent: '#E8C88E', bg: '#050403' },
};

// Builds the Guide: the creator's recommended journey through the object.
// "Folded into the existing schema" — it's an ordered list of steps derived
// from what the package actually contains, not a separate node-graph format.
// The viewer shows it as a drawer; collectors may still explore freely.
// `authored` (optional) lets a creator override the order/labels later.
export function buildGuide({ hasLyrics, hasPlay, authored }) {
  if (authored && Array.isArray(authored.nodes) && authored.nodes.length) {
    return { version: 1, allowFreeExplore: authored.allowFreeExplore !== false, nodes: authored.nodes };
  }
  const nodes = [
    { id: 'arrival', type: 'arrival', label: 'Arrival', view: 'intro' },
    { id: 'object', type: 'object', label: 'The Object', view: 'intro' },
    { id: 'listen', type: 'listen', label: 'Listen', view: 'view-player' },
  ];
  if (hasLyrics) nodes.push({ id: 'lyrics', type: 'lyrics', label: 'Lyrics', view: 'view-lyrics' });
  if (hasPlay) nodes.push({ id: 'play', type: 'interactive', label: 'Play', view: 'view-games' });
  nodes.push({ id: 'record', type: 'record', label: 'Collector Record', view: 'intro' });
  nodes.push({ id: 'end', type: 'ending', label: 'End', view: 'view-player' });
  return { version: 1, allowFreeExplore: true, nodes };
}

export function buildExperienceHTML({ identity, edition, rights, audioBase64, audioMime, coverBase64, coverMime, lyrics, template, play, guide }) {
  const themeId = template || 'ultra';
  const theme   = THEMES[themeId] || THEMES.ultra;

  // Optional game add-ons — only baked when the creator enabled games
  const playCfg = (play && Array.isArray(play.games) && play.games.length)
    ? {
        games:      play.games,
        difficulty: play.difficulty || 'standard',
        intensity:  typeof play.intensity === 'number' ? play.intensity : 1,
      }
    : null;

  const audioSrc = (audioBase64 && audioMime)
    ? `data:${audioMime};base64,${audioBase64}`
    : null;
  const coverSrc = (coverBase64 && coverMime)
    ? `data:${coverMime};base64,${coverBase64}`
    : null;

  const cfg = {
    artist:      identity.artist      || '',
    title:       identity.title       || '',
    releaseId:   identity.release_id  || '',
    year:        identity.year        || String(new Date().getFullYear()),
    genre:       identity.genre       || '',
    location:    identity.location    || '',
    description: identity.description || '',
    audioSrc,
    coverSrc,
    template:    themeId,
    theme,
    features:    [
      ...(lyrics && lyrics.length ? ['lyrics'] : []),
      ...(playCfg ? ['play'] : []),
    ],
    lyricOffset: 0,
    lyrics:      lyrics || [],
    play:        playCfg,
    guide:       buildGuide({ hasLyrics: !!(lyrics && lyrics.length), hasPlay: !!playCfg, authored: guide }),
    edition: {
      type:         edition.edition_type || 'Open Edition',
      name:         edition.edition_name || '',
      size:         edition.edition_size || 'unlimited',
      price:        edition.price        || '',
      currency:     edition.currency     || 'USD',
      transferable: edition.transferable ?? true,
    },
    rights: {
      copyright: rights.copyright || `© ${identity.year || new Date().getFullYear()} ${identity.artist}`,
      license:   rights.license   || 'All Rights Reserved',
      producer:  rights.producer  || '',
      credits:   rights.credits   ? rights.credits.split('\n').map(l => l.trim()).filter(Boolean) : [],
    },
  };

  // Replace the NZ_CONFIG block in the template using brace-counting.
  // Escape "<" as < so creator-controlled strings (artist, lyrics, …)
  // can never contain "</script>" and break out of the script tag (XSS in
  // the exported package). < is a valid JSON escape — parse-identical.
  const cfgJson   = JSON.stringify(cfg, null, 2).replace(/</g, '\\u003c');
  const injection = `<script>\nwindow.NZ_CONFIG = ${cfgJson};\n</script>`;

  // Find opening <script>\nwindow.NZ_CONFIG = { and matching }; </script>
  const startTag = '<script>\nwindow.NZ_CONFIG = {';
  const startIdx = ULTRA_HTML.indexOf(startTag);
  if (startIdx === -1) return ULTRA_HTML; // fallback

  // Walk from the opening brace to find the closing };
  let braceCount = 0;
  let endIdx = -1;
  for (let i = startIdx + startTag.length - 1; i < ULTRA_HTML.length; i++) {
    if (ULTRA_HTML[i] === '{') braceCount++;
    if (ULTRA_HTML[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        // find the </script> after this
        const closeScript = ULTRA_HTML.indexOf('</script>', i);
        if (closeScript !== -1) {
          endIdx = closeScript + '</script>'.length;
        }
        break;
      }
    }
  }

  if (endIdx === -1) return ULTRA_HTML;
  return ULTRA_HTML.slice(0, startIdx) + injection + ULTRA_HTML.slice(endIdx);
}
