import { beforeEach, describe, expect, it, vi } from 'vitest'
import { extractTextForPreview } from '../../packages/server/src/modules/studio/services/chat-run/content-blocks'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getFirstSessionMessageByRole: vi.fn(),
  getSessionMessageCountByRole: vi.fn(),
  updateSession: vi.fn(),
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  bridgeLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../packages/server/src/modules/studio/repositories/session-store', () => ({
  getSession: mocks.getSession,
  getFirstSessionMessageByRole: mocks.getFirstSessionMessageByRole,
  getSessionMessageCountByRole: mocks.getSessionMessageCountByRole,
  updateSession: mocks.updateSession,
}))

vi.mock('../../packages/server/src/modules/studio/public/logging', () => ({
  logger: mocks.logger,
  bridgeLogger: mocks.bridgeLogger,
}))

describe('syncBridgeGeneratedTitle', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.getSession.mockReturnValue({
      id: 'session-1',
      source: 'cli',
      title: '帮忙检查并扩充该笔记。',
      preview: '检查完成。',
    })
    mocks.getFirstSessionMessageByRole.mockReturnValue({
      content: JSON.stringify([
        { type: 'text', text: '帮忙检查并扩充该笔记。' },
        { type: 'image', source: { type: 'base64', data: 'image-data' } },
      ]),
    })
  })

  it('replaces the extracted content-block title with the generated title', async () => {
    const { syncBridgeGeneratedTitle } = await import('../../packages/server/src/modules/studio/services/chat-run/handle-bridge-run')
    const emit = vi.fn()

    expect(syncBridgeGeneratedTitle('session-1', '检查并扩充 SRAM 笔记。', emit)).toBe(true)
    expect(mocks.updateSession).toHaveBeenCalledWith('session-1', expect.objectContaining({ title: '检查并扩充 SRAM 笔记。' }))
    expect(emit).toHaveBeenCalledWith('session.title.updated', expect.objectContaining({ title: '检查并扩充 SRAM 笔记。' }))
  })

  it('does not replace a manually chosen title', async () => {
    mocks.getSession.mockReturnValue({
      id: 'session-1',
      source: 'cli',
      title: 'Pinned research notes',
      preview: '帮忙检查并扩充该笔记。',
    })
    const { syncBridgeGeneratedTitle } = await import('../../packages/server/src/modules/studio/services/chat-run/handle-bridge-run')

    expect(syncBridgeGeneratedTitle('session-1', 'Generated title', vi.fn())).toBe(false)
    expect(mocks.updateSession).not.toHaveBeenCalled()
  })

  it.each([
    'Explain this JSON content block',
    'Explain this JSON content block. '.repeat(8),
  ])('preserves generated titles for a plain-text JSON prompt: %s', async (text) => {
    const input = JSON.stringify([{ type: 'text', text }])
    const title = extractTextForPreview(input).replace(/[\r\n]/g, ' ').substring(0, 100)
    mocks.getSession.mockReturnValue({ id: 'session-1', source: 'cli', title, preview: '' })
    mocks.getFirstSessionMessageByRole.mockReturnValue({ content: input })
    const { syncBridgeGeneratedTitle } = await import('../../packages/server/src/modules/studio/services/chat-run/handle-bridge-run')
    const emit = vi.fn()

    expect(syncBridgeGeneratedTitle('session-1', 'JSON content block explained', emit)).toBe(true)
    expect(mocks.updateSession).toHaveBeenCalledWith('session-1', expect.objectContaining({ title: 'JSON content block explained' }))
    expect(emit).toHaveBeenCalledWith('session.title.updated', expect.objectContaining({ title: 'JSON content block explained' }))
  })

  it.each(['\n\n', '\r\n', '   ', '\t\t'])('replaces a truncated attachment title containing %j', async (separator) => {
    const input = [{ type: 'text' as const, text: 'A'.repeat(50) + separator + 'B'.repeat(80) }]
    const title = extractTextForPreview(input).replace(/[\r\n]/g, ' ').substring(0, 100)
    const blocks = [...input, { type: 'file', name: 'notes.md', path: '/tmp/notes.md', media_type: 'text/markdown' }]
    mocks.getSession.mockReturnValue({ id: 'session-1', source: 'cli', title, preview: '' })
    mocks.getFirstSessionMessageByRole.mockReturnValue({ content: JSON.stringify(blocks) })
    const { syncBridgeGeneratedTitle } = await import('../../packages/server/src/modules/studio/services/chat-run/handle-bridge-run')

    expect(syncBridgeGeneratedTitle('session-1', 'Notes summary', vi.fn())).toBe(true)
    expect(mocks.updateSession).toHaveBeenCalledWith('session-1', expect.objectContaining({ title: 'Notes summary' }))
  })

  // Hermes Agent's instant title (agent/title_generator.derive_title) is the first 48
  // characters plus a single-character ellipsis. A bridge session that started before the
  // title-event lane was wired stores exactly that, and it must still be replaceable.
  it.each([
    '看'.repeat(60),
    'A'.repeat(60),
    'x'.repeat(47) + ' ' + 'y'.repeat(60),
  ])('replaces the Agent instant 48-char ellipsis title derived from %j', async (opener) => {
    const instantTitle = `${opener.replace(/\s+/g, ' ').trim().slice(0, 48)}\u2026`
    mocks.getSession.mockReturnValue({ id: 'session-1', source: 'cli', title: instantTitle, preview: '' })
    mocks.getFirstSessionMessageByRole.mockReturnValue({ content: opener })
    const { syncBridgeGeneratedTitle } = await import('../../packages/server/src/modules/studio/services/chat-run/handle-bridge-run')
    const emit = vi.fn()

    expect(syncBridgeGeneratedTitle('session-1', 'Generated summary title', emit)).toBe(true)
    expect(mocks.updateSession).toHaveBeenCalledWith('session-1', expect.objectContaining({ title: 'Generated summary title' }))
    expect(emit).toHaveBeenCalledWith('session.title.updated', expect.objectContaining({ title: 'Generated summary title' }))
  })

  it('still refuses to overwrite a manually renamed title', async () => {
    mocks.getSession.mockReturnValue({
      id: 'session-1',
      source: 'cli',
      title: '手动改过的标题',
      preview: '',
    })
    mocks.getFirstSessionMessageByRole.mockReturnValue({ content: 'y'.repeat(200) })
    const { syncBridgeGeneratedTitle } = await import('../../packages/server/src/modules/studio/services/chat-run/handle-bridge-run')

    expect(syncBridgeGeneratedTitle('session-1', 'Generated summary title', vi.fn())).toBe(false)
    expect(mocks.updateSession).not.toHaveBeenCalled()
  })

  // A short opening message makes the Agent's instant (derived) title identical to the local
  // first-message preview. syncBridgeGeneratedTitle then reports "no change" — the poll must
  // keep waiting for the model upgrade instead of ending on that no-op.
  it('keeps polling when the instant title equals the local title, then applies the upgrade', async () => {
    const opener = '只回 ok'
    mocks.getSession.mockReturnValue({ id: 'session-1', source: 'cli', title: opener, preview: '' })
    mocks.getFirstSessionMessageByRole.mockReturnValue({ content: opener })
    mocks.getSessionMessageCountByRole.mockReturnValue(1)
    const { pollBridgeGeneratedTitleAfterRun } = await import('../../packages/server/src/modules/studio/services/chat-run/handle-bridge-run')
    // First poll returns the instant title (a no-op), second returns the model upgrade.
    mocks.getSession
      .mockReturnValueOnce({ id: 'session-1', source: 'cli', title: opener, preview: '' })
      .mockReturnValueOnce({ id: 'session-1', source: 'cli', title: opener, preview: '' })
      .mockReturnValue({ id: 'session-1', source: 'cli', title: opener, preview: '' })
    const bridge = {
      getSessionTitle: vi.fn()
        .mockResolvedValueOnce({ ok: true, session_id: 'session-1', title: opener })
        .mockResolvedValueOnce({ ok: true, session_id: 'session-1', title: '模型升级后的标题' }),
    } as any
    const emit = vi.fn()

    await pollBridgeGeneratedTitleAfterRun(bridge, 'session-1', 'default', emit)

    expect(bridge.getSessionTitle.mock.calls.length).toBeGreaterThan(1)
    expect(emit).toHaveBeenCalledWith('session.title.updated', expect.objectContaining({ title: '模型升级后的标题' }))
    expect(mocks.updateSession).toHaveBeenCalledWith('session-1', expect.objectContaining({ title: '模型升级后的标题' }))
  }, 15_000)
})
