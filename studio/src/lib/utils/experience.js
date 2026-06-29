export function buildExperienceHTML({ identity, edition, rights, audioName, coverBase64, coverMime }) {
  const audioSrc = audioName ? `audio/${audioName}` : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(identity.title)} — ${escHtml(identity.artist)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #0e0e0e;
    --paper: #f5f2ec;
    --gold: #c8a96e;
    --surface: #1a1a1a;
    --muted: #888;
  }
  body {
    background: var(--ink);
    color: var(--paper);
    font-family: Georgia, 'Times New Roman', serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 24px;
  }
  .container { max-width: 640px; width: 100%; }
  .cover {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    display: block;
    margin-bottom: 32px;
    background: #1a1a1a;
  }
  .cover-placeholder {
    width: 100%;
    aspect-ratio: 1;
    background: #1a1a1a;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 32px;
    color: var(--muted);
    font-family: 'Courier New', monospace;
    font-size: 13px;
  }
  h1 {
    font-size: clamp(24px, 6vw, 40px);
    font-weight: normal;
    line-height: 1.1;
    margin-bottom: 6px;
    letter-spacing: -0.02em;
  }
  .artist {
    font-size: 16px;
    color: var(--gold);
    margin-bottom: 24px;
    font-family: 'Courier New', monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .meta {
    display: flex;
    gap: 16px;
    margin-bottom: 32px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    flex-wrap: wrap;
  }
  .description {
    font-size: 15px;
    line-height: 1.7;
    color: #ccc;
    margin-bottom: 40px;
  }
  audio {
    width: 100%;
    margin-bottom: 40px;
    accent-color: var(--gold);
  }
  audio::-webkit-media-controls-panel { background: #1a1a1a; }
  .section-title {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #2a2a2a;
  }
  .record {
    background: var(--surface);
    padding: 20px;
    margin-bottom: 24px;
  }
  .record-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid #2a2a2a;
    font-size: 13px;
  }
  .record-row:last-child { border-bottom: none; }
  .record-key {
    font-family: 'Courier New', monospace;
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .record-val { color: var(--paper); font-family: 'Courier New', monospace; font-size: 12px; }
  footer {
    margin-top: 48px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: #444;
    text-align: center;
    letter-spacing: 0.1em;
  }
</style>
</head>
<body>
<div class="container">
  ${coverBase64
    ? `<img class="cover" src="data:${coverMime};base64,${coverBase64}" alt="Cover art for ${escHtml(identity.title)}" />`
    : `<div class="cover-placeholder">[ no cover art ]</div>`
  }

  <div class="artist">${escHtml(identity.artist)}</div>
  <h1>${escHtml(identity.title)}</h1>
  <div class="meta">
    ${identity.year ? `<span>${escHtml(identity.year)}</span>` : ''}
    ${identity.genre ? `<span>${escHtml(identity.genre)}</span>` : ''}
    ${identity.location ? `<span>${escHtml(identity.location)}</span>` : ''}
  </div>

  ${identity.description ? `<p class="description">${escHtml(identity.description)}</p>` : ''}

  ${audioSrc ? `
  <audio controls>
    <source src="${escHtml(audioSrc)}" />
    Your browser does not support the audio element.
  </audio>
  ` : ''}

  <div class="section-title">Edition Record</div>
  <div class="record">
    <div class="record-row"><span class="record-key">Edition</span><span class="record-val">${escHtml(edition.edition_name || edition.edition_type)}</span></div>
    <div class="record-row"><span class="record-key">Type</span><span class="record-val">${escHtml(edition.edition_type)}</span></div>
    ${edition.edition_size ? `<div class="record-row"><span class="record-key">Size</span><span class="record-val">${escHtml(edition.edition_size)} copies</span></div>` : ''}
    ${edition.price ? `<div class="record-row"><span class="record-key">Price</span><span class="record-val">${escHtml(edition.currency)} ${escHtml(edition.price)}</span></div>` : ''}
    <div class="record-row"><span class="record-key">Transferable</span><span class="record-val">${edition.transferable ? 'Yes' : 'No'}</span></div>
  </div>

  <div class="section-title">Provenance</div>
  <div class="record">
    <div class="record-row"><span class="record-key">Copyright</span><span class="record-val">${escHtml(rights.copyright || '—')}</span></div>
    <div class="record-row"><span class="record-key">License</span><span class="record-val">${escHtml(rights.license)}</span></div>
    ${rights.producer ? `<div class="record-row"><span class="record-key">Producer</span><span class="record-val">${escHtml(rights.producer)}</span></div>` : ''}
    ${rights.credits ? `<div class="record-row"><span class="record-key">Credits</span><span class="record-val">${escHtml(rights.credits)}</span></div>` : ''}
  </div>

  <footer>Packaged with Noizes · noizes_version 1.0.0</footer>
</div>
</body>
</html>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
