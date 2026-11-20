import type { AgentReasoning } from '../../../../../ekko-agent/src/model/types'

/** Replay-preserving reasoning envelope used by the Responses adapters. */
export interface ReasoningCodec {
  encode(reasoning: AgentReasoning): string
  decode(value: unknown): AgentReasoning | undefined
}
