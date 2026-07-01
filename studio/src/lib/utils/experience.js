export function buildExperienceHTML({ identity, edition, rights, audioName, coverBase64, coverMime }) {
  const audioSrc = audioName ? `audio/${audioName}` : null;
  const coverSrc = coverBase64 ? `data:${coverMime};base64,${coverBase64}` : null;
  const year = identity.year || new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(identity.title)} — ${escHtml(identity.artist)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#030303;
  --surface:#0e0e0e;
  --surface2:#161616;
  --border:rgba(255,255,255,0.07);
  --text:#f5f2ec;
  --muted:#666;
  --gold:#c8a96e;
  --violet:#7B5CF0;
  --progress-h:3px;
}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
body{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;min-height:100vh;padding:0 0 80px}

/* ─── COVER ─── */
.cover-wrap{width:100%;max-width:480px;margin:0 auto;position:relative}
.cover-img{width:100%;aspect-ratio:1;object-fit:cover;display:block}
.cover-placeholder{width:100%;aspect-ratio:1;background:var(--surface2);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;font-family:monospace}
.cover-gradient{position:absolute;bottom:0;left:0;right:0;height:160px;background:linear-gradient(to top,var(--bg),transparent);pointer-events:none}

/* ─── MAIN ─── */
.main{width:100%;max-width:480px;margin:0 auto;padding:24px 20px 0}

.artist{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:6px;font-family:monospace}
.title{font-size:clamp(22px,6vw,36px);font-weight:700;line-height:1.1;letter-spacing:-.02em;color:var(--text);margin-bottom:16px}
.meta-row{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.chip{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-family:monospace;background:var(--surface2);border:1px solid var(--border);padding:3px 10px;border-radius:99px}

.description{font-size:14px;line-height:1.7;color:#888;margin-bottom:28px}

/* ─── PLAYER ─── */
.player{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:24px}
.progress-bar{width:100%;height:var(--progress-h);background:rgba(255,255,255,0.08);border-radius:99px;cursor:pointer;margin-bottom:16px;position:relative;-webkit-appearance:none;appearance:none}
.progress-bar::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:var(--violet);margin-top:calc(var(--progress-h)/2 - 6px);cursor:pointer}
.progress-bar::-webkit-slider-runnable-track{height:var(--progress-h);border-radius:99px}
.progress-track{position:absolute;top:0;left:0;height:100%;border-radius:99px;background:var(--violet);pointer-events:none;transition:width .1s linear}
.time-row{display:flex;justify-content:space-between;font-size:11px;font-family:monospace;color:var(--muted);margin-bottom:18px}
.controls{display:flex;align-items:center;justify-content:center;gap:20px}
.btn-ctrl{background:none;border:none;color:var(--text);cursor:pointer;padding:8px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:opacity .15s}
.btn-ctrl:hover{opacity:.7}
.btn-play{background:var(--violet);width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;transition:transform .1s,opacity .1s}
.btn-play:hover{opacity:.85}
.btn-play:active{transform:scale(.95)}
.btn-play svg{width:20px;height:20px;fill:#fff}
.vol-row{display:flex;align-items:center;gap:8px;margin-top:18px}
.vol-icon{color:var(--muted);font-size:13px;font-family:monospace;width:20px;text-align:center}
.vol-slider{flex:1;-webkit-appearance:none;height:3px;background:rgba(255,255,255,0.08);border-radius:99px;outline:none;cursor:pointer}
.vol-slider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:var(--muted);cursor:pointer}
.no-audio{text-align:center;padding:20px 0;color:var(--muted);font-size:13px;font-family:monospace}

/* ─── RECORDS ─── */
.section-label{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);font-family:monospace;margin-bottom:10px}
.record{border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:20px}
.record-row{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border);font-size:12px}
.record-row:last-child{border-bottom:none}
.rk{font-family:monospace;color:var(--muted);font-size:10px;letter-spacing:.08em;text-transform:uppercase}
.rv{font-family:monospace;color:var(--text);font-size:11px;text-align:right;max-width:60%}

