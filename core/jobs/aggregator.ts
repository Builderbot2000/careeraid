import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { JobPosting } from './adapters/base'
import type { BaseAdapter } from './adapters/base'
import type { AdapterProgress, ScrapeSummary } from '../../src/shared/ipc-types'

// In-memory staging buffer — held between runScrape and commitScrape/discardScrape.
// Safe because all IPC calls execute synchronously on the main process.
let staged: JobPosting[] | null = null

function compositeKey(company: string, title: string, posted_at: string | null): string {
  return `${company.toLowerCase()}::${title.toLowerCase().replace(/\s+/g, ' ').trim()}::${posted_at ?? ''}`
}

// ─── Pre-commit filters ───────────────────────────────────────────────────────

function matchesCompanyBan(company: string, pattern: string): boolean {
  try {
    return new RegExp(pattern, 'i').test(company)
  } catch {
    return company.toLowerCase().includes(pattern.toLowerCase())
  }
}

function applyBanList(
  db: Database.Database,
  postings: JobPosting[],
): { filtered: JobPosting[]; excluded: number } {
  const bans = db.prepare('SELECT type, value FROM ban_list').all() as {
    type: 'company' | 'domain'
    value: string
  }[]
  if (bans.length === 0) return { filtered: postings, excluded: 0 }

  const companyBans = bans.filter((b) => b.type === 'company').map((b) => b.value)
  const domainBans = new Set(bans.filter((b) => b.type === 'domain').map((b) => b.value))

  const filtered: JobPosting[] = []
  let excluded = 0

  for (const p of postings) {
    const banned =
      companyBans.some((pat) => matchesCompanyBan(p.company, pat)) ||
      (p.resolved_domain !== null && domainBans.has(p.resolved_domain))
    if (banned) {
      excluded++
    } else {
      filtered.push(p)
    }
  }

  return { filtered, excluded }
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

function applyKeywordFilters(
  db: Database.Database,
  postings: JobPosting[],
): { filtered: JobPosting[]; excluded: number } {
  const configRow = db
    .prepare(
      'SELECT required_keywords, excluded_keywords, keyword_match_fields FROM search_config WHERE id = 1',
    )
    .get() as
    | { required_keywords: string; excluded_keywords: string; keyword_match_fields: string }
    | undefined

  const required = parseJsonArray(configRow?.required_keywords)
  const excluded = parseJsonArray(configRow?.excluded_keywords)
  const matchFields = parseJsonArray(configRow?.keyword_match_fields).length
    ? parseJsonArray(configRow?.keyword_match_fields)
    : ['title', 'tech_stack']

  if (required.length === 0 && excluded.length === 0) {
    return { filtered: postings, excluded: 0 }
  }

  const result: JobPosting[] = []
  let excludedCount = 0

  for (const p of postings) {
    const parts: string[] = []
    if (matchFields.includes('title')) parts.push(p.title)
    if (matchFields.includes('tech_stack')) parts.push(...p.tech_stack)
    if (matchFields.includes('raw_text') && p.raw_text) parts.push(p.raw_text)
    const haystack = parts.join(' ').toLowerCase()

    let keep = true

    for (const kw of excluded) {
      const pattern = kw.startsWith('re:') ? new RegExp(kw.slice(3), 'i') : kw.toLowerCase()
      if (typeof pattern === 'string' ? haystack.includes(pattern) : pattern.test(haystack)) {
        keep = false
        break
      }
    }

    if (keep && required.length > 0) {
      const ok = required.some((kw) => {
        const pattern = kw.startsWith('re:') ? new RegExp(kw.slice(3), 'i') : kw.toLowerCase()
        return typeof pattern === 'string' ? haystack.includes(pattern) : pattern.test(haystack)
      })
      if (!ok) keep = false
    }

    if (keep) {
      result.push(p)
    } else {
      excludedCount++
    }
  }

  return { filtered: result, excluded: excludedCount }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runScrape(
  db: Database.Database,
  adapters: BaseAdapter[],
  onProgress?: (p: AdapterProgress) => void,
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
    const termRows = db
      .prepare('SELECT term FROM search_terms WHERE adapter_id = ? AND enabled = 1')
      .all(adapter.id) as { term: string }[]
    const searchTerms = termRows.length > 0 ? termRows.map((r) => r.term) : ['']

    onProgress?.({ adapterId: adapter.id, status: 'running', fetched: 0 })
    let adapterFetched = 0
    let hadError = false

    for (const term of searchTerms) {
      let postings: Awaited<ReturnType<typeof adapter.search>>
      try {
        postings = await adapter.search(term, {}, () => {
          adapterFetched++
          onProgress?.({ adapterId: adapter.id, status: 'running', fetched: adapterFetched })
        })
      } catch (err) {
        onProgress?.({
          adapterId: adapter.id,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        })
        hadError = true
        break
      }
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

    if (!hadError) {
      onProgress?.({ adapterId: adapter.id, status: 'done', fetched: adapterFetched })
    }
  }

  // PRE_COMMIT_FILTER: ban list → keyword filter
  const { filtered: afterBan, excluded: ban_excluded } = applyBanList(db, results)
  const { filtered: afterKeyword, excluded: keyword_filtered } = applyKeywordFilters(db, afterBan)

  staged = afterKeyword

  return { fetched, dupes, netNew: afterKeyword.length, ban_excluded, keyword_filtered }
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
