// Hermes Studio service worker.
//
// Goal: a cold start (browser tab, installed PWA, or a WebView shell) must not
// re-download the app shell when nothing changed on the server. Strategies:
//
//   navigation          -> network-first, fall back to the cached shell, then
//                          to offline.html so a dead server still renders UI
//   hashed build assets -> cache-first (filename carries the content hash)
//   brand / media files -> cache-first + background revalidate (no hash, but
//                          they only change across releases; a SW version bump
//                          clears them)
//   everything else     -> network-first for same-origin static files
//
// Never intercepted: API, WebSocket/Socket.IO, health, upload, webhook. Those
// must always hit the live backend or the app breaks silently.
//
// Update policy: a new worker installs but does NOT skipWaiting on its own.
// Taking over mid-session would swap the hashed asset manifest under a running
// page (lazy chunk imports would 404) and could interrupt an in-flight run. The
// waiting worker activates on the next cold start, which is exactly when a
// stale shell is harmless.

const CACHE_VERSION = 'v2'
const SHELL_CACHE = `ekko-shell-${CACHE_VERSION}`
const ASSET_CACHE = `ekko-assets-${CACHE_VERSION}`
const MEDIA_CACHE = `ekko-media-${CACHE_VERSION}`
const CACHE_PREFIX = 'ekko-'
const KEEP_CACHES = new Set([SHELL_CACHE, ASSET_CACHE, MEDIA_CACHE])

// Served from the SW's own scope so sub-path deployments (STUDIO_BASE_PATH)
// keep working: scope is always a directory path ending in '/'.
const BASE = new URL(self.registration.scope).pathname
const scoped = (path) => `${BASE.replace(/\/$/, '')}${path}`

const SHELL_URL = scoped('/')
const OFFLINE_URL = scoped('/offline.html')
const MANIFEST_URL = scoped('/manifest.webmanifest')

// Brand files: no content hash, stable across a release. Cache-first so the
// 1MB logo never hits the network on a cold start.
const BRAND_PATHS = new Set([
  scoped('/logo.png'),
  scoped('/logo-original.png'),
  scoped('/favicon.ico'),
  scoped('/apple-touch-icon.png'),
  scoped('/icon-192.png'),
  scoped('/icon-512.png'),
  scoped('/manifest.webmanifest'),
  scoped('/logo-loading.css'),
])

const EXCLUDED_PREFIXES = [
  scoped('/api/'),
  scoped('/v1/'),
  scoped('/socket.io'),
  scoped('/health'),
  scoped('/webhook'),
  scoped('/upload'),
]

// Vite output: /assets/js/index-HASH.js, /assets/css/x-HASH.css, /assets/woff2/x-HASH.woff2
const HASHED_ASSET = /\/assets\/[^/]+\/[^/]+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/

function isExcluded(url) {
  if (EXCLUDED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return true
  return url.pathname.startsWith(`${BASE}api/`) || url.pathname.startsWith(`${BASE}socket.io`)
}

function isBrand(url) {
  return BRAND_PATHS.has(url.pathname)
}

function isHashedAsset(url) {
  return HASHED_ASSET.test(url.pathname)
}

/** Pull the entry's own <script>/<link> targets so a fresh install is offline-complete. */
function shellDependencies(html) {
  const urls = new Set()
  const pattern = /(?:src|href)="([^"]+)"/g
  let match = pattern.exec(html)
  while (match) {
    const value = match[1]
    if (/\.(?:js|css)(?:\?|$)/.test(value) && !value.startsWith('http') && !value.startsWith('//')) {
      urls.add(new URL(value, self.location.origin).pathname)
    }
    match = pattern.exec(html)
  }
  return [...urls]
}

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE)
  // Tolerant: one unreachable URL must not block activation, otherwise a single
  // 404 leaves the app with no worker at all.
  await Promise.allSettled([
    cache.add(new Request(SHELL_URL, { cache: 'reload' })),
    cache.add(OFFLINE_URL),
    cache.add(MANIFEST_URL),
  ])
  try {
    const response = await fetch(SHELL_URL, { cache: 'reload' })
    if (!response.ok) return
    await cache.put(SHELL_URL, response.clone())
    const html = await response.text()
    await Promise.allSettled(shellDependencies(html).map((path) => cache.add(path)))
  } catch {
    // Offline install: whatever the static list cached is still usable.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && !KEEP_CACHES.has(key))
        .map((key) => caches.delete(key)),
    )
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

/** Network-first navigation: always prefer a fresh shell, never show a dead page. */
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(SHELL_URL, response.clone())
      return response
    }
    throw new Error(`HTTP ${response.status}`)
  } catch {
    const cached = (await cache.match(SHELL_URL)) || (await cache.match(request))
    if (cached) return cached
    const offline = await cache.match(OFFLINE_URL)
    if (offline) return offline
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}

/** Fire-and-forget refresh; the caller keeps it alive through waitUntil. */
function revalidate(request, cacheName) {
  return (async () => {
    try {
      const response = await fetch(request)
      if (response && response.ok) {
        const cache = await caches.open(cacheName)
        await cache.put(request, response.clone())
      }
      return response
    } catch {
      return null
    }
  })()
}

async function cacheFirst(request, cacheName, refresh) {
  const cached = await caches.match(request, { cacheName })
  if (cached) return cached
  const response = await refresh
  if (response) return response
  return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  if (isExcluded(url)) return
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  if (isHashedAsset(url) || isBrand(url)) {
    // Immutable content: serve from cache and refresh in the background so a
    // re-released brand file still lands without a version bump.
    const refresh = revalidate(request, isBrand(url) ? MEDIA_CACHE : ASSET_CACHE)
    event.waitUntil(refresh)
    event.respondWith(cacheFirst(request, isBrand(url) ? MEDIA_CACHE : ASSET_CACHE, refresh))
    return
  }

  // Unhashed static files (fonts, icons, worker scripts) change rarely.
  const refresh = revalidate(request, MEDIA_CACHE)
  event.waitUntil(refresh)
  event.respondWith(cacheFirst(request, MEDIA_CACHE, refresh))
})

// --- Completion notifications -------------------------------------------------
// Registered on this worker's scope, so notification clicks land here. Kept in
// the app worker on purpose: a second worker on '/' would replace this one and
// silently drop all asset caching.

function safeClickUrl(value) {
  return typeof value === 'string'
    && (value === '/person' || value.startsWith('/person?') || value.startsWith('/hermes/'))
    && !value.includes('..')
    && !value.includes('\\')
    ? value
    : null
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const clickUrl = safeClickUrl(event.notification.data?.clickUrl)
    const target = clickUrl ? `${BASE}#${clickUrl}` : SHELL_URL
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (clickUrl && 'navigate' in client) await client.navigate(target)
      if ('focus' in client) return client.focus()
    }
    if (self.clients.openWindow) return self.clients.openWindow(target)
  })())
})
