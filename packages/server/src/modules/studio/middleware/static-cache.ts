export const IMMUTABLE_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const SPA_ENTRY_CACHE_CONTROL = 'no-cache'
// The service worker and the manifest are the update channel: they must be
// revalidated on every load, otherwise a browser keeps a stale worker (and thus
// a stale app shell) forever.
export const SERVICE_WORKER_CACHE_CONTROL = 'no-cache'
// Brand files have no content hash but change only with a release. Without an
// explicit policy `serve` emits `max-age=0`, so every launch re-downloads the
// 1 MB logo — which is exactly the "it loads the frontend again every start"
// symptom on clients where the service worker cannot register (plain-HTTP
// WebView shells, insecure LAN origins).
export const BRAND_ASSET_CACHE_CONTROL = 'public, max-age=86400'

const BRAND_FILES = new Set([
  'logo.png',
  'logo-original.png',
  'favicon.ico',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'logo-loading.css',
])

export function getStaticCacheControl(relativePath: string): string | null {
  const normalizedPath = relativePath.replaceAll('\\', '/').replace(/^\.\//, '')
  if (normalizedPath === 'index.html') return SPA_ENTRY_CACHE_CONTROL
  if (normalizedPath === 'sw.js') return SERVICE_WORKER_CACHE_CONTROL
  if (normalizedPath.endsWith('.webmanifest')) return SERVICE_WORKER_CACHE_CONTROL
  if (normalizedPath.startsWith('assets/')) return IMMUTABLE_ASSET_CACHE_CONTROL
  // offline.html must stay fresh enough to reflect a redeploy, but it is only
  // read by the worker, which handles its own invalidation.
  if (BRAND_FILES.has(normalizedPath)) return BRAND_ASSET_CACHE_CONTROL
  return null
}
