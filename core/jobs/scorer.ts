import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import Database from 'better-sqlite3'
import type { JobPosting } from './adapters/base'
import { writeLLMUsage } from './llmUsage'

const DEFAULT_MODEL = 'claude-sonnet-4-5'
// Chars-per-token approximation for budget estimation
const CHARS_PER_TOKEN = 4
// Fixed prompt overhead tokens per batch
const PROMPT_OVERHEAD_TOKENS = 800

const AffinityItemSchema = z.object({
  posting_id: z.string(),
  affinity_score: z.number().min(0).max(1),
  reasoning: z.string(),
})

type AffinityItem = z.infer<typeof AffinityItemSchema>

function buildScoringPrompt(
  postings: Pick<JobPosting, 'id' | 'title' | 'company' | 'raw_text'>[],
  intent: string,
): string {
  const items = postings
    .map((p) => {
      const text = p.raw_text?.slice(0, 1200) ?? `${p.title} at ${p.company}`
      return `---\nposting_id: ${p.id}\ntitle: ${p.title}\ncompany: ${p.company}\ndescription: ${text}`
    })
    .join('\n')

  return `You are a job fit evaluator. Score each job posting for affinity with the user's search intent.

User intent: "${intent}"

Job postings:
${items}

Return ONLY a valid JSON array — no markdown, no commentary:
[
  { "posting_id": "uuid", "affinity_score": 0.0–1.0, "reasoning": "one-sentence explanation" }
]

Scoring guide:
- 0.9–1.0: Excellent fit — role, seniority, and tech stack closely match intent
- 0.6–0.8: Good fit — most criteria match with minor gaps
- 0.3–0.5: Partial fit — some relevant aspects but significant mismatches
- 0.0–0.2: Poor fit — fundamentally misaligned with intent`
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

export async function scorePostings(
  db: Database.Database,
  apiKey: string,
  candidates: JobPosting[],
): Promise<void> {
  if (candidates.length === 0) return

  const settings = db
    .prepare('SELECT affinity_skip_threshold, affinity_token_budget FROM settings WHERE id = 1')
    .get() as { affinity_skip_threshold: number; affinity_token_budget: number }

  const skipThreshold = settings.affinity_skip_threshold ?? 15
  const tokenBudget = settings.affinity_token_budget ?? 80_000

  // Skip threshold: mark all skipped if candidate pool is small
  if (candidates.length < skipThreshold) {
    const updateSkip = db.prepare(
      `UPDATE job_postings
       SET affinity_skipped = 1, affinity_score = NULL, affinity_scored_at = NULL
       WHERE id = ?`,
    )
    db.transaction(() => {
      for (const p of candidates) updateSkip.run(p.id)
    })()
    return
  }

  const intent =
    (db.prepare('SELECT intent FROM search_config WHERE id = 1').get() as { intent: string | null })
      ?.intent ?? ''

  const client = new Anthropic({ apiKey })
  const updatePosting = db.prepare(
    `UPDATE job_postings
     SET affinity_score = @score, affinity_scored_at = @scored_at, affinity_skipped = 0,
         affinity_reasoning = @reasoning
     WHERE id = @id`,
  )

  // Build batches by token budget
  const batches: JobPosting[][] = []
  let current: JobPosting[] = []
  let currentTokens = PROMPT_OVERHEAD_TOKENS

  for (const p of candidates) {
    const postingTokens = estimateTokens(
      `${p.id}${p.title}${p.company}${p.raw_text?.slice(0, 1200) ?? ''}`,
    )
    if (current.length > 0 && currentTokens + postingTokens > tokenBudget) {
      batches.push(current)
      current = []
      currentTokens = PROMPT_OVERHEAD_TOKENS
    }
    current.push(p)
    currentTokens += postingTokens
  }
  if (current.length > 0) batches.push(current)

  const now = new Date().toISOString()

  for (const batch of batches) {
    let items: AffinityItem[]

    try {
      const response = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: buildScoringPrompt(batch, intent) }],
      })

      writeLLMUsage(db, {
        call_type: 'affinity_scoring',
        model: DEFAULT_MODEL,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        posting_id: null,
      })

      const text = response.content.find((b) => b.type === 'text')?.text ?? ''
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('Expected array')
      items = parsed
        .map((raw: unknown) => AffinityItemSchema.safeParse(raw))
        .filter((r) => r.success)
        .map((r) => r.data as AffinityItem)
    } catch {
      // On batch failure, assign neutral fallback scores (unverified)
      db.transaction(() => {
        for (const p of batch) {
          updatePosting.run({ score: 0.5, scored_at: now, id: p.id, reasoning: null })
        }
      })()
      continue
    }

    // Build a map for fast lookup; postings not in response get fallback
    const scoreMap = new Map(items.map((i) => [i.posting_id, i]))

    db.transaction(() => {
      for (const p of batch) {
        const item = scoreMap.get(p.id)
        updatePosting.run({
          score: item ? item.affinity_score : 0.5,
          reasoning: item ? item.reasoning : null,
          scored_at: now,
          id: p.id,
        })
      }
    })()
  }
}
