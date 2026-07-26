const CACHE = 'noizes-v3';

// Precache everything the standalone viewer needs to launch and run with no
// network: the viewer itself (inlines JSZip + all CSS/JS, uses system fonts),
// the manifest, and the icons. viewer.html has zero external requests, so this
// set is the whole offline app.
const PRECACHE = [
  '/viewer.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // Individually so one 404 can't abort the whole precache.
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Only handle same-origin GETs.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isViewer = url.pathname === '/viewer.html';
  const isPrecached = PRECACHE.includes(url.pathname);
  const isStatic = url.pathname.startsWith('/_app/immutable/');
  if (!isViewer && !isPrecached && !isStatic) return;

  // Navigations: only the viewer is served offline. Other SSR pages need a live
  // round-trip to auth/redirect correctly, so let them hit the network.
  if (e.request.mode === 'navigate' && !isViewer) return;

  // Cache-first for the offline app shell, revalidating in the background.
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});
