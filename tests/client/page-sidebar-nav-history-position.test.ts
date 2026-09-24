import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const navSource = readFileSync(
  'packages/client/src/components/layout/PageSidebarNav.vue',
  'utf8',
)
const historyViewSource = readFileSync(
  'packages/client/src/views/hermes/HistoryView.vue',
  'utf8',
)

describe('page sidebar navigation', () => {
  it('places the history entry between search and the Agent manager entry', () => {
    const tabsStart = navSource.indexOf('class="page-sidebar-tabs"')
    const tabsSource = navSource.slice(tabsStart)

    expect(tabsStart).toBeGreaterThan(-1)
    expect(tabsSource.indexOf('@click="openSessionSearch"')).toBeLessThan(tabsSource.indexOf('@click="openHistory"'))
    expect(tabsSource.indexOf('@click="openHistory"')).toBeLessThan(tabsSource.indexOf('@click="openAgentManager"'))
    expect(tabsSource.indexOf('@click="openAgentManager"')).toBeLessThan(tabsSource.indexOf('@click="openModels"'))
    expect(navSource.match(/@click="openHistory"/g)).toHaveLength(1)
    expect(navSource).not.toContain('conversation-switch')
  })

  it('toggles the history entry back to the active session list', () => {
    expect(navSource).toContain("props.active === 'history' ? t('chat.sessions') : t('sidebar.history')")

    const openHistory = navSource.slice(
      navSource.indexOf('function openHistory()'),
      navSource.indexOf('function openAgentManager()'),
    )
    expect(openHistory).toContain("router.push({ name: 'hermes.chat' })")
    expect(openHistory).toContain("router.push({ name: 'hermes.history' })")
  })

  it('renders the page sidebar on the history page', () => {
    const historyNav = historyViewSource.match(/<PageSidebarNav[\s\S]*?\/>/)?.[0] || ''

    expect(historyNav).toContain('active="history"')
    expect(historyNav).not.toContain('hide-mode-switch')
  })
})
