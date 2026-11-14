// Zero-dependency static server for the extracted package. Supports HTTP Range so audio can seek.
// Usage: node scripts/serve.mjs [port]   → http://127.0.0.1:4311/experience.html
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), 'build', 'The-House-That-Remembered-Us-Rooms');
const NZ = join(fileURLToPath(new URL('..', import.meta.url)), 'dist', 'The-House-That-Remembered-Us-Rooms.nz');
const PORT = Number(process.argv[2] || process.env.PORT || 4311);
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (rel === '/') rel = '/experience.html';
  // /package.nz serves the built archive (with CORS) so it can be handed to the /open viewer during testing
  const file = rel === '/package.nz' ? NZ : normalize(join(ROOT, rel));
  let st; try { if (file !== NZ && !file.startsWith(ROOT)) throw 0; st = statSync(file); if (!st.isFile()) throw 0; } catch { res.writeHead(404).end('Not found'); return; }
  const head = { 'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m) {
    const start = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2])), end = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }).end(); return; }
    res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 }); createReadStream(file, { start, end }).pipe(res);
  } else { res.writeHead(200, { ...head, 'Content-Length': st.size }); createReadStream(file).pipe(res); }
}).listen(PORT, '127.0.0.1', () => console.log(`Serving ${ROOT}\nOpen http://127.0.0.1:${PORT}/experience.html`));
