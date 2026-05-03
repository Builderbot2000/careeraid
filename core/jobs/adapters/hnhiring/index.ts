import fetch from 'node-fetch'
import { load } from 'cheerio'
import { BaseAdapter, type JobPosting, type SearchFilters, type CrawlSignal } from '../base'
import { extractYoe, extractSeniority, extractTechStack } from '../linkedin'

const SOURCE = 'hnhiring'
const SCRAPER_VERSION = 'hnhiring-adapter@1'
const BASE_URL = 'https://hnhiring.com'
const HN_USER_BASE = 'https://news.ycombinator.com/user?id='

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD cutoff date relative to now. */
export function recencyCutoffDate(recency: 'day' | 'week' | 'month'): string {
  const d = new Date()
  switch (recency) {
    case 'day':   d.setDate(d.getDate() - 1);   break
    case 'week':  d.setDate(d.getDate() - 7);   break
    case 'month': d.setMonth(d.getMonth() - 1); break
  }
  return d.toISOString().slice(0, 10)
}

/** Returns the listing URL for a given month slug (e.g. "april-2026"). */
export function buildListingUrl(monthSlug: string): string {
  return `${BASE_URL}/${monthSlug}`
}

export interface ParsedFirstLine {
  company: string
  title: string
  location: string
}

/**
 * Parses the pipe-separated first line of an HNHiring job posting.
 * Typical format: "Company | Role | Location | ..."
 */
export function parseFirstLine(raw: string): ParsedFirstLine {
  const parts = raw.split('|').map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return { company: '', title: raw.trim(), location: '' }

  const company  = parts[0] ?? ''
  const title    = parts[1] ?? ''
  const location = parts[2] ?? ''

  return { company, title, location }
}

/** Fetches the homepage and returns the current month slug, e.g. "april-2026". */
async function fetchCurrentMonthSlug(): Promise<string | null> {
  const response = await fetch(BASE_URL)
  if (!response.ok) return null

  const html = await response.text()
  const $ = load(html)

  let slug: string | null = null
  $('a[href]').each((_i, el) => {
    if (slug) return
    const href = $(el).attr('href') ?? ''
    const match = href.match(/^\/([a-z]+-\d{4})$/)
    if (match) slug = match[1]
  })

  return slug
}

/** Parses job postings out of a fetched hnhiring.com month-page HTML string. */
export function parsePostings(html: string): Omit<JobPosting, 'id'>[] {
  const $ = load(html)
  const postings: Omit<JobPosting, 'id'>[] = []
  const fetchedAt = new Date().toISOString()

  $('ul.jobs li.job').each((_i, el) => {
    const userLink = $(el).find('div.user.green > a').first()
    const username = userLink.text().trim()
    const date     = $(el).find('span.type-info').first().text().trim()
    const bodyEl   = $(el).find('div.body').first()

    if (!username || !date) return

    // First text node before the first <p> is the structured summary line.
    const firstLine = bodyEl
      .contents()
      .filter((_j, n) => n.type === 'text')
      .first()
      .text()
      .trim()

    const rawText = bodyEl.text().trim()

    // Skip job-seeker posts (e.g. "SEEKING | ...")
    const firstSegment = firstLine.split('|')[0].trim().toUpperCase()
    if (firstSegment === 'SEEKING') return

    const { company, title, location } = parseFirstLine(firstLine)
    if (!company) return

    const url = `${HN_USER_BASE}${encodeURIComponent(username)}`

    // Try to extract resolved_domain from first non-HN external link in body.
    let resolved_domain: string | null = null
    bodyEl.find('a[href]').each((_j, a) => {
      if (resolved_domain) return
      const href = $(a).attr('href') ?? ''
      try {
        const u = new URL(href)
        if (u.hostname && !u.hostname.includes('ycombinator.com')) {
          resolved_domain = u.hostname.replace(/^www\./, '')
        }
      } catch {
        // skip invalid URLs
      }
    })

    const combinedText = `${title} ${rawText}`
    const { yoe_min, yoe_max } = extractYoe(combinedText)
    const seniority  = extractSeniority(title, rawText)
    const tech_stack = extractTechStack(combinedText)

    postings.push({
      source:              SOURCE,
      url,
      resolved_domain,
      title:               title || company,
      company,
      location,
      yoe_min,
      yoe_max,
      seniority,
      tech_stack,
      posted_at:           date,
      applicant_count:     null,
      raw_text:            rawText,
      fetched_at:          fetchedAt,
      scraper_mod_version: SCRAPER_VERSION,
      status:              'new',
      affinity_score:      null,
      affinity_skipped:    false,
      affinity_scored_at:  null,
      affinity_reasoning:  null,
      hard_reqs_class:     null,
      nice_to_haves_class: null,
      first_response_at:   null,
      last_seen_at:        fetchedAt,
      salary_min:          null,
      salary_max:          null,
      company_rating:      null,
    })
  })

  return postings
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class HNHiringAdapter extends BaseAdapter {
  readonly id = 'hnhiring'
  readonly delayMs = 500
  readonly availableSignals = new Set(['recency'])

  async search(
    _term: string,
    filters: SearchFilters,
    onPosting?: (posting: Omit<JobPosting, 'id'>) => void,
    _onCaptchaRequired?: () => Promise<void>,
    signal?: CrawlSignal,
  ): Promise<void> {
    const maxResults = filters.maxResults ?? 100
    const cutoff     = filters.recency ? recencyCutoffDate(filters.recency) : null

    const slug = await fetchCurrentMonthSlug()
    if (!slug) return

    const response = await fetch(buildListingUrl(slug))
    if (!response.ok) return

    const html     = await response.text()
    const postings = parsePostings(html)

    let reportedCount = 0

    for (const posting of postings) {
      if (reportedCount >= maxResults) break

      // Postings are newest-first; stop as soon as we fall below the cutoff.
      if (cutoff !== null && posting.posted_at !== null && posting.posted_at < cutoff) break

      await signal?.waitForResume()
      signal?.checkAborted()

      onPosting?.(posting)
      reportedCount++
    }
  }
}

export default HNHiringAdapter
