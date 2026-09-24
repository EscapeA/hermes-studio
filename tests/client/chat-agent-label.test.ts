import { describe, expect, it } from 'vitest'
import { chatSessionAgentLabel } from '@/utils/chat-agent-label'

describe('single chat Agent labels', () => {
  it('shows Ekko before the session loads while preserving legacy Hermes sessions', () => {
    for (const session of [null, undefined]) {
      expect(chatSessionAgentLabel(session)).toEqual({ label: 'Ekko' })
    }
    expect(chatSessionAgentLabel({ source: 'cli' })).toEqual({ label: 'Hermes' })
  })

  it.each([
    ['Hermes', { agent: 'hermes' }],
    ['Ekko', { agent: 'ekko-agent' }],
    ['Ekko', { agent: 'ekko_agent' }],
    ['Claude', { agent: 'claude' }],
    ['Claude', { codingAgentId: 'claude-code' }],
    ['Codex', { codingAgentId: 'codex' }],
    ['DeepSeek Harness', { codingAgentId: 'dsh' }],
    ['Pi', { codingAgentId: 'pi' }],
    ['Grok', { codingAgentId: 'grok' }],
    ['OpenCode', { codingAgentId: 'opencode' }],
  ])('maps session identity to the $label name', (label, session) => {
    expect(chatSessionAgentLabel(session)).toEqual({ label })
  })

  it('keeps legacy Coding Agent sessions without identity on the Claude name', () => {
    expect(chatSessionAgentLabel({ source: 'coding_agent' })).toEqual({ label: 'Claude' })
  })
})
