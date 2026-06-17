// Hermes Studio Service Worker
// Caching strategy: Cache-First for hashed assets, Network-First for navigation, Stale-While-Revalidate for public assets

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `hermes-static-${CACHE_VERSION}`;

// Essential URLs to precache on install
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png',
  '/favicon.ico',
];

// Paths that must NEVER be intercepted (API, WebSocket, Socket.IO)
const EXCLUDED_PATHS = [
  '/api/',
  '/v1/',
  '/socket.io',
  '/health',
  '/webhook',
  '/upload',
  '/notification-sw.js',
];

function isExcluded(url) {
  return EXCLUDED_PATHS.some(p => url.pathname.startsWith(p));
}

// Match Vite hashed assets: /assets/js/name-HASH.js, /assets/css/name-HASH.css
function isHashedAsset(url) {
  return url.pathname.match(/\/assets\/(js|css|images|fonts)\/.*-[a-zA-Z0-9_-]{8,}\./);
}

// --- Install: precache essential resources ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// --- Activate: clean up old caches ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// --- Fetch: route to appropriate caching strategy ---
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Never intercept API/WebSocket/Socket.IO
  if (isExcluded(url)) return;

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  if (isHashedAsset(url)) {
    // Cache-First for hashed assets (immutable due to hash in filename)
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (url.pathname === '/' || url.pathname === '/index.html') {
    // Network-First for navigation (always try fresh)
    event.respondWith(networkFirst(request, STATIC_CACHE));
  } else {
    // Stale-While-Revalidate for other public assets (fonts, icons, etc.)
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});

// --- Listen for SKIP_WAITING message from client ---
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// --- Caching strategies ---

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback to offline page for navigation requests
    const offline = await caches.match('/offline.html');
    if (offline) return offline;
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}
