// Simple Service Worker for PWA installation
const CACHE_NAME = 'personal-diary-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let network requests pass through
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
