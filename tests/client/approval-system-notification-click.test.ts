import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {runInNewContext} from 'node:vm'
import {transpileModule} from 'typescript'

const read = (path: string) => readFileSync(path, 'utf8')

describe('approval system notification click targets', () => {
  it('allows only the exact Person root alongside existing Hermes routes in both click handlers',()=>{
    const workerAllow=runInNewContext(`${read('packages/client/public/notification-sw.js')}\nsafeClickUrl`,{self:{addEventListener(){}}})
    const main=read('packages/desktop/src/main/index.ts'),start=main.indexOf('function safeNotificationClickUrl(')
    const code=main.slice(start,main.indexOf("ipcMain.handle('hermes-desktop:notify-completion'",start))
    const desktopAllow=runInNewContext(`${transpileModule(code,{}).outputText}\nsafeNotificationClickUrl`)
    for(const allow of [workerAllow,desktopAllow]) {
      expect(allow('/person')).toBe('/person');expect(allow('/hermes/session/s')).toBe('/hermes/session/s')
      for(const path of ['/person-other','/person/../settings','https://example.com/person','/person?url=evil','/hermes/\\evil']) expect(allow(path)).toBeNull()
    }
  })

  it('routes a safe internal target through Service Worker and Electron notification clicks', () => {
    const serviceWorker = read('packages/client/public/notification-sw.js')
    const desktopMain = read('packages/desktop/src/main/index.ts')
    const desktopPreload = read('packages/desktop/src/preload/index.ts')
    const desktopBridge = read('packages/client/src/utils/desktop-bridge.ts')

    expect(serviceWorker).toContain('safeClickUrl(event.notification.data?.clickUrl)')
    expect(serviceWorker).toContain("value.startsWith('/hermes/')")
    expect(serviceWorker).toContain('client.navigate')
    expect(desktopMain).toContain('safeNotificationClickUrl')
    expect(desktopMain).toContain('webUiHashUrl(clickUrl)')
    expect(desktopPreload).toContain('clickUrl?: string')
    expect(desktopBridge).toContain('clickUrl?: string')
  })

})
