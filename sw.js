// sw.js – Einfacher aber effektiver Service Worker für Offline-Support

const CACHE_NAME = 'feuerwehr-verkehr-v1';
const urlsToCache = [
  './',
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/map.js',
  'js/main.js',
  'js/ui.js',
  'js/theme.js',
  'js/data.js',
  'js/geometry.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@turf/turf@7/turf.min.js'
];

// Install – Cache wichtige Dateien
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate – Alten Cache löschen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch – Offline-Fallback
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit – return response
        if (response) return response;

        // Network request
        return fetch(event.request).then(
          networkResponse => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // Cache dynamic resources (optional)
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache));

            return networkResponse;
          }
        );
      })
  );
});// JavaScript Document