import type { Message } from '@/stores/hermes/chat'

export function groupCompletedToolsByRun(messages: Message[]): Message[] {
  const toolsByRun = new Map<string, Message[]>()
  const runMaxIndex = new Map<string, number>()
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    const runId = message.role === 'tool' && message.toolStatus !== 'running'
      ? message.runMarker?.trim()
      : undefined
    if (!runId) continue
    const tools = toolsByRun.get(runId) || []
    tools.push(message)
    toolsByRun.set(runId, tools)
    runMaxIndex.set(runId, i)
  }
  if (toolsByRun.size === 0) return messages

  const emittedRuns = new Set<string>()
  const grouped: Message[] = []
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    const runId = message.role === 'tool' && message.toolStatus !== 'running'
      ? message.runMarker?.trim()
      : undefined
    if (!runId) {
      grouped.push(message)
      continue
    }
    // Skip earlier completed tools of the same run; emit the collapsed card in
    // place of the LAST completed tool so it stays near the end of the run
    // (and near the live view bottom) instead of being anchored at the first
    // tool call of the run.
    if (i !== runMaxIndex.get(runId)) continue
    if (emittedRuns.has(runId)) continue
    emittedRuns.add(runId)
    const tools = toolsByRun.get(runId)
    if (!tools?.length) {
      grouped.push(message)
      continue
    }
    grouped.push({
      id: `tool-run:${runId}`,
      role: 'system',
      content: '',
      timestamp: tools[0].timestamp,
      systemType: 'tool-run',
      runMarker: runId,
      toolRunId: runId,
      toolMessages: tools,
    })
  }
  return grouped
}