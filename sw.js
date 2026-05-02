// Nash Bites Service Worker
const CACHE_NAME = 'nash-bites-v3';
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
  './tent.jpg'
];

// Install: cache assets and immediately take over (no waiting)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()) // skip waiting so new SW activates right away
  );
});

// Activate: delete old caches, then claim all open tabs instantly
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim()) // take control of all open pages immediately
      .then(() => {
        // Tell every open tab to reload so they use the fresh SW
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      })
      .then(clients => {
        clients.forEach(client => {
          // Only reload pages that are already loaded (not mid-navigation)
          if (client.url && 'navigate' in client) {
            client.postMessage({ type: 'SW_UPDATED' });
          }
        });
      })
  );
});

// Fetch: cache-first for local assets, network-first for Supabase/remote
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go to network for Supabase and Google Storage
  if (url.hostname.includes('supabase') || url.hostname.includes('googleapis.com/storage')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      });

      // Return cache immediately but also update in background (stale-while-revalidate)
      return cached || networkFetch.catch(() => new Response('Offline', { status: 503 }));
    })
  );
});

// Listen for manual skipWaiting messages from the page (optional)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
