const ANNOUNCEMENTS_URL = 'https://api.ekkostudio.xyz/api/studio/announcements'

// The upstream announcements service is a third-party call on the app's boot
// path. A 10s timeout means a slow upstream can hold the request (and the
// client's boot sequence) for seconds, so cache per locale and fail fast.
const ANNOUNCEMENTS_TIMEOUT_MS = 3_000
const ANNOUNCEMENTS_TTL_MS = 10 * 60_000
const ANNOUNCEMENTS_RETRY_TTL_MS = 30_000

type CacheEntry = { at: number; ttl: number; value: unknown }
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()

/** Test seam: the module-level cache must not leak between cases. */
export function resetStudioAnnouncementsCache(): void {
  cache.clear()
  inflight.clear()
}

export async function fetchStudioAnnouncements(localeInput: unknown): Promise<unknown> {
  const locale = /^zh(?:[-_]|$)/i.test(String(localeInput || 'en')) ? 'zh-CN' : 'en'
  const cached = cache.get(locale)
  if (cached && Date.now() - cached.at < cached.ttl) return cached.value
  const pending = inflight.get(locale)
  if (pending) return pending

  const request = (async () => {
    const url = new URL(ANNOUNCEMENTS_URL)
    url.searchParams.set('locale', locale)
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(ANNOUNCEMENTS_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error('announcement_fetch_failed')
    const data = await response.json() as { ok?: boolean; platform?: string; list?: unknown }
    if (!data || data.ok !== true || data.platform !== 'desktop' || !Array.isArray(data.list)) {
      throw new Error('invalid_announcement_response')
    }
    cache.set(locale, { at: Date.now(), ttl: ANNOUNCEMENTS_TTL_MS, value: data })
    return data
  })()

  inflight.set(locale, request)
  try {
    return await request
  } catch (error) {
    // A transient upstream failure must not blank the banner: keep serving the
    // last good payload while backing off for the retry window.
    if (cached) {
      cache.set(locale, { ...cached, at: Date.now(), ttl: ANNOUNCEMENTS_RETRY_TTL_MS })
      return cached.value
    }
    throw error
  } finally {
    inflight.delete(locale)
  }
}
