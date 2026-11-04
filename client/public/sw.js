// Personal Diary SW v3 — offline app shell + faster repeat loads
const STATIC_CACHE = 'diary-static-v3';
const API_CACHE = 'diary-api-v3';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k !== STATIC_CACHE && k !== API_CACHE ? caches.delete(k) : null))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// Static assets: cache-first, then network + update cache (instant on repeat visits)
async function staticFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // Revalidate in background without blocking
    fetch(request).then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
    }).catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    // Navigation fallback for offline
    if (request.mode === 'navigate') {
      const fallback = await cache.match('/index.html');
      if (fallback) return fallback;
    }
    throw new Error('offline');
  }
}

// API GET: network-first with cached fallback (offline viewing of last-loaded entries)
async function apiFirst(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('offline');
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // API calls — only cacheable GETs, never auth refresh/login
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.includes('/auth/')) return; // always network
    event.respondWith(apiFirst(request).catch(() => fetch(request).catch(() => new Response('[]', { status: 503 }))));
    return;
  }

  // Same-origin static (JS/CSS/images/fonts + navigations)
  if (url.origin === self.location.origin) {
    event.respondWith(staticFirst(request));
  }
});
