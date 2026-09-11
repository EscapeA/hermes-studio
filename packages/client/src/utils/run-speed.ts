/**
 * Decode-throughput readings for the live run indicator.
 *
 * One reading per finished API call, pushed on `usage.updated`: provider output
 * tokens over the decode wall time (`ended_at - first_chunk_at`). There is no
 * in-flight estimate — a reading is a finished measurement, so the display
 * simply holds the last one while a tool runs or the model is thinking.
 */

export interface RunSpeedReading {
  tokens: number
  elapsedMs: number
}

/**
 * Read a server `speed` payload.
 * @param payload - The event's `speed` field, if any.
 * @returns A reading, or null when the payload carries no usable tokens.
 */
export function toRunSpeedReading(payload: unknown): RunSpeedReading | null {
  if (!payload || typeof payload !== 'object') return null
  const { tokens, elapsedMs } = payload as Record<string, unknown>
  const tokenCount = Number(tokens)
  const elapsed = Number(elapsedMs)
  if (!Number.isFinite(tokenCount) || tokenCount <= 0) return null
  if (!Number.isFinite(elapsed) || elapsed <= 0) return null
  return { tokens: tokenCount, elapsedMs: elapsed }
}

/**
 * Decode speed of a reading.
 * @param reading - Latest reading for the run.
 * @returns Tokens per second, or undefined when the reading cannot be divided.
 */
export function runSpeedTokensPerSecond(reading: RunSpeedReading): number | undefined {
  if (reading.elapsedMs <= 0 || reading.tokens <= 0) return undefined
  return reading.tokens / (reading.elapsedMs / 1000)
}

/**
 * Display number without unit: whole tokens from ten up, one decimal below.
 * @param tps - Tokens per second.
 * @returns The number as shown, negative input clamped to zero.
 */
export function formatTokensPerSecond(tps: number): string {
  const clamped = Math.max(0, tps)
  return clamped >= 10 ? String(Math.round(clamped)) : String(Math.round(clamped * 10) / 10)
}
