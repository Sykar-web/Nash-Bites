// Nash Bites Service Worker
const CACHE_NAME = 'nash-bites-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './home.html',
  './cart.html',
  './checkout.html',
  './profile.html',
  './order-history.html',
  './meal-details.html',
  './vendor-dashboard.html',
  './carrier-dashboard.html',
  './admin.html',
  './manifest.json',
  './tent.jpg'
];

// Install: cache assets and immediately take over
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete old caches, claim all tabs
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => {
        clients.forEach(client => {
          if (client.url && 'navigate' in client) {
            client.postMessage({ type: 'SW_UPDATED' });
          }
        });
      })
  );
});

// Fetch: network-first for Supabase, cache-first + revalidate for everything else
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go live for Supabase and Google Storage
  if (url.hostname.includes('supabase') || url.hostname.includes('googleapis.com')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // For navigation requests (page loads), try network first so auth redirect always works
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request).then(cached =>
            cached || caches.match('./index.html')
          )
        )
    );
    return;
  }

  // For all other assets: stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      });
      return cached || networkFetch.catch(() => new Response('Offline', { status: 503 }));
    })
  );
});

// Listen for manual skipWaiting from page
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
