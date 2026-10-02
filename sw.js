// Service worker de Pop10.
// - Archivos del propio sitio (index.html, leaderboard.js, firebase-config.js, íconos):
//   primero se piden a internet, así los cambios llegan en cuanto se publican.
//   Sin internet se usa la copia guardada y el juego abre igual.
// - SDK de Firebase y fuentes de Google: salen de caché (son versiones fijas que no cambian).
// Ya no hace falta subir VERSION en cada cambio; súbela solo si cambias la lista SHELL.
const VERSION = 'pop10-v14';
const SHELL = [
  './', 'index.html', 'leaderboard.js', 'firebase-config.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];
const RUNTIME_HOSTS = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    // Red primero; la copia guardada solo si no hay internet.
    const isPage = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
    const cacheKey = isPage ? 'index.html' : req;
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(cacheKey, copy)); }
          return res;
        })
        .catch(() => caches.match(cacheKey, { ignoreSearch: true }))
    );
    return;
  }

  if (!RUNTIME_HOSTS.includes(url.hostname)) return; // Firestore/Auth van directo a la red

  // Recursos externos de versión fija: caché primero.
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    })
  );
});
