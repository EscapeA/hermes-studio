import type { Message } from '@/stores/hermes/chat'

/**
 * Collapse completed tool messages into per-round cards.
 *
 * Grouping key: the nearest preceding user/command message id (the "round"
 * boundary) instead of runMarker. A single user turn can span multiple
 * backend runs (each tool loop iteration carries its own run_id which the
 * frontend surfaces as runMarker), so keying on runMarker would produce one
 * card per run inside the same task — e.g. "52 次工具调用" and "54 次工具调用"
 * both visible mid-stream. Keying on the input boundary keeps exactly one
 * card per user turn; the count grows as more tools finish.
 */
export function groupCompletedToolsByRun(messages: Message[]): Message[] {
  const toolsByRound = new Map<string, Message[]>()
  const roundMaxIndex = new Map<string, number>()
  let lastBoundaryId: string | null = null
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    if (message.role === 'user' || message.role === 'command') {
      lastBoundaryId = message.id
      continue
    }
    if (message.role !== 'tool' || message.toolStatus === 'running') continue
    const roundKey = lastBoundaryId ?? '__session_start__'
    const tools = toolsByRound.get(roundKey) || []
    tools.push(message)
    toolsByRound.set(roundKey, tools)
    roundMaxIndex.set(roundKey, i)
  }
  if (toolsByRound.size === 0) return messages

  const emittedRounds = new Set<string>()
  const grouped: Message[] = []
  let currentBoundaryId: string | null = null
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    if (message.role === 'user' || message.role === 'command') {
      currentBoundaryId = message.id
      grouped.push(message)
      continue
    }
    const roundKey = currentBoundaryId ?? '__session_start__'
    if (message.role !== 'tool' || message.toolStatus === 'running') {
      grouped.push(message)
      continue
    }
    // Skip earlier completed tools of the same round; emit the collapsed card
    // in place of the LAST completed tool so it stays near the end of the
    // round (and near the live view bottom) instead of being anchored at the
    // first tool call of the round.
    if (i !== roundMaxIndex.get(roundKey)) continue
    if (emittedRounds.has(roundKey)) continue
    emittedRounds.add(roundKey)
    const tools = toolsByRound.get(roundKey)
    if (!tools?.length) {
      grouped.push(message)
      continue
    }
    grouped.push({
      id: `tool-run:round:${roundKey}`,
      role: 'system',
      content: '',
      timestamp: tools[0].timestamp,
      systemType: 'tool-run',
      runMarker: tools[0].runMarker ?? null,
      toolRunId: roundKey,
      toolMessages: tools,
    })
  }
  return grouped
}
