export interface ChatAgentLabel {
  label: 'Hermes' | 'Ekko' | 'Claude' | 'Codex' | 'Pi' | 'Grok' | 'OpenCode' | 'DeepSeek Harness'
}

interface ChatAgentSessionIdentity {
  source?: string
  agent?: string
  codingAgentId?: string
}

const AGENT_LABELS = {
  hermes: { label: 'Hermes' },
  'ekko-agent': { label: 'Ekko' },
  'claude-code': { label: 'Claude' },
  codex: { label: 'Codex' },
  pi: { label: 'Pi' },
  grok: { label: 'Grok' },
  opencode: { label: 'OpenCode' },
  dsh: { label: 'DeepSeek Harness' },
} as const satisfies Record<string, ChatAgentLabel>

export function chatSessionAgentLabel(session?: ChatAgentSessionIdentity | null): ChatAgentLabel {
  if (!session) return AGENT_LABELS['ekko-agent']
  const runtime = String(session?.codingAgentId || session?.agent || '').trim().toLowerCase()
  if (runtime === 'ekko-agent' || runtime === 'ekko_agent' || runtime === 'ekko') return AGENT_LABELS['ekko-agent']
  if (runtime === 'claude' || runtime === 'claude-code') return AGENT_LABELS['claude-code']
  if (runtime === 'codex') return AGENT_LABELS.codex
  if (runtime === 'pi') return AGENT_LABELS.pi
  if (runtime === 'grok') return AGENT_LABELS.grok
  if (runtime === 'dsh') return AGENT_LABELS.dsh
  if (runtime === 'opencode') return AGENT_LABELS.opencode
  if (session?.source === 'coding_agent') return AGENT_LABELS['claude-code']
  return AGENT_LABELS.hermes
}
