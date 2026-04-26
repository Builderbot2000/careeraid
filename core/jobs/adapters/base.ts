import { z } from 'zod'

// ─── Status + Seniority enums ─────────────────────────────────────────────────

export const PostingStatusSchema = z.enum([
  'new',
  'viewed',
  'favorited',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'ghosted',
])

export const SenioritySchema = z.enum(['intern', 'junior', 'mid', 'senior', 'staff', 'any'])

export type PostingStatus = z.infer<typeof PostingStatusSchema>
export type Seniority = z.infer<typeof SenioritySchema>

// ─── JobPosting — the interface contract ─────────────────────────────────────

export const JobPostingSchema = z.object({
  id: z.string().uuid(),
  source: z.string(),
  url: z.string().url(),
  resolved_domain: z.string().nullable(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string(),
  yoe_min: z.number().int().nullable(),
  yoe_max: z.number().int().nullable(),
  seniority: SenioritySchema,
  tech_stack: z.array(z.string()),
  posted_at: z.string().nullable(),
  applicant_count: z.number().int().nullable(),
  raw_text: z.string().nullable(),
  fetched_at: z.string(),
  scraper_mod_version: z.string(),
  status: PostingStatusSchema,
  affinity_score: z.number().nullable(),
  affinity_skipped: z.boolean(),
  affinity_scored_at: z.string().nullable(),
  affinity_reasoning: z.string().nullable(),
  first_response_at: z.string().nullable(),
  last_seen_at: z.string(),
})

export type JobPosting = z.infer<typeof JobPostingSchema>

// ─── DB row shape (SQLite integers and JSON strings, pre-conversion) ──────────

export interface JobPostingRow {
  id: string
  source: string
  url: string
  resolved_domain: string | null
  title: string
  company: string
  location: string
  yoe_min: number | null
  yoe_max: number | null
  seniority: string
  tech_stack: string        // JSON array
  posted_at: string | null
  applicant_count: number | null
  raw_text: string | null
  fetched_at: string
  scraper_mod_version: string
  status: string
  affinity_score: number | null
  affinity_skipped: number  // SQLite integer 0/1
  affinity_scored_at: string | null
  affinity_reasoning: string | null
  first_response_at: string | null
  last_seen_at: string
}

export function rowToPosting(row: JobPostingRow): JobPosting {
  return {
    ...row,
    seniority: row.seniority as Seniority,
    status: row.status as PostingStatus,
    tech_stack: JSON.parse(row.tech_stack) as string[],
    affinity_skipped: row.affinity_skipped === 1,
  }
}

// ─── Adapter interface ────────────────────────────────────────────────────────

export interface SearchFilters {
  location?: string
  remote?: boolean
}

export abstract class BaseAdapter {
  abstract readonly id: string
  readonly delayMs: number = 3000
  readonly availableSignals: Set<string> = new Set()

  abstract search(term: string, filters: SearchFilters, onPosting?: () => void): Promise<Omit<JobPosting, 'id'>[]>
}
