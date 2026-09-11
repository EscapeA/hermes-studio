import { describe, expect, it } from 'vitest'
import {
  foldDecodeCallResult,
  settledRunSpeed,
  type RunSpeedFoldState,
} from '../../packages/server/src/modules/studio/services/chat-run/usage'

const RUN_START = 1_700_000_000_000

function newState(runStartedAt = RUN_START): RunSpeedFoldState {
  return { runStartedAt }
}

describe('run decode throughput fold', () => {
  it('divides provider output tokens by the streamed decode span', () => {
    const state = newState()

    foldDecodeCallResult(state, 900, { firstChunkAt: 100.5, endedAt: 110.5 })

    expect(settledRunSpeed(state)).toEqual({ tokens: 900, elapsedMs: 10_000 })
  })

  it('drops calls without a first chunk instead of diluting the ratio', () => {
    const state = newState()

    foldDecodeCallResult(state, 900, { firstChunkAt: 100.5, endedAt: 110.5 })
    // Non-streamed call: large token count, no decode span to divide by.
    foldDecodeCallResult(state, 5000, { firstChunkAt: null, endedAt: 200 })
    foldDecodeCallResult(state, 400, { firstChunkAt: 100.5, endedAt: 103 })

    expect(settledRunSpeed(state)).toEqual({ tokens: 1300, elapsedMs: 12_500 })
  })

  it('reports nothing until a call carries usable timing', () => {
    const state = newState()

    expect(settledRunSpeed(state)).toBeUndefined()

    foldDecodeCallResult(state, 10, { firstChunkAt: undefined, endedAt: undefined })
    expect(settledRunSpeed(state)).toBeUndefined()
  })

  it('rejects zero-length spans and zero-token calls', () => {
    const state = newState()

    foldDecodeCallResult(state, 900, { firstChunkAt: 110.5, endedAt: 110.5 })
    foldDecodeCallResult(state, 0, { firstChunkAt: 100.5, endedAt: 110.5 })

    expect(settledRunSpeed(state)).toBeUndefined()
  })

  it('re-scopes totals when the session state starts a new run', () => {
    const state = newState()
    foldDecodeCallResult(state, 900, { firstChunkAt: 100.5, endedAt: 110.5 })
    expect(settledRunSpeed(state)).toBeDefined()

    state.runStartedAt = RUN_START + 60_000
    foldDecodeCallResult(state, 0, {})

    expect(settledRunSpeed(state)).toBeUndefined()
  })
})
