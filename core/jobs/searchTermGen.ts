import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import Database from 'better-sqlite3'
import type { SearchTerm, SearchTermSeniority, Recency, GenConstraints } from '../../src/shared/ipc-types'
import { writeLLMUsage } from './llmUsage'
import { getAllEntries } from '../profile/repository'
import type { ProfileEntry } from '../profile/models'

const DEFAULT_MODEL = 'claude-sonnet-4-5'

interface RawStructuredTerm {
  role: string
  location?: string | null
  seniority?: string | null
  remote?: boolean
  recency?: string | null
}

const VALID_SENIORITIES = new Set(['intern', 'junior', 'mid', 'senior', 'staff'])
const VALID_RECENCIES = new Set(['day', 'week', 'month'])

function buildPrompt(intent: string): string {
  return `You are a job search assistant. Given the user's job search intent, generate a list of structured search terms.

User intent: "${intent}"

Return ONLY a valid JSON array with this exact shape — no markdown, no commentary:
[
  { "role": "Backend Engineer", "location": "San Francisco, CA", "seniority": "senior", "remote": false, "recency": "week" },
  { "role": "ML Engineer", "location": null, "seniority": "mid", "remote": true, "recency": null }
]

Rules:
- 3–6 terms total
- "role" must be a 2–4 word job title only (e.g. "Python Developer", "Senior Backend Engineer", "ML Engineer") — no tech stack lists, no conjunctions, no extra adjectives beyond seniority
- "location" is a city/region string or null for no location filter
- "seniority" is one of: intern, junior, mid, senior, staff — or null for any
- "remote" is true or false
- "recency" is one of: day, week, month — or null for no time filter
- Vary role phrasing with different job title angles (not tech keyword lists)
- No duplicate roles`
}

export async function generateSearchTerms(
  db: Database.Database,
  apiKey: string,
  intent: string,
  constraints?: GenConstraints,
): Promise<SearchTerm[]> {
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildPrompt(intent) }],
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
  const raw = response.content.find((b) => b.type === 'text')?.text ?? ''
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  let rawTerms: RawStructuredTerm[]
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) throw new Error('Expected array')
    rawTerms = parsed as RawStructuredTerm[]
  } catch {
    throw new Error(`Failed to parse search term response: ${raw.slice(0, 200)}`)
  }

  // Delete existing llm_generated terms and replace
  const insertStmt = db.prepare(
    `INSERT INTO search_terms
       (id, term, enabled, source, created_at, locations, seniorities, work_type, recency, max_results)
     VALUES (@id, @term, 1, 'llm_generated', @created_at, @locations, @seniorities, @work_type, @recency, @max_results)`,
  )
  const now = new Date().toISOString()

  const inserted: SearchTerm[] = []

  const existingTerms = db.prepare(`SELECT term FROM search_terms`).all() as { term: string }[]
  const existingRoles = new Set(existingTerms.map((r) => r.term.toLowerCase()))

  db.transaction(() => {
    for (const t of rawTerms) {
      if (typeof t.role !== 'string' || !t.role.trim()) continue
      const role = t.role.trim()
      if (existingRoles.has(role.toLowerCase())) continue

      // Apply constraints (override LLM-chosen values when user has locked a field)
      let locations: string | null
      let seniorities: string | null
      let work_type: string | null
      let recency: Recency | null
      let max_results: number | null

      if (constraints?.locations?.length) {
        locations = JSON.stringify(constraints.locations)
      } else {
        const loc = typeof t.location === 'string' && t.location.trim() ? t.location.trim() : null
        locations = loc ? JSON.stringify([loc]) : null
      }

      if (constraints?.seniorities?.length) {
        seniorities = JSON.stringify(constraints.seniorities)
      } else {
        const sen = (t.seniority && VALID_SENIORITIES.has(t.seniority) ? t.seniority : null) as SearchTermSeniority | null
        seniorities = sen ? JSON.stringify([sen]) : null
      }

      if (constraints?.work_type?.length) {
        work_type = JSON.stringify(constraints.work_type)
      } else {
        work_type = t.remote === true ? JSON.stringify(['remote']) : null
      }

      if (constraints?.recency) {
        recency = constraints.recency
      } else {
        recency = (t.recency && VALID_RECENCIES.has(t.recency) ? t.recency : null) as Recency | null
      }

      max_results = constraints?.max_results ?? null

      const id = randomUUID()
      insertStmt.run({ id, term: role, created_at: now, locations, seniorities, work_type, recency, max_results })
      inserted.push({
        id,
        term: role,
        enabled: true,
        source: 'llm_generated',
        created_at: now,
        locations: locations ? JSON.parse(locations) as string[] : null,
        seniorities: seniorities ? JSON.parse(seniorities) as SearchTermSeniority[] : null,
        work_type: work_type ? JSON.parse(work_type) as Array<'remote'|'hybrid'|'onsite'> : null,
        recency,
        max_results,
      })
    }
  })()

  return inserted
}

