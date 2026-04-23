import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import Database from 'better-sqlite3'
import type { SearchTerm } from '../../src/shared/ipc-types'
import { writeLLMUsage } from './llmUsage'

const DEFAULT_MODEL = 'claude-sonnet-4-5'

// Adapter list for search term generation.
// Extend this array when real adapters are added.
const ADAPTER_IDS = ['mock']

interface RawTermSet {
  adapter_id: string
  terms: string[]
}

function buildPrompt(intent: string, adapterIds: string[]): string {
  return `You are a job search assistant. Given the user's job search intent, generate a list of effective search query strings for each job board adapter listed.

User intent: "${intent}"

Adapters: ${adapterIds.join(', ')}

Return ONLY a valid JSON array with this exact shape — no markdown, no commentary:
[
  { "adapter_id": "mock", "terms": ["senior backend engineer", "staff software engineer TypeScript", "..."] }
]

Rules:
- 3–6 terms per adapter
- Terms should be specific enough to return relevant results on a job board search field
- Vary phrasing (job title variations, tech keywords, seniority levels)
- No duplicates within an adapter`
}

export async function generateSearchTerms(
  db: Database.Database,
  apiKey: string,
  intent: string,
): Promise<SearchTerm[]> {
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildPrompt(intent, ADAPTER_IDS) }],
  })

  // Write LLM usage
  writeLLMUsage(db, {
    call_type: 'search_term_gen',
    model: DEFAULT_MODEL,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    posting_id: null,
  })

  // Parse response
  const text = response.content.find((b) => b.type === 'text')?.text ?? ''
  let termSets: RawTermSet[]
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) throw new Error('Expected array')
    termSets = parsed as RawTermSet[]
  } catch {
    throw new Error(`Failed to parse search term response: ${text.slice(0, 200)}`)
  }

  // Delete existing llm_generated terms and replace
  const insertStmt = db.prepare(
    `INSERT INTO search_terms (id, adapter_id, term, enabled, source, created_at)
     VALUES (@id, @adapter_id, @term, 1, 'llm_generated', @created_at)`,
  )
  const now = new Date().toISOString()

  const inserted: SearchTerm[] = []

  db.transaction(() => {
    db.prepare(`DELETE FROM search_terms WHERE source = 'llm_generated'`).run()

    for (const set of termSets) {
      if (!set.adapter_id || !Array.isArray(set.terms)) continue
      for (const term of set.terms) {
        if (typeof term !== 'string' || !term.trim()) continue
        const id = randomUUID()
        insertStmt.run({ id, adapter_id: set.adapter_id, term: term.trim(), created_at: now })
        inserted.push({
          id,
          adapter_id: set.adapter_id,
          term: term.trim(),
          enabled: true,
          source: 'llm_generated',
          created_at: now,
        })
      }
    }
  })()

  return inserted
}
