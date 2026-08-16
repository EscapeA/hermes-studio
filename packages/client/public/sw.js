// Hermes Studio Service Worker
// Caching strategy: Cache-First for hashed assets, Network-First for navigation, Stale-While-Revalidate for public assets
// v4: drop dead logo-original.png (unreferenced 1.8MB) from cache-first list;
//     v3 added brand assets Cache-First (logo never hits network after first install);
//     v2 added session list API SWR cache; v3 fixes precache robustness + version bump.

const CACHE_VERSION = 'v4';
const STATIC_CACHE = `hermes-static-${CACHE_VERSION}`;
const API_CACHE = `hermes-api-${CACHE_VERSION}`;

// Essential URLs to precache on install
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png',
  '/favicon.ico',
];

// Brand/static resources that are effectively immutable (no content hash in
// filename, but change only across app releases). Cache-First so cold starts
// never hit the network for them; SW version bump clears the cache on activate.
const CACHE_FIRST_PATHS = [
  '/logo.png',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.webmanifest',
  '/offline.html',
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

// Session list endpoints that get SWR caching (fast second-open, then background refresh).
// Exact pathname match only — session detail/messages endpoints must stay network-only.
const SESSION_LIST_PATHS = [
  '/api/hermes/sessions',
  '/api/hermes/sessions/conversations',
];

function isSessionListRequest(url) {
  return SESSION_LIST_PATHS.includes(url.pathname);
}

// Match Vite hashed assets: /assets/js/name-HASH.js, /assets/css/name-HASH.css
function isHashedAsset(url) {
  return url.pathname.match(/\/assets\/(js|css|images|fonts)\/.*-[a-zA-Z0-9_-]{8,}\./);
}

function isCacheFirstAsset(url) {
  return CACHE_FIRST_PATHS.includes(url.pathname);
}

// --- Install: precache essential resources (tolerant: one failure doesn't block activation) ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

// --- Activate: clean up old caches (keep current static + api caches) ---
self.addEventListener('activate', (event) => {
  const keep = new Set([STATIC_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => !keep.has(k)).map(k => caches.delete(k))
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

  // Session list → SWR (serve cache instantly, refresh in background).
  // Matched before the same-origin gate on purpose: cross-origin CORS calls
  // (e.g. CF Pages frontend → tailscale backend) also benefit from SWR.
  if (isSessionListRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE, event));
    return;
  }

  // Never intercept API/WebSocket/Socket.IO
  if (isExcluded(url)) return;

  // Only handle same-origin requests (session list already handled above)
  if (url.origin !== self.location.origin) return;

  if (isHashedAsset(url) || isCacheFirstAsset(url)) {
    // Cache-First for immutable assets (content hash or brand resources)
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

async function staleWhileRevalidate(request, cacheName, event) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);
  // Keep the background refresh alive for the whole SW lifecycle, even when
  // the page already received the cached (stale) response — otherwise the
  // browser may terminate the worker before the refresh completes.
  if (event && fetchPromise) event.waitUntil(fetchPromise);
  return cached || fetchPromise;
}
