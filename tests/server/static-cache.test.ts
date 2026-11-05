import { describe, expect, it } from 'vitest'
import {
  BRAND_ASSET_CACHE_CONTROL,
  getStaticCacheControl,
  IMMUTABLE_ASSET_CACHE_CONTROL,
  SERVICE_WORKER_CACHE_CONTROL,
  SPA_ENTRY_CACHE_CONTROL,
} from '../../packages/server/src/modules/studio/middleware/static-cache'

describe('getStaticCacheControl', () => {
  it('never caches the SPA entry', () => {
    expect(getStaticCacheControl('index.html')).toBe(SPA_ENTRY_CACHE_CONTROL)
  })

  it('keeps hashed build assets immutable', () => {
    expect(getStaticCacheControl('assets/js/index-abc12345.js')).toBe(IMMUTABLE_ASSET_CACHE_CONTROL)
    expect(getStaticCacheControl('assets/css/app-abc12345.css')).toBe(IMMUTABLE_ASSET_CACHE_CONTROL)
  })

  it('revalidates the service worker and manifest so updates can land', () => {
    // A cached sw.js would pin clients to an old shell indefinitely.
    expect(getStaticCacheControl('sw.js')).toBe(SERVICE_WORKER_CACHE_CONTROL)
    expect(getStaticCacheControl('manifest.webmanifest')).toBe(SERVICE_WORKER_CACHE_CONTROL)
    expect(SERVICE_WORKER_CACHE_CONTROL).toBe('no-cache')
  })

  it('lets brand files be reused across launches', () => {
    // Without this, serve emits max-age=0 and the 1 MB logo is refetched on
    // every start wherever the service worker cannot register (plain HTTP).
    expect(getStaticCacheControl('logo.png')).toBe(BRAND_ASSET_CACHE_CONTROL)
    expect(getStaticCacheControl('icon-192.png')).toBe(BRAND_ASSET_CACHE_CONTROL)
    expect(BRAND_ASSET_CACHE_CONTROL).toContain('max-age=86400')
  })

  it('leaves other public files to the default heuristic', () => {
    expect(getStaticCacheControl('offline.html')).toBeNull()
    expect(getStaticCacheControl('coding-agents/agent.json')).toBeNull()
  })

  it('normalizes windows separators and a leading ./', () => {
    expect(getStaticCacheControl('.\\assets\\js\\index-abc12345.js')).toBe(IMMUTABLE_ASSET_CACHE_CONTROL)
    expect(getStaticCacheControl('./sw.js')).toBe(SERVICE_WORKER_CACHE_CONTROL)
  })
})
