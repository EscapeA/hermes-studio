/**
 * Usage calculation — token counting from DB messages,
 * snapshot-aware computation, client notification.
 */

import {
  getSessionDetail,
} from '../../../db/hermes/session-store'
import { deleteCompressionSnapshot, getCompressionSnapshot } from '../../../db/hermes/compression-snapshot'
import { getRecordedUsageTotals, getUsage } from '../../../db/hermes/usage-store'
import { countTokens, SUMMARY_PREFIX } from '../../../lib/context-compressor'
import { truncateToolResultForContext } from '../../../lib/tool-result-context'
import { logger } from '../../logger'
import { assembleCursorSnapshotHistory, readCursorSnapshotParts } from './context-history'
import type { SessionState } from './types'

type UsageTokenMessage = {
  role?: string
  content?: unknown
  tool_calls?: unknown
}

function contentToUsageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!content) return ''
  if (Array.isArray(content)) {
    return content.map((block: any) => {
      if (typeof block?.text === 'string') return block.text
      if (typeof block?.type === 'string') return `[${block.type}]`
      return String(block || '')
    }).join('\n')
  }
  return String(content)
}

export function estimateUsageTokensFromMessages(messages: UsageTokenMessage[]): { inputTokens: number; outputTokens: number } {
  const inputTokens = messages
    .filter(m => m.role === 'user')
    .reduce((sum, m) => sum + countTokens(contentToUsageText(m.content)), 0)
  const outputTokens = messages
    .filter(m => m.role === 'assistant' || m.role === 'tool')
    .reduce((sum, m) => sum + countTokens(contentToUsageText(m.content)) + countTokens(String(m.tool_calls || '')), 0)
  return { inputTokens, outputTokens }
}

export async function calcAndUpdateUsage(
  sid: string,
  state: SessionState,
  emit: (event: string, payload: any) => void,
  options: {
    truncateToolResultsForContext?: boolean
    nativeSource?: 'coding_agent'
  } = {},
): Promise<{
  inputTokens: number
  outputTokens: number
  contextInputTokens?: number
  contextOutputTokens?: number
}> {
  try {
    if (options.nativeSource) {
      const totals = getRecordedUsageTotals(sid, options.nativeSource)
      const latest = getUsage(sid)
      const usage = {
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
      }
      state.inputTokens = usage.inputTokens
      state.outputTokens = usage.outputTokens
      emit('usage.updated', {
        event: 'usage.updated',
        session_id: sid,
        ...usage,
      })
      return {
        ...usage,
        ...(latest
          ? {
              contextInputTokens: Number(latest.input_tokens || 0),
              contextOutputTokens: Number(latest.output_tokens || 0),
            }
          : {}),
      }
    }

    const snapshot = getCompressionSnapshot(sid)
    if (snapshot?.compressedThroughMessageId != null) {
      const cursorRead = readCursorSnapshotParts(sid, snapshot, {
        truncateToolResults: false,
      })
      if (cursorRead.status === 'usable') {
        const messages = assembleCursorSnapshotHistory(snapshot, cursorRead.parts, SUMMARY_PREFIX)
        const usage = estimateUsageTokensFromMessages(messages)
        let contextUsage: { inputTokens: number; outputTokens: number } | undefined
        if (options.truncateToolResultsForContext) {
          const contextRead = readCursorSnapshotParts(sid, snapshot, {
            truncateToolResults: true,
          })
          if (contextRead.status === 'usable') {
            contextUsage = estimateUsageTokensFromMessages(
              assembleCursorSnapshotHistory(snapshot, contextRead.parts, SUMMARY_PREFIX),
            )
          }
        }
        state.inputTokens = usage.inputTokens
        state.outputTokens = usage.outputTokens
        emit('usage.updated', {
          event: 'usage.updated',
          session_id: sid,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        })
        return {
          ...usage,
          ...(contextUsage
            ? {
                contextInputTokens: contextUsage.inputTokens,
                contextOutputTokens: contextUsage.outputTokens,
              }
            : {}),
        }
      }
      if (cursorRead.status === 'invalid') {
        logger.warn(
          '[chat-run-socket] invalid cursor snapshot while calculating usage for session %s (%s)',
          sid,
          cursorRead.reason,
        )
        deleteCompressionSnapshot(sid)
      }
    }

    const detail = getSessionDetail(sid)
    const storedMessages = detail?.messages
      ?.filter(m => m.role === 'user' || m.role === 'assistant' || m.role === 'tool') || []
    const estimateSnapshotUsage = (messages: typeof storedMessages) => {
      if (snapshot && messages.length && snapshot.lastMessageIndex >= 0 && snapshot.lastMessageIndex < messages.length) {
        const newMessages = messages.slice(snapshot.lastMessageIndex + 1)
        const newUsage = estimateUsageTokensFromMessages(newMessages)
        return {
          inputTokens: countTokens(SUMMARY_PREFIX + snapshot.summary) + newUsage.inputTokens,
          outputTokens: newUsage.outputTokens,
        }
      }
      return estimateUsageTokensFromMessages(messages)
    }
    const usage = estimateSnapshotUsage(storedMessages)
    const contextUsage = options.truncateToolResultsForContext
      ? estimateSnapshotUsage(storedMessages.map(message => message.role === 'tool'
        ? { ...message, content: truncateToolResultForContext(message.content || '') }
        : message))
      : undefined
    state.inputTokens = usage.inputTokens
    state.outputTokens = usage.outputTokens
    emit('usage.updated', {
      event: 'usage.updated',
      session_id: sid,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    })
    return {
      ...usage,
      ...(contextUsage
        ? {
            contextInputTokens: contextUsage.inputTokens,
            contextOutputTokens: contextUsage.outputTokens,
          }
        : {}),
    }
  } catch (err: any) {
    logger.warn(err, '[chat-run-socket] failed to calculate usage for session %s', sid)
    return { inputTokens: 0, outputTokens: 0 }
  }
}

