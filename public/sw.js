// NOW App — Service Worker
const CACHE_NAME = 'now-app-ui-preview-v3';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/style.css',
  '/ui-responsive-preview.css'
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

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
        }

        if (e.request.mode === 'navigate' && res && res.status === 200) {
          const type = res.headers.get('content-type') || '';
          if (type.includes('text/html')) {
            return res.text().then(html => {
              if (html.includes('/ui-responsive-preview.css')) return new Response(html, {
                status: res.status,
                statusText: res.statusText,
                headers: res.headers
              });

              const injected = html.replace(
                '</head>',
                '<link rel="stylesheet" href="/ui-responsive-preview.css">\n</head>'
              );

              const headers = new Headers(res.headers);
              headers.delete('content-length');
              return new Response(injected, {
                status: res.status,
                statusText: res.statusText,
                headers
              });
            });
          }
        }

        return res;
      })
      .catch(() => caches.match(e.request).then(cached => {
        if (cached) return cached;
        if (e.request.mode === 'navigate') return caches.match('/');
        return undefined;
      }))
  );
});