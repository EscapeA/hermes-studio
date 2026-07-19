import { describe, expect, it, vi } from 'vitest'
import {
  applyApiPromptContextTokens,
  clearApiPromptContextTokens,
  hasApiPromptContextTokens,
  resolveApiPromptTokens,
  updateMessageContextTokenUsage,
} from '../../packages/server/src/services/hermes/run-chat/usage'
import type { SessionState } from '../../packages/server/src/services/hermes/run-chat/types'

function makeState(partial: Partial<SessionState> = {}): SessionState {
  return {
    messages: [],
    isWorking: false,
    events: [],
    queue: [],
    ...partial,
  }
}

describe('API prompt_tokens context usage', () => {
  it('applies prompt_tokens as contextTokens and marks apiPromptTokens', () => {
    const state = makeState()
    const emit = vi.fn()
    const result = applyApiPromptContextTokens('s1', state, emit, 153386, {
      inputTokens: 10,
      outputTokens: 2,
    })
    expect(result).toBe(153386)
    expect(state.apiPromptTokens).toBe(153386)
    expect(state.contextTokens).toBe(153386)
    expect(emit).toHaveBeenCalledWith('usage.updated', expect.objectContaining({
      session_id: 's1',
      contextTokens: 153386,
      inputTokens: 10,
      outputTokens: 2,
    }))
  })

  it('uses the latest prompt_tokens when applied repeatedly', () => {
    const state = makeState()
    const emit = vi.fn()
    applyApiPromptContextTokens('s1', state, emit, 1000)
    applyApiPromptContextTokens('s1', state, emit, 153386)
    expect(state.contextTokens).toBe(153386)
    expect(state.apiPromptTokens).toBe(153386)
  })

  it('blocks local message estimates after real API prompt is known', () => {
    const state = makeState({ bridgeContext: { fixedContextTokens: 20_000 } })
    const emit = vi.fn()
    applyApiPromptContextTokens('s1', state, emit, 153386)
    emit.mockClear()
    const kept = updateMessageContextTokenUsage('s1', state, emit, 18, {
      inputTokens: 1,
      outputTokens: 1,
    })
    expect(kept).toBe(153386)
    expect(state.contextTokens).toBe(153386)
    expect(emit).not.toHaveBeenCalled()
  })


  it('resolves full prompt_tokens from Hermes canonical usage (uncached + cache)', () => {
    // mirrors agent log: in=158201 cache=156416/158201 → uncached input=1785
    expect(resolveApiPromptTokens({
      input_tokens: 1785,
      output_tokens: 171,
      cache_read_tokens: 156416,
      cache_write_tokens: 0,
      prompt_tokens: 158201,
      total_tokens: 158372,
    })).toBe(158201)

    // without explicit prompt_tokens, sum buckets
    expect(resolveApiPromptTokens({
      input_tokens: 1785,
      output_tokens: 171,
      cache_read_tokens: 156416,
    })).toBe(158201)

    // via normalized CanonicalUsage-like object
    expect(resolveApiPromptTokens(
      { input_tokens: 1785, cache_read_tokens: 156416 },
      { inputTokens: 1785, cacheReadTokens: 156416, cacheWriteTokens: 0 },
    )).toBe(158201)
  })
  it('allows local estimates again after clearApiPromptContextTokens', () => {
    const state = makeState({ bridgeContext: { fixedContextTokens: 100 } })
    const emit = vi.fn()
    applyApiPromptContextTokens('s1', state, emit, 153386)
    clearApiPromptContextTokens(state)
    expect(hasApiPromptContextTokens(state)).toBe(false)
    const next = updateMessageContextTokenUsage('s1', state, emit, 50)
    expect(next).toBe(150)
    expect(state.contextTokens).toBe(150)
  })
})
