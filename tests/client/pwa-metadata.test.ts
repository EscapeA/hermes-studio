import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

describe('PWA metadata', () => {
  it('links manifest and touch icon from the client shell', () => {
    const html = readFileSync('packages/client/index.html', 'utf8')

    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"')
    expect(html).toContain('rel="apple-touch-icon" href="/icon-192.png"')
    expect(html).toContain('name="apple-mobile-web-app-title" content="Hermes"')
    expect(html).toContain('name="mobile-web-app-capable"')
    expect(html).toContain('name="apple-mobile-web-app-capable"')
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style"')
  })

  it('ships a standalone web manifest with proper icons', () => {
    const manifest = JSON.parse(readFileSync('packages/client/public/manifest.webmanifest', 'utf8'))

    expect(manifest.name).toBe('Hermes Studio')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
    expect(manifest.orientation).toBe('portrait-primary')
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }),
      expect.objectContaining({ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }),
    ]))
  })
})
