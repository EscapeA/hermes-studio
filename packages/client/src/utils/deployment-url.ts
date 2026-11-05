/**
 * Build-time content hashes for brand files (logo, PWA icons, favicon).
 *
 * These files keep stable filenames, so a CDN edge and the browser cache keep
 * serving the previous bytes for the whole `max-age` window after an icon is
 * replaced. Appending the hash as `?v=` gives every release a fresh cache key.
 *
 * Injected by `vite.config.ts`; empty in dev (no hashing needed, no cache).
 */
declare const __BRAND_VERSIONS__: Record<string, string> | undefined

/** Public deployment prefix; root installs and Desktop keep their existing URLs. */
export function deploymentBasePath(): string {
  const base = import.meta.env.BASE_URL || '/'
  return base === '/' ? '' : base.replace(/\/$/, '')
}

function brandVersion(path: string): string | undefined {
  if (typeof __BRAND_VERSIONS__ === 'undefined') return undefined
  return __BRAND_VERSIONS__[path]
}

export function deploymentUrl(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path
  const base = deploymentBasePath()
  const versioned = (url: string) => {
    const hash = brandVersion(path)
    return hash ? `${url}${url.includes('?') ? '&' : '?'}v=${hash}` : url
  }
  if (!base || path === base || path.startsWith(`${base}/`)) return versioned(path)
  return versioned(`${base}${path}`)
}

/** Socket.IO namespaces must not include the deployment path. */
export function socketEndpoint(base: string, namespace: string): { url: string; path: string } {
  if (!base) return { url: namespace, path: '/socket.io' }
  const parsed = new URL(base, typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
  return {
    url: `${parsed.origin}${namespace}`,
    path: `${parsed.pathname.replace(/\/$/, '')}/socket.io`,
  }
}
