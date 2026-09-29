// Service worker de Pop10.
// - La página (index.html) se pide primero a internet: si publicas cambios, llegan al abrir el juego.
// - El resto (scripts, íconos, SDK de Firebase, fuentes) sale de caché y se actualiza en segundo plano.
// - Sin internet, todo sale de caché y el juego abre igual.
// Sube VERSION cuando publiques cambios en archivos que no sean index.html.
const VERSION = 'pop10-v10';
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
  if (!sameOrigin && !RUNTIME_HOSTS.includes(url.hostname)) return; // Firestore/Auth van directo a la red

  // Página principal: primero red (sin caché del navegador), si falla, la copia guardada.
  if (req.mode === 'navigate' || (sameOrigin && url.pathname.endsWith('/index.html'))) {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          if (res && res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put('index.html', copy)); }
          return res;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // Todo lo demás: caché primero y se actualiza en segundo plano.
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: sameOrigin });
      const fresh = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
