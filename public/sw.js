// NOW App — Service Worker
// v4: force-load the responsive website UI directly into every HTML navigation.
const CACHE_NAME = 'now-app-ui-v4';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/style.css',
  '/ui-responsive-preview.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin/')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(async response => {
        if (!response || response.status !== 200) return response;

        if (event.request.mode === 'navigate') {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            const html = await response.text();
            const cssLink = '<link rel="stylesheet" href="/ui-responsive-preview.css?v=4">';

            let updatedHtml = html;
            if (!updatedHtml.includes('/ui-responsive-preview.css')) {
              updatedHtml = updatedHtml.replace('</head>', cssLink + '</head>');
            } else {
              updatedHtml = updatedHtml.replace(
                /<link[^>]+href=["'][^"']*ui-responsive-preview\.css[^"']*["'][^>]*>/i,
                cssLink
              );
            }

            const headers = new Headers(response.headers);
            headers.delete('content-length');

            const htmlResponse = new Response(updatedHtml, {
              status: response.status,
              statusText: response.statusText,
              headers
            });

            const clone = htmlResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
            return htmlResponse;
          }
        }

        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('/');
          return undefined;
        })
      )
  );
});