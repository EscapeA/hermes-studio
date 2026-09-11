import { describe, expect, it } from 'vitest'
import {
  formatTokensPerSecond,
  runSpeedTokensPerSecond,
  toRunSpeedReading,
} from '@/utils/run-speed'

describe('run speed readings', () => {
  it('reads a server speed payload', () => {
    expect(toRunSpeedReading({ tokens: 900, elapsedMs: 10_000 })).toEqual({
      tokens: 900,
      elapsedMs: 10_000,
    })
  })

  it('rejects payloads that cannot be divided', () => {
    expect(toRunSpeedReading(undefined)).toBeNull()
    expect(toRunSpeedReading({ tokens: 0, elapsedMs: 10_000 })).toBeNull()
    expect(toRunSpeedReading({ tokens: 100, elapsedMs: 0 })).toBeNull()
    expect(toRunSpeedReading({ tokens: 'many', elapsedMs: 10 })).toBeNull()
  })

  it('divides tokens by the measured decode span and never rolls it forward', () => {
    const reading = { tokens: 900, elapsedMs: 10_000 }

    expect(runSpeedTokensPerSecond(reading)).toBe(90)
    // The reading is a finished measurement: nothing about it changes over time,
    // so a tool running or a model thinking cannot drag the displayed number down.
    expect(runSpeedTokensPerSecond(reading)).toBe(90)
    expect(runSpeedTokensPerSecond({ tokens: 100, elapsedMs: 0 })).toBeUndefined()
  })

  it('formats whole tokens from ten up and one decimal below', () => {
    expect(formatTokensPerSecond(42.4)).toBe('42')
    expect(formatTokensPerSecond(9.94)).toBe('9.9')
    expect(formatTokensPerSecond(-3)).toBe('0')
  })
})