export function updateContextTokenUsage(
  sid: string,
  state: SessionState,
  emit: (event: string, payload: any) => void,
  contextTokens: number | null | undefined,
  usage?: { inputTokens: number; outputTokens: number },
): number | undefined {
  if (typeof contextTokens !== 'number' || !Number.isFinite(contextTokens) || contextTokens < 0) {
    return state.contextTokens
  }
  const normalizedContextTokens = Math.floor(contextTokens)
  state.contextTokens = normalizedContextTokens
  emit('usage.updated', {
    event: 'usage.updated',
    session_id: sid,
    inputTokens: usage?.inputTokens ?? state.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? state.outputTokens ?? 0,
    contextTokens: normalizedContextTokens,
  })
  return normalizedContextTokens
}


/** Full context occupancy from Hermes model.usage (log "in=" / prompt_tokens). */
export function resolveApiPromptTokens(rawUsage: unknown, normalized?: { inputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number }): number | undefined {
  const root = rawUsage && typeof rawUsage === 'object' && !Array.isArray(rawUsage)
    ? rawUsage as Record<string, any>
    : {}
  const nested = root.usage && typeof root.usage === 'object' && !Array.isArray(root.usage)
    ? root.usage as Record<string, any>
    : root
  const candidates = [
    nested.prompt_tokens,
    nested.promptTokens,
    nested.total_tokens != null && nested.completion_tokens != null
      ? Number(nested.total_tokens) - Number(nested.completion_tokens)
      : undefined,
    nested.totalTokens != null && nested.completionTokens != null
      ? Number(nested.totalTokens) - Number(nested.completionTokens)
      : undefined,
  ]
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value)
    if (typeof value === 'string' && value.trim()) {
      const n = Number(value)
      if (Number.isFinite(n) && n >= 0) return Math.floor(n)
    }
  }
  // CanonicalUsage from agent hook: input is uncached; full prompt = input+cache_read+cache_write
  if (normalized) {
    const uncached = Math.max(0, Math.floor(normalized.inputTokens || 0))
    const cacheRead = Math.max(0, Math.floor(normalized.cacheReadTokens || 0))
    const cacheWrite = Math.max(0, Math.floor(normalized.cacheWriteTokens || 0))
    const sum = uncached + cacheRead + cacheWrite
    if (sum > 0) return sum
  }
  // raw canonical fields without prompt_tokens key
  const uncached = Number(nested.input_tokens ?? nested.inputTokens)
  const cacheRead = Number(nested.cache_read_tokens ?? nested.cacheReadTokens ?? 0)
  const cacheWrite = Number(nested.cache_write_tokens ?? nested.cacheWriteTokens ?? 0)
  if (Number.isFinite(uncached) && uncached >= 0) {
    const sum = Math.floor(uncached) + (Number.isFinite(cacheRead) && cacheRead > 0 ? Math.floor(cacheRead) : 0)
      + (Number.isFinite(cacheWrite) && cacheWrite > 0 ? Math.floor(cacheWrite) : 0)
    if (sum > 0) return sum
  }
  return undefined
}

export function applyApiPromptContextTokens(
  sid: string,
  state: SessionState,
  emit: (event: string, payload: any) => void,
  promptTokens: number | null | undefined,
  usage?: { inputTokens: number; outputTokens: number },
): number | undefined {
  if (typeof promptTokens !== 'number' || !Number.isFinite(promptTokens) || promptTokens < 0) {
    return state.contextTokens
  }
  const normalized = Math.floor(promptTokens)
  state.apiPromptTokens = normalized
  return updateContextTokenUsage(sid, state, emit, normalized, usage)
}

export function clearApiPromptContextTokens(state: SessionState): void {
  state.apiPromptTokens = undefined
}

export function hasApiPromptContextTokens(state: SessionState): boolean {
  return typeof state.apiPromptTokens === 'number'
    && Number.isFinite(state.apiPromptTokens)
    && state.apiPromptTokens >= 0
}

export function getCachedBridgeContextOverhead(state: SessionState): number | undefined {
  const fixedContextTokens = state.bridgeContext?.fixedContextTokens
  if (typeof fixedContextTokens !== 'number' || !Number.isFinite(fixedContextTokens) || fixedContextTokens < 0) {
    return undefined
  }
  return Math.floor(fixedContextTokens)
}

export function contextTokensWithCachedOverhead(state: SessionState, messageTokens: number): number {
  const normalizedMessageTokens = Math.max(0, Math.floor(messageTokens))
  const fixedContextTokens = getCachedBridgeContextOverhead(state)
  return fixedContextTokens == null
    ? normalizedMessageTokens
    : fixedContextTokens + normalizedMessageTokens
}

export function updateMessageContextTokenUsage(
  sid: string,
  state: SessionState,
  emit: (event: string, payload: any) => void,
  messageTokens: number | null | undefined,
  usage?: { inputTokens: number; outputTokens: number },
): number | undefined {
  // Prefer real API prompt_tokens over local message/fixed estimates for the UI meter.
  if (hasApiPromptContextTokens(state)) {
    return state.contextTokens
  }
  if (typeof messageTokens !== 'number' || !Number.isFinite(messageTokens) || messageTokens < 0) {
    return state.contextTokens
  }
  return updateContextTokenUsage(
    sid,
    state,
    emit,
    contextTokensWithCachedOverhead(state, messageTokens),
    usage,
  )
}
