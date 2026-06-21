// sw.js – MAXIMALE NO-CACHE Version für proxy.php (Workbox v5)
// proxy.php wird garantiert NIE aus dem Cache ausgeliefert

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

if (workbox) {
  console.log('✅ Workbox geladen – proxy.php wird mit maximaler No-Cache-Strategie behandelt');

  workbox.core.setCacheNameDetails({
    prefix: 'feuerwehr-verkehr',
    suffix: 'v5',
    precache: 'precache',
    runtime: 'runtime'
  });

  // ================================================
  // 1. Precache statischer Assets
  // ================================================
  workbox.precaching.precacheAndRoute([
    { url: './', revision: '20260404' },
    { url: 'index.html', revision: '20260404' },
    { url: 'manifest.json', revision: '20260404' },
    { url: 'css/design.css', revision: '20260404' },
    { url: 'js/map.js', revision: '20260404' },
    { url: 'js/main.js', revision: '20260404' },
    { url: 'js/ui.js', revision: '20260404' },
    { url: 'js/theme.js', revision: '20260404' },
    { url: 'js/data.js', revision: '20260404' },
    { url: 'js/geometry.js', revision: '20260404' },
    { url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', revision: '1' },
    { url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', revision: '1' },
    { url: 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css', revision: '1' },
    { url: 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css', revision: '1' },
    { url: 'https://cdn.jsdelivr.net/npm/@turf/turf@7/turf.min.js', revision: '1' }
  ]);

  // ================================================
  // 2. proxy.php → ABSOLUTE HIGHEST PRIORITY: NetworkOnly + Cache-Löschung
  // ================================================
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.includes('proxy.php') || url.pathname.endsWith('.php'),
    new workbox.strategies.NetworkOnly({
      // Kein CacheName = Workbox legt keinen Cache an
    })
  );

  // ================================================
  // 3. Alle anderen Anfragen → StaleWhileRevalidate
  // ================================================
  workbox.routing.registerRoute(
    ({ request }) =>
      request.destination === 'document' ||
      request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'image' ||
      request.destination === 'font' ||
      /\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|ico|manifest)$/.test(request.url),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'static-assets',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 250,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          purgeOnQuotaError: true
        })
      ]
    })
  );

  // Offline-Fallback
  workbox.routing.setCatchHandler(({ event }) => {
    if (event.request.destination === 'document') {
      return caches.match('./index.html');
    }
    return Response.error();
  });

} else {
  console.error('❌ Workbox konnte nicht geladen werden!');
}

// ================================================
// Beim Activate: ALLE alten Proxy-Caches aggressiv löschen
// ================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName.includes('proxy') || cacheName.includes('runtime') || !cacheName.startsWith('feuerwehr-verkehr')) {
            console.log('🗑 Lösche alten Proxy-/Runtime-Cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Alle alten Proxy-Caches gelöscht – neuer SW aktiv');
    })
  );
});

console.log('🚀 Workbox SW v5 aktiv – proxy.php wird immer direkt vom Server geladen');