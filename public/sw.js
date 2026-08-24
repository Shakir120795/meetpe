// NOW App — Service Worker
// v6: inject the unified reference-matched UI stylesheet after the legacy inline styles.
const CACHE_NAME = 'now-app-ui-v6';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/style.css',
  '/ui-v4.css'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/')) {
    return;
  }

  // Inject v4 after the page's legacy inline stylesheet so the reference design wins.
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request).then(async res => {
        if (!res || !res.ok) return res;
        const html = await res.text();
        const tag = '<link rel="stylesheet" href="/ui-v4.css?v=4">';
        const rewritten = html.includes('ui-v4.css') ? html : html.replace('</head>', `${tag}</head>`);
        return new Response(rewritten, {
          status: res.status,
          statusText: res.statusText,
          headers: {'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store'}
        });
      }).catch(() => caches.match(e.request).then(cached => cached || caches.match('/')))
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => cached || undefined))
  );
});