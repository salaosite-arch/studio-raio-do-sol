const CACHE_NAME = 'raiodosol-cache-v13';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/dashboard.css',
  '/dashboard.js',
  '/styles.css',
  '/app.js',
  '/api-config.js',
  '/assets/logo.png',
  '/assets/logo-fallback.svg',
  '/assets/admin-avatar.png'
];

// Install Event - cache the static shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[Service Worker] Error caching files on install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - network-first for API requests, stale-while-revalidate for static files
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // If it's an API call or not a GET request, bypass caching
  if (url.pathname.startsWith('/api') || event.request.method !== 'GET') {
    event.respondWith(
      fetch(event.request).catch(err => {
        console.error('[Service Worker] API Fetch failed (offline):', err);
        return new Response(JSON.stringify({ error: 'Você está offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Network-First strategy for all static files so mobile phones ALWAYS receive the latest code immediately
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, cloned);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Message Event - Trigger native mobile status bar notification directly from Service Worker
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const title = event.data.title || '🔔 Studio Raio do Sol';
    const options = event.data.options || {};
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

// Notification Click Event - Focus or open the dashboard when user taps phone notification bar
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('dashboard.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
