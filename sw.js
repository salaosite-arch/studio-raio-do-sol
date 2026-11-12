const CACHE_NAME = 'raiodosol-cache-v14';
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

// Install Event - activate new Service Worker immediately
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[Service Worker] Non-blocking cache init warning:', err);
      });
    })
  );
});

// Activate Event - purge all old caches and force open Home Screen PWAs to reload into the latest version
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const oldKeys = keys.filter(key => key !== CACHE_NAME);
      await Promise.all(oldKeys.map(key => caches.delete(key)));
      await self.clients.claim();

      if (oldKeys.length > 0) {
        const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windowClients) {
          try {
            client.postMessage({ type: 'SW_UPDATED_RELOAD', version: CACHE_NAME });
            if ('navigate' in client && client.url) {
              await client.navigate(client.url);
            }
          } catch (e) {
            console.warn('[Service Worker] Client navigate fallback:', e);
          }
        }
      }
    })()
  );
});

// Fetch Event - Bypass cache for API & always fetch fresh HTML/JS/CSS from network first
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache API calls or non-GET requests
  if (url.pathname.startsWith('/api') || event.request.method !== 'GET') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(err => {
        console.error('[Service Worker] API Fetch failed (offline):', err);
        return new Response(JSON.stringify({ error: 'Você está offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Network-First with cache: 'no-store' for code files so Home Screen PWAs never run stale code
  const isCodeOrDoc = /\.(html|js|css|json)$/i.test(url.pathname) || url.pathname === '/';
  const fetchOptions = isCodeOrDoc ? { cache: 'no-store' } : {};

  event.respondWith(
    fetch(event.request, fetchOptions)
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

// Message Event - Trigger native mobile status bar notification or handle skipWaiting
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data.type === 'SHOW_NOTIFICATION') {
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
