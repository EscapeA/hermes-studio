// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  AGENT_MANAGER_ENTRY_STORAGE_KEY,
  getAgentManagerEntry,
  normalizeAgentManagerEntry,
  resolveAgentManagerEntryRoute,
  setAgentManagerEntry,
} from '@/utils/agent-manager-entry'

describe('agent manager entry preference', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('stores and reads a known agent id', () => {
    expect(getAgentManagerEntry()).toBe('')

    expect(setAgentManagerEntry('hermes')).toBe('hermes')
    expect(window.localStorage.getItem(AGENT_MANAGER_ENTRY_STORAGE_KEY)).toBe('hermes')
    expect(getAgentManagerEntry()).toBe('hermes')
  })

  it('falls back to the default for unknown or cleared values', () => {
    window.localStorage.setItem(AGENT_MANAGER_ENTRY_STORAGE_KEY, 'unknown-agent')
    expect(getAgentManagerEntry()).toBe('')
    expect(normalizeAgentManagerEntry(null)).toBe('')

    expect(setAgentManagerEntry('unknown-agent')).toBe('')
    expect(window.localStorage.getItem(AGENT_MANAGER_ENTRY_STORAGE_KEY)).toBeNull()

    setAgentManagerEntry('dsh')
    expect(setAgentManagerEntry('')).toBe('')
    expect(window.localStorage.getItem(AGENT_MANAGER_ENTRY_STORAGE_KEY)).toBeNull()
  })

  it('resolves routes for every supported target', () => {
    expect(resolveAgentManagerEntryRoute('')).toBeNull()
    expect(resolveAgentManagerEntryRoute('unknown-agent')).toBeNull()
    expect(resolveAgentManagerEntryRoute('ekko')).toEqual({ name: 'ekko.settings' })
    expect(resolveAgentManagerEntryRoute('hermes')).toEqual({ name: 'hermes.configSettings' })
    expect(resolveAgentManagerEntryRoute('claude-code')).toEqual({
      name: 'codingAgent.config',
      params: { agentId: 'claude-code', section: 'settings' },
    })
    expect(resolveAgentManagerEntryRoute('dsh')).toEqual({
      name: 'codingAgent.config',
      params: { agentId: 'dsh', section: 'settings' },
    })
  })
})
