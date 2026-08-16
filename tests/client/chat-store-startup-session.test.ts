// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '@/stores/hermes/chat'

const sessionApi = vi.hoisted(() => ({
  fetchSessions: vi.fn(),
  fetchSessionMessagesPage: vi.fn(),
  fetchWorkspaceRunChangesForSession: vi.fn(async () => []),
}))

const chatApi = vi.hoisted(() => ({
  resumeSession: vi.fn((sessionId: string, callback: (data: any) => void) => {
    callback({
      session_id: sessionId,
      messages: [{ id: 1, session_id: sessionId, role: 'user', content: 'hi', timestamp: 1 }],
      isWorking: false,
      events: [],
      messageLoadedCount: 1,
      messageTotal: 1,
      hasMoreBefore: false,
    })
    return {} as any
  }),
}))

vi.mock('@/api/hermes/sessions', () => ({
  archiveSession: vi.fn(),
  deleteSession: vi.fn(),
  fetchSessionMessagesPage: sessionApi.fetchSessionMessagesPage,
  fetchSessions: sessionApi.fetchSessions,
  fetchWorkspaceRunChangesForSession: sessionApi.fetchWorkspaceRunChangesForSession,
  fetchWorkspaceRunChangeFile: vi.fn(async () => null),
  setSessionModel: vi.fn(),
}))

vi.mock('@/api/hermes/chat', () => ({
  startRunViaSocket: vi.fn(() => ({ abort: vi.fn() })),
  resumeSession: chatApi.resumeSession,
  registerSessionHandlers: vi.fn(),
  unregisterSessionHandlers: vi.fn(),
  getChatRunSocket: vi.fn(() => ({ emit: vi.fn() })),
  respondToolApproval: vi.fn(),
  respondClarify: vi.fn(),
  onPeerUserMessage: vi.fn(() => vi.fn()),
  onSessionCommand: vi.fn(() => vi.fn()),
  onSessionTitleUpdated: vi.fn(() => vi.fn()),
  onSessionWorkspaceUpdated: vi.fn(() => vi.fn()),
}))

vi.mock('@/api/client', () => ({ getActiveProfileName: () => 'default' }))
vi.mock('@/api/hermes/download', () => ({ getDownloadUrl: (_path: string, name: string) => `/download/${name}` }))
vi.mock('@/utils/completion-sound', () => ({ primeCompletionSound: vi.fn(), playCompletionSound: vi.fn() }))
vi.mock('@/utils/completion-notification', () => ({ showCompletionNotification: vi.fn() }))
vi.mock('@/utils/session-sync', () => ({ subscribeSessionSync: vi.fn(() => vi.fn()), publishSessionSync: vi.fn() }))

describe('chat store startup session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    setActivePinia(createPinia())
    sessionApi.fetchSessionMessagesPage.mockResolvedValue({
      messages: [{ id: 1, session_id: 'stored-session', role: 'user', content: 'fast', timestamp: 1 }],
      total: 1,
      offset: 0,
      limit: 20,
      hasMore: false,
    })
  })

  it('opens the stored session before the list arrives', async () => {
    localStorage.setItem('hermes_active_session_default', 'stored-session')
    const store = useChatStore()

    await store.openPreferredSession()

    expect(store.activeSessionId).toBe('stored-session')
    expect(store.sessions.some((session: { id: string }) => session.id === 'stored-session')).toBe(true)
    expect(chatApi.resumeSession).toHaveBeenCalled()
  })

  it('does not reload the same session after the list arrives', async () => {
    localStorage.setItem('hermes_active_session_default', 'stored-session')
    sessionApi.fetchSessions
      .mockResolvedValueOnce([{
        id: 'stored-session',
        profile: 'default',
        source: 'cli',
        title: 'Stored',
        started_at: 1,
        last_active: 2,
        message_count: 1,
      }])
      .mockResolvedValueOnce([])

    const store = useChatStore()
    await store.openPreferredSession()
    const resumeCount = chatApi.resumeSession.mock.calls.length

    await store.loadSessions()

    expect(store.activeSessionId).toBe('stored-session')
    expect(store.activeSession?.title).toBe('Stored')
    expect(chatApi.resumeSession.mock.calls.length).toBe(resumeCount)
  })
})
