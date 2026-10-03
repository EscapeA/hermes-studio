import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The fork drops the 设备互联 (hermes.connections) entry from both navigation
// surfaces, so upstream's "same monitor + phone outline" assertions no longer
// apply. Keep the readFile smoke coverage, assert the fork's shape instead.
describe('Device connections icon', () => {
  it('keeps the device connections entry out of both navigation surfaces', () => {
    for (const file of ['StudioNavigationRail.vue', 'PageSidebarNav.vue']) {
      const source = readFileSync(`packages/client/src/components/layout/${file}`, 'utf8')
      expect(source).not.toContain("key: 'connections'")
    }
  })
})
