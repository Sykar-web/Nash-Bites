// Nash Bites Service Worker
const CACHE_NAME = 'nash-bites-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './home.html',
  './cart.html',
  './checkout.html',
  './profile.html',
  './order-history.html',
  './vendor-dashboard.html',
  './carrier-dashboard.html',
  './admin.html',
  './manifest.json',
  './tent.jpeg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('supabase') || url.hostname.includes('googleapis.com/storage')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {headers:{'Content-Type':'application/json'}})));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => cached || new Response('Offline', {status: 503}));
    })
  );
});
