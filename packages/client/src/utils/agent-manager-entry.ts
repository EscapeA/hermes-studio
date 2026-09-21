import type { RouteLocationRaw } from 'vue-router'

export const AGENT_MANAGER_ENTRY_STORAGE_KEY = 'hermes_agent_manager_entry'

export type AgentManagerEntryId =
  | 'ekko'
  | 'hermes'
  | 'claude-code'
  | 'codex'
  | 'pi'
  | 'grok'
  | 'opencode'
  | 'dsh'

export const AGENT_MANAGER_ENTRY_TARGETS: ReadonlyArray<{ id: AgentManagerEntryId; name: string }> = [
  { id: 'ekko', name: 'Ekko' },
  { id: 'hermes', name: 'Hermes' },
  { id: 'claude-code', name: 'Claude' },
  { id: 'codex', name: 'Codex' },
  { id: 'pi', name: 'Pi' },
  { id: 'grok', name: 'Grok' },
  { id: 'opencode', name: 'OpenCode' },
  { id: 'dsh', name: 'DeepSeek Harness' },
]

export function normalizeAgentManagerEntry(value: unknown): AgentManagerEntryId | '' {
  const candidate = typeof value === 'string' ? value : ''
  return AGENT_MANAGER_ENTRY_TARGETS.some(target => target.id === candidate)
    ? (candidate as AgentManagerEntryId)
    : ''
}

export function getAgentManagerEntry(): AgentManagerEntryId | '' {
  if (typeof window === 'undefined') return ''
  try {
    return normalizeAgentManagerEntry(window.localStorage.getItem(AGENT_MANAGER_ENTRY_STORAGE_KEY))
  } catch {
    return ''
  }
}

export function setAgentManagerEntry(value: unknown): AgentManagerEntryId | '' {
  const normalized = normalizeAgentManagerEntry(value)
  if (typeof window !== 'undefined') {
    if (normalized) window.localStorage.setItem(AGENT_MANAGER_ENTRY_STORAGE_KEY, normalized)
    else window.localStorage.removeItem(AGENT_MANAGER_ENTRY_STORAGE_KEY)
  }
  return normalized
}

export function resolveAgentManagerEntryRoute(value: unknown): RouteLocationRaw | null {
  const id = normalizeAgentManagerEntry(value)
  if (!id) return null
  if (id === 'ekko') return { name: 'ekko.settings' }
  if (id === 'hermes') return { name: 'hermes.configSettings' }
  return { name: 'codingAgent.config', params: { agentId: id, section: 'settings' } }
}
