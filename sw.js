const CACHE_NAME = 'giza-remote-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/styles.css',
  './assets/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k)))))
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Network-first for ESP endpoints; cache-first for app shell
  const isAppAsset = ASSETS.some((path) => new URL(request.url).pathname === path);
  if (isAppAsset) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});


