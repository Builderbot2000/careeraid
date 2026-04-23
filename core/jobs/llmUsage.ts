import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

// Token price table (USD per 1M tokens). Update when pricing changes.
const PRICE_TABLE: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
  'claude-opus-4-5': { input: 15.0, output: 75.0 },
  'claude-haiku-4-5': { input: 0.25, output: 1.25 },
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const prices = PRICE_TABLE[model] ?? { input: 3.0, output: 15.0 }
  return (inputTokens * prices.input + outputTokens * prices.output) / 1_000_000
}

export interface LLMUsageInput {
  call_type: 'search_term_gen' | 'affinity_scoring' | 'resume_tailoring'
  model: string
  input_tokens: number
  output_tokens: number
  posting_id: string | null
}

export function writeLLMUsage(db: Database.Database, usage: LLMUsageInput): void {
  const cost = estimateCost(usage.model, usage.input_tokens, usage.output_tokens)
  db.prepare(
    `INSERT INTO llm_usage (id, call_type, model, input_tokens, output_tokens, estimated_cost, called_at, posting_id)
     VALUES (@id, @call_type, @model, @input_tokens, @output_tokens, @estimated_cost, @called_at, @posting_id)`,
  ).run({
    id: randomUUID(),
    call_type: usage.call_type,
    model: usage.model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    estimated_cost: cost,
    called_at: new Date().toISOString(),
    posting_id: usage.posting_id,
  })
}
