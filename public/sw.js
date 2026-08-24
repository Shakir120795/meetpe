// NOW App — Service Worker
// v8: unified UI for home, product, basket, orders, profile and all secondary screens.
const CACHE_NAME = 'now-app-ui-v8';
const STATIC_ASSETS = ['/', '/manifest.json', '/logo.png', '/style.css', '/ui-v5.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/')) return;

  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/index.html')) {
    e.respondWith(fetch(e.request).then(async res => {
      if (!res || !res.ok) return res;
      const html = await res.text();
      const tag = '<link rel="stylesheet" href="/ui-v5.css?v=6">';
      const rewritten = html.includes('ui-v5.css') ? html : html.replace('</head>', `${tag}</head>`);
      const headers = new Headers(res.headers);
      headers.set('Content-Type', 'text/html; charset=utf-8');
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      headers.delete('Content-Length');
      return new Response(rewritten, {status: res.status, statusText: res.statusText, headers});
    }).catch(() => caches.match(e.request).then(cached => cached || caches.match('/'))));
    return;
  }

  e.respondWith(fetch(e.request).then(res => {
    if (res && res.status === 200) {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone)).catch(() => {});
    }
    return res;
  }).catch(() => caches.match(e.request).then(cached => cached || undefined)));
});