// Simple Service Worker for PWA installation
const CACHE_NAME = 'personal-diary-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Let network requests pass through
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
