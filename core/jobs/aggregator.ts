import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { JobPosting } from './adapters/base'
import type { BaseAdapter } from './adapters/base'

export interface ScrapeSummary {
  fetched: number
  dupes: number
  netNew: number
}

// In-memory staging buffer — held between runScrape and commitScrape/discardScrape.
// Safe because all IPC calls execute synchronously on the main process.
let staged: JobPosting[] | null = null

function compositeKey(company: string, title: string, posted_at: string | null): string {
  return `${company.toLowerCase()}::${title.toLowerCase().replace(/\s+/g, ' ').trim()}::${posted_at ?? ''}`
}

export async function runScrape(
  db: Database.Database,
  adapters: BaseAdapter[],
): Promise<ScrapeSummary> {
  // Collect existing URLs and composite keys from DB for dedup
  const existingUrls = new Set<string>(
    (db.prepare('SELECT url FROM job_postings').all() as { url: string }[]).map((r) => r.url),
  )

  const existingComposites = new Set<string>(
    (
      db
        .prepare('SELECT company, title, posted_at FROM job_postings')
        .all() as { company: string; title: string; posted_at: string | null }[]
    ).map((r) => compositeKey(r.company, r.title, r.posted_at)),
  )

  const results: JobPosting[] = []
  let fetched = 0
  let dupes = 0

  for (const adapter of adapters) {
    const postings = await adapter.search('', {})
    fetched += postings.length

    for (const posting of postings) {
      if (existingUrls.has(posting.url)) {
        dupes++
        continue
      }

      const ck = compositeKey(posting.company, posting.title, posting.posted_at)
      if (existingComposites.has(ck)) {
        dupes++
        continue
      }

      // In-memory dedup against already-staged postings in this run
      const alreadyStaged = results.some(
        (r) => r.url === posting.url || compositeKey(r.company, r.title, r.posted_at) === ck,
      )
      if (alreadyStaged) {
        dupes++
        continue
      }

      // Aggregator assigns the canonical DB id
      results.push({ ...posting, id: randomUUID() } as JobPosting)
    }
  }

  staged = results

  return { fetched, dupes, netNew: results.length }
}

export function commitScrape(db: Database.Database): void {
  if (!staged || staged.length === 0) {
    staged = null
    return
  }

  const insert = db.prepare(`
    INSERT INTO job_postings (
      id, source, url, resolved_domain, title, company, location,
      yoe_min, yoe_max, seniority, tech_stack, posted_at, applicant_count,
      raw_text, fetched_at, scraper_mod_version, status,
      affinity_score, affinity_skipped, affinity_scored_at, first_response_at, last_seen_at
    ) VALUES (
      @id, @source, @url, @resolved_domain, @title, @company, @location,
      @yoe_min, @yoe_max, @seniority, @tech_stack, @posted_at, @applicant_count,
      @raw_text, @fetched_at, @scraper_mod_version, @status,
      @affinity_score, @affinity_skipped, @affinity_scored_at, @first_response_at, @last_seen_at
    )
  `)

  const bulk = db.transaction((postings: JobPosting[]) => {
    for (const p of postings) {
      insert.run({
        ...p,
        tech_stack: JSON.stringify(p.tech_stack),
        affinity_skipped: p.affinity_skipped ? 1 : 0,
      })
    }
  })

  bulk(staged)
  staged = null
}

export function discardScrape(): void {
  staged = null
}