/* ─── FOOTER ─── */
footer{margin-top:32px;text-align:center;font-family:monospace;font-size:10px;color:#333;letter-spacing:.12em}
footer a{color:#444;text-decoration:none}
footer a:hover{color:var(--gold)}
</style>
</head>
<body>

<div class="cover-wrap">
  ${coverSrc
    ? `<img class="cover-img" src="${coverSrc}" alt="${escHtml(identity.title)}" />`
    : `<div class="cover-placeholder">[ no cover art ]</div>`
  }
  <div class="cover-gradient"></div>
</div>

<div class="main">
  <div class="artist">${escHtml(identity.artist)}</div>
  <div class="title">${escHtml(identity.title)}</div>
  <div class="meta-row">
    ${identity.year ? `<span class="chip">${escHtml(identity.year)}</span>` : ''}
    ${identity.genre ? `<span class="chip">${escHtml(identity.genre)}</span>` : ''}
    ${identity.location ? `<span class="chip">${escHtml(identity.location)}</span>` : ''}
    <span class="chip">${escHtml(edition.edition_type || 'Edition')}</span>
  </div>
  ${identity.description ? `<p class="description">${escHtml(identity.description)}</p>` : ''}

  <!-- PLAYER -->
  <div class="player" id="player-wrap">
    ${audioSrc ? `
    <div style="position:relative;height:3px;background:rgba(255,255,255,0.08);border-radius:99px;margin-bottom:16px;cursor:pointer" id="seek-bar">
      <div class="progress-track" id="progress-fill" style="width:0%"></div>
      <div style="position:absolute;top:50%;transform:translateY(-50%);left:0%;width:12px;height:12px;border-radius:50%;background:var(--violet);margin-left:-6px;transition:left .1s linear" id="seek-thumb"></div>
    </div>
    <div class="time-row">
      <span id="time-current">0:00</span>
      <span id="time-total">—</span>
    </div>
    <div class="controls">
      <button class="btn-ctrl" id="btn-back" title="Back 10s">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"/><text x="8.5" y="15.5" font-size="5.5" font-family="monospace" fill="currentColor">10</text></svg>
      </button>
      <button class="btn-play" id="btn-play" title="Play / Pause">
        <svg id="icon-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        <svg id="icon-pause" viewBox="0 0 24 24" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
      </button>
      <button class="btn-ctrl" id="btn-fwd" title="Forward 10s">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6h2c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8z"/><text x="8.5" y="15.5" font-size="5.5" font-family="monospace" fill="currentColor">10</text></svg>
      </button>
    </div>
    <div class="vol-row">
      <span class="vol-icon">♪</span>
      <input type="range" class="vol-slider" id="vol-slider" min="0" max="1" step="0.01" value="1" />
    </div>
    <audio id="audio" preload="metadata" style="display:none">
      <source src="${escHtml(audioSrc)}" />
    </audio>
    ` : `<div class="no-audio">[ no audio file in this package ]</div>`}
  </div>

  <!-- EDITION RECORD -->
  <div class="section-label">Edition Record</div>
  <div class="record">
    <div class="record-row"><span class="rk">Edition</span><span class="rv">${escHtml(edition.edition_name || edition.edition_type || '—')}</span></div>
    <div class="record-row"><span class="rk">Type</span><span class="rv">${escHtml(edition.edition_type || '—')}</span></div>
    ${edition.edition_size ? `<div class="record-row"><span class="rk">Size</span><span class="rv">${escHtml(String(edition.edition_size))} copies</span></div>` : ''}
    ${edition.price ? `<div class="record-row"><span class="rk">Price</span><span class="rv">${escHtml(edition.currency || '')} ${escHtml(String(edition.price))}</span></div>` : ''}
    <div class="record-row"><span class="rk">Transferable</span><span class="rv">${edition.transferable ? 'Yes' : 'No'}</span></div>
  </div>

  <!-- PROVENANCE -->
  <div class="section-label">Provenance</div>
  <div class="record">
    <div class="record-row"><span class="rk">Copyright</span><span class="rv">${escHtml(rights.copyright || `© ${year} ${identity.artist}`)}</span></div>
    <div class="record-row"><span class="rk">License</span><span class="rv">${escHtml(rights.license || 'All Rights Reserved')}</span></div>
    ${rights.producer ? `<div class="record-row"><span class="rk">Producer</span><span class="rv">${escHtml(rights.producer)}</span></div>` : ''}
    ${rights.credits ? `<div class="record-row"><span class="rk">Credits</span><span class="rv">${escHtml(rights.credits)}</span></div>` : ''}
  </div>

  <footer>
    Packaged with <a href="https://noizes.xyz" target="_blank" rel="noopener">Noizes</a> · Format 1.0.0<br>
    This object is self-contained and works offline, permanently.
  </footer>
</div>

<script>
(function(){
  var audio = document.getElementById('audio');
  if(!audio) return;
  var btnPlay = document.getElementById('btn-play');
  var iconPlay = document.getElementById('icon-play');
  var iconPause = document.getElementById('icon-pause');
  var fill = document.getElementById('progress-fill');
  var thumb = document.getElementById('seek-thumb');
  var seekBar = document.getElementById('seek-bar');
  var timeCur = document.getElementById('time-current');
  var timeTotal = document.getElementById('time-total');
  var vol = document.getElementById('vol-slider');

  function fmt(s){
    s = Math.floor(s||0);
    return Math.floor(s/60)+':'+(s%60<10?'0':'')+(s%60);
  }
  function setProgress(pct){
    fill.style.width = pct+'%';
    thumb.style.left = pct+'%';
  }

  audio.addEventListener('loadedmetadata',function(){
    timeTotal.textContent = fmt(audio.duration);
  });
  audio.addEventListener('timeupdate',function(){
    if(!audio.duration) return;
    var pct = (audio.currentTime/audio.duration)*100;
    setProgress(pct);
    timeCur.textContent = fmt(audio.currentTime);
  });
  audio.addEventListener('ended',function(){
    iconPlay.style.display='';
    iconPause.style.display='none';
    setProgress(0);
  });

  btnPlay.addEventListener('click',function(){
    if(audio.paused){
      audio.play();
      iconPlay.style.display='none';
      iconPause.style.display='';
    } else {
      audio.pause();
      iconPlay.style.display='';
      iconPause.style.display='none';
    }
  });

  seekBar.addEventListener('click',function(e){
    var rect = seekBar.getBoundingClientRect();
    var pct = (e.clientX - rect.left)/rect.width;
    audio.currentTime = pct * audio.duration;
  });

  document.getElementById('btn-back').addEventListener('click',function(){
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  });
  document.getElementById('btn-fwd').addEventListener('click',function(){
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
  });

  vol.addEventListener('input',function(){
    audio.volume = parseFloat(vol.value);
  });
})();
</script>
</body>
</html>`;
}

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
