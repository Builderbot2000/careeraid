import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import Database from 'better-sqlite3'
import type { JobPosting } from './adapters/base'
import { writeLLMUsage } from './llmUsage'
import { serializeProfile } from '../resume/agent'
import { getAllEntries } from '../profile/repository'

const MODEL = 'claude-haiku-4-5'

// ─── Scoring formula ──────────────────────────────────────────────────────────

const HARD_SCORE: Record<string, number> = {
  overqualified:       0.70,
  fully_qualified:     1.00,
  minimally_qualified: 0.45,
  underqualified:      0.05,
}

const NICE_SCORE: Record<string, number> = {
  fully_met:    1.0,
  partially_met: 0.5,
  not_met:      0.0,
}

function computeAffinityScore(hardClass: string, niceClass: string): number {
  const h = HARD_SCORE[hardClass] ?? 0.5
  const n = NICE_SCORE[niceClass] ?? 0.5
  return 0.75 * h + 0.25 * n
}

// ─── LLM output schema ────────────────────────────────────────────────────────

const AffinityResultSchema = z.object({
  posting_id: z.string(),
  hard_reqs_class: z.enum([
    'overqualified',
    'fully_qualified',
    'minimally_qualified',
    'underqualified',
  ]),
  nice_to_haves_class: z.enum(['fully_met', 'partially_met', 'not_met']),
  reasoning: z.string(),
})

type AffinityResult = z.infer<typeof AffinityResultSchema>

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildScoringPrompt(
  postingId: string,
  title: string,
  company: string,
  jobDescription: string,
  serializedProfile: string,
  intent: string,
): string {
  return `You are a job-fit evaluator. Analyse whether the candidate meets this job's requirements.

## Search Intent
${intent}

## Candidate Profile
${serializedProfile.slice(0, 6000)}

## Job Posting
posting_id: ${postingId}
title: ${title}
company: ${company}
description:
${jobDescription.slice(0, 3000)}

## Task
1. Extract the job's HARD REQUIREMENTS (must-haves: mandatory qualifications, skills, YOE).
2. Extract NICE-TO-HAVES (preferred but not required).
3. Evaluate the candidate against each group.
4. Return ONLY a valid JSON object — no markdown, no commentary:

{
  "posting_id": "${postingId}",
  "hard_reqs_class": "<overqualified|fully_qualified|minimally_qualified|underqualified>",
  "nice_to_haves_class": "<fully_met|partially_met|not_met>",
  "reasoning": "<one sentence: key fit or gap>"
}

## Classification Guide

hard_reqs_class:
- overqualified: candidate clearly exceeds all hard requirements (e.g. 10 YOE for a 2-3 YOE role)
- fully_qualified: candidate meets all hard requirements
- minimally_qualified: candidate meets most but has one notable gap (missing a required skill or slightly below YOE minimum)
- underqualified: candidate fails to meet multiple hard requirements

nice_to_haves_class:
- fully_met: candidate meets all or nearly all nice-to-haves
- partially_met: candidate meets some nice-to-haves
- not_met: candidate meets none of the nice-to-haves`
}

// ─── Concurrency limiter ──────────────────────────────────────────────────────

function makeSemaphore(concurrency: number) {
  let running = 0
  const queue: Array<() => void> = []

  function next(): void {
    if (queue.length > 0 && running < concurrency) {
      running++
      queue.shift()!()
    }
  }

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(async () => {
        try {
          resolve(await fn())
        } catch (e) {
          reject(e)
        } finally {
          running--
          next()
        }
      })
      next()
    })
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function scorePostings(
  db: Database.Database,
  apiKey: string,
  candidates: JobPosting[],
): Promise<void> {
  if (candidates.length === 0) return

  const config = db
    .prepare('SELECT affinity_skip_threshold FROM search_config WHERE id = 1')
    .get() as { affinity_skip_threshold: number } | undefined

  const skipThreshold = config?.affinity_skip_threshold ?? 15

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

  const profileEntries = getAllEntries(db)
  const serializedProfile = serializeProfile(profileEntries)

  const client = new Anthropic({ apiKey })
  const now = new Date().toISOString()

  const updatePosting = db.prepare(
    `UPDATE job_postings
     SET affinity_score      = @score,
         affinity_scored_at  = @scored_at,
         affinity_skipped    = 0,
         affinity_reasoning  = @reasoning,
         hard_reqs_class     = @hard_reqs_class,
         nice_to_haves_class = @nice_to_haves_class
     WHERE id = @id`,
  )

  const limit = makeSemaphore(10)

  async function scoreOne(posting: JobPosting): Promise<void> {
    const jd = posting.raw_text ?? `${posting.title} at ${posting.company}`

    let result: AffinityResult

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: buildScoringPrompt(
              posting.id,
              posting.title,
              posting.company,
              jd,
              serializedProfile,
              intent,
            ),
          },
        ],
      })

      writeLLMUsage(db, {
        call_type: 'affinity_scoring',
        model: MODEL,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        posting_id: posting.id,
      })

      const raw = response.content.find((b) => b.type === 'text')?.text ?? ''
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
      const validated = AffinityResultSchema.safeParse(JSON.parse(cleaned))
      if (!validated.success) throw new Error('schema mismatch')
      result = validated.data
    } catch {
      // Leave score null so this posting is retried on the next scoring run
      updatePosting.run({
        score: null,
        scored_at: null,
        id: posting.id,
        reasoning: null,
        hard_reqs_class: null,
        nice_to_haves_class: null,
      })
      return
    }

    updatePosting.run({
      score: computeAffinityScore(result.hard_reqs_class, result.nice_to_haves_class),
      scored_at: now,
      id: posting.id,
      reasoning: result.reasoning,
      hard_reqs_class: result.hard_reqs_class,
      nice_to_haves_class: result.nice_to_haves_class,
    })
  }

  await Promise.all(candidates.map((p) => limit(() => scoreOne(p))))
}