// ─── Profile-based generation ─────────────────────────────────────────────────

function buildPromptFromProfile(entries: ProfileEntry[]): string {
  const formatted = entries
    .map((e) => `[${e.type}] ${e.title}\n${e.content}`)
    .join('\n\n')

  return `You are a job search assistant. Based on the user's professional profile below, generate a list of structured job search terms that best match their background.

Profile:
${formatted}

Return ONLY a valid JSON array with this exact shape — no markdown, no commentary:
[
  { "role": "Backend Engineer", "location": null, "seniority": "senior", "remote": true, "recency": "week" },
  { "role": "ML Engineer", "location": null, "seniority": "mid", "remote": true, "recency": null }
]

Rules:
- 3–6 terms total
- "role" must be a 2–4 word job title only (e.g. "Python Developer", "Senior Backend Engineer", "ML Engineer") — no tech stack lists, no conjunctions, no extra adjectives beyond seniority
- "location" is a city/region string or null for no location filter
- "seniority" is one of: intern, junior, mid, senior, staff — or null for any
- "remote" is true or false
- "recency" is one of: day, week, month — or null for no time filter
- Vary role phrasing with different job title angles (not tech keyword lists)
- No duplicate roles`
}

export async function generateSearchTermsFromProfile(
  db: Database.Database,
  apiKey: string,
  constraints?: GenConstraints,
): Promise<SearchTerm[]> {
  const allEntries = getAllEntries(db)
  const entries = allEntries.filter((e) => e.type === 'experience' || e.type === 'skill')
  if (entries.length === 0) {
    throw new Error('No experience or skill entries in your profile — add some first')
  }

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildPromptFromProfile(entries) }],
  })

  writeLLMUsage(db, {
    call_type: 'search_term_gen',
    model: DEFAULT_MODEL,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    posting_id: null,
  })

  const raw = response.content.find((b) => b.type === 'text')?.text ?? ''
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  let rawTerms: RawStructuredTerm[]
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) throw new Error('Expected array')
    rawTerms = parsed as RawStructuredTerm[]
  } catch {
    throw new Error(`Failed to parse search term response: ${raw.slice(0, 200)}`)
  }

  const insertStmt = db.prepare(
    `INSERT INTO search_terms
       (id, term, enabled, source, created_at, locations, seniorities, work_type, recency, max_results)
     VALUES (@id, @term, 1, 'llm_generated', @created_at, @locations, @seniorities, @work_type, @recency, @max_results)`,
  )
  const now = new Date().toISOString()

  const inserted: SearchTerm[] = []

  const existingTerms2 = db.prepare(`SELECT term FROM search_terms`).all() as { term: string }[]
  const existingRoles2 = new Set(existingTerms2.map((r) => r.term.toLowerCase()))

  db.transaction(() => {
    for (const t of rawTerms) {
      if (typeof t.role !== 'string' || !t.role.trim()) continue
      const role = t.role.trim()
      if (existingRoles2.has(role.toLowerCase())) continue

      let locations: string | null
      let seniorities: string | null
      let work_type: string | null
      let recency: Recency | null
      let max_results: number | null

      if (constraints?.locations?.length) {
        locations = JSON.stringify(constraints.locations)
      } else {
        const loc = typeof t.location === 'string' && t.location.trim() ? t.location.trim() : null
        locations = loc ? JSON.stringify([loc]) : null
      }

      if (constraints?.seniorities?.length) {
        seniorities = JSON.stringify(constraints.seniorities)
      } else {
        const sen = (t.seniority && VALID_SENIORITIES.has(t.seniority) ? t.seniority : null) as SearchTermSeniority | null
        seniorities = sen ? JSON.stringify([sen]) : null
      }

      if (constraints?.work_type?.length) {
        work_type = JSON.stringify(constraints.work_type)
      } else {
        work_type = t.remote === true ? JSON.stringify(['remote']) : null
      }

      if (constraints?.recency) {
        recency = constraints.recency
      } else {
        recency = (t.recency && VALID_RECENCIES.has(t.recency) ? t.recency : null) as Recency | null
      }

      max_results = constraints?.max_results ?? null

      const id = randomUUID()
      insertStmt.run({ id, term: role, created_at: now, locations, seniorities, work_type, recency, max_results })
      inserted.push({
        id,
        term: role,
        enabled: true,
        source: 'llm_generated',
        created_at: now,
        locations: locations ? JSON.parse(locations) as string[] : null,
        seniorities: seniorities ? JSON.parse(seniorities) as SearchTermSeniority[] : null,
        work_type: work_type ? JSON.parse(work_type) as Array<'remote'|'hybrid'|'onsite'> : null,
        recency,
        max_results,
      })
    }
  })()

  return inserted
}
