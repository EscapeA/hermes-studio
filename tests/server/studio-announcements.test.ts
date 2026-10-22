import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchStudioAnnouncements, resetStudioAnnouncementsCache } from '../../packages/server/src/modules/studio/services/notifications/announcements'
import { getAnnouncements } from '../../packages/server/src/modules/studio/controllers/announcements'

beforeEach(() => {
  resetStudioAnnouncementsCache()
  vi.useRealTimers()
})
afterEach(() => vi.unstubAllGlobals())

describe('Studio announcement delivery', () => {
  it.each([['zh-TW', 'zh-CN'], ['zh', 'zh-CN'], ['en', 'en'], ['ja', 'en']])('fetches desktop announcements for %s', async (input, expectedLocale) => {
    const data = { ok: true, platform: 'desktop', list: [{ id: 2 }, { id: 1 }] }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchStudioAnnouncements(input)).toEqual(data)
    expect(fetchMock).toHaveBeenCalledWith(`https://api.ekkostudio.xyz/api/studio/announcements?locale=${expectedLocale}`, {
      headers: { Accept: 'application/json' }, signal: expect.any(AbortSignal),
    })
  })

  it.each([
    { ok: true, platform: 'app', list: [] },
    { ok: false, platform: 'desktop', list: [] },
    { ok: true, platform: 'desktop', list: null },
    null,
  ])('rejects a malformed or wrong-platform response', async data => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data))))
    await expect(fetchStudioAnnouncements('en')).rejects.toThrow()
  })

  it('returns a non-auth error for an unavailable announcement service', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))
    const ctx = { query: { locale: 'en' }, set: vi.fn() } as any
    await getAnnouncements(ctx)
    expect(ctx.status).toBe(502)
    expect(ctx.body).toEqual({ ok: false, error: 'announcement_fetch_failed' })
    expect(ctx.set).toHaveBeenCalledWith('Cache-Control', 'no-store')
  })

  // The banner sits on the boot path; a repeat visit must not pay the upstream
  // round-trip again (it used to cost 0.4-1.7s per app load).
  it('serves repeat reads from cache within the TTL', async () => {
    const data = { ok: true, platform: 'desktop', list: [{ id: 1 }] }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchStudioAnnouncements('en')).toEqual(data)
    expect(await fetchStudioAnnouncements('en')).toEqual(data)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps the last good payload when the upstream fails later', async () => {
    const data = { ok: true, platform: 'desktop', list: [{ id: 7 }] }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(data)))
      .mockResolvedValueOnce(new Response('', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchStudioAnnouncements('en')).toEqual(data)
    // Age the entry past the TTL so the second call retries upstream.
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 11 * 60_000)
    expect(await fetchStudioAnnouncements('en')).toEqual(data)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('deduplicates concurrent cold reads', async () => {
    const data = { ok: true, platform: 'desktop', list: [] }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(data)))
    vi.stubGlobal('fetch', fetchMock)
    await Promise.all([fetchStudioAnnouncements('en'), fetchStudioAnnouncements('en')])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
