import ULTRA_HTML from '../templates/ULTRA.html?raw';

// Theme colour palettes
const THEMES = {
  ultra:       { primary: '#7B5CF0', accent: '#F04BD8', bg: '#030303' },
  codex:       { primary: '#4B6BF0', accent: '#6BE0F0', bg: '#030608' },
  transmission:{ primary: '#F0A84B', accent: '#F04B6B', bg: '#060300' },
  monument:    { primary: '#C8A96E', accent: '#E8C88E', bg: '#050403' },
};

export function buildExperienceHTML({ identity, edition, rights, audioBase64, audioMime, coverBase64, coverMime, lyrics, template }) {
  const themeId = template || 'ultra';
  const theme   = THEMES[themeId] || THEMES.ultra;

  const audioSrc = (audioBase64 && audioMime)
    ? `data:${audioMime};base64,${audioBase64}`
    : null;
  const coverSrc = (coverBase64 && coverMime)
    ? `data:${coverMime};base64,${coverBase64}`
    : null;

  const cfg = {
    artist:      identity.artist      || '',
    title:       identity.title       || '',
    year:        identity.year        || String(new Date().getFullYear()),
    genre:       identity.genre       || '',
    location:    identity.location    || '',
    description: identity.description || '',
    audioSrc,
    coverSrc,
    template:    themeId,
    theme,
    features:    lyrics && lyrics.length ? ['lyrics'] : [],
    lyricOffset: 0,
    lyrics:      lyrics || [],
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

  // Replace the NZ_CONFIG block in the template using brace-counting
  const cfgJson   = JSON.stringify(cfg, null, 2);
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
