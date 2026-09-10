const CACHE_NAME = 'powerball-pwa-v2';
const ASSETS = ['./', './index.html', './styles.css', './src/app.js', './lib/config.js', './lib/database.js', './lib/storage.js', './lib/ticket-validator.js', './manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {}

  const title = payload.title || 'Powerball Ticket Tracker';
  const body = payload.body || 'You have an update about your Powerball tickets.';
  const options = {
    body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: payload.data || {},
    tag: payload.tag || 'powerball-update'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
    for (const client of clientList) {
      if ('focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow('./');
    return undefined;
  }));
});
