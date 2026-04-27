import { chromium, type Browser, type ElementHandle, type Page } from 'playwright'
import { BaseAdapter, type JobPosting, type SearchFilters } from './base'
import { extractYoe, extractSeniority, extractTechStack } from './linkedin'

const SOURCE = 'indeed'
const SCRAPER_VERSION = 'indeed-adapter@1'

/** Maximum search-result pages to fetch per search term (10 cards per page). */
const MAX_PAGES = 5
const PAGE_SIZE = 10

/** Abort a search term after this many consecutive card-level parse failures. */
const MAX_CONSECUTIVE_FAILS = 5

// ─── Selectors ────────────────────────────────────────────────────────────────
// Centralised here so they are easy to update when Indeed's DOM changes.

export const SELECTORS = {
  // Search results list
  resultsList: '#mosaic-provider-jobcards ul',
  resultItem: '#mosaic-provider-jobcards ul > li',
  cardLink: 'h2.jobTitle a[data-jk]',
  cardTitle: 'h2.jobTitle a',
  cardCompany: '[data-testid="company-name"]',
  cardLocation: '[data-testid="text-location"]',
  cardPostedAt: '[data-testid="myJobsStateDate"]',
  // Job detail page
  detailDescription: '#jobDescriptionText',
  // Auth wall detection
  authWallInput: '#login-email-input',
} as const

// ─── Filter maps and URL helpers ──────────────────────────────────────────────

const RECENCY_MAP: Record<string, string> = {
  day: '1',
  week: '7',
  month: '30',
}

export function buildSearchUrl(term: string, filters: SearchFilters, start: number): string {
  const params = new URLSearchParams()
  if (term) params.set('q', term)
  if (filters.location) params.set('l', filters.location)
  if (filters.recency && RECENCY_MAP[filters.recency]) params.set('fromage', RECENCY_MAP[filters.recency])
  if (filters.workTypes?.includes('remote')) params.set('remotejob', '1')
  params.set('start', String(start))
  return `https://www.indeed.com/jobs?${params.toString()}`
}

/**
 * Produces the canonical Indeed job URL from a job key (`jk` param), stripping
 * all tracking tokens from search-result hrefs.
 */
export function cleanJobUrl(jk: string): string {
  return `https://www.indeed.com/viewjob?jk=${jk}`
}

// ─── Auth-wall detection ──────────────────────────────────────────────────────

export async function isAuthWall(page: Page): Promise<boolean> {
  if (page.url().includes('/account/')) return true
  const loginInput = await page.$(SELECTORS.authWallInput)
  return loginInput !== null
}

// ─── Date parser ─────────────────────────────────────────────────────────────

/**
 * Parses Indeed's relative date text into an ISO date string (YYYY-MM-DD).
 * Returns null for unrecognised formats or imprecise ranges like "30+ days ago".
 */
export function parsePostedAt(text: string): string | null {
  const normalised = text.trim().toLowerCase()

  if (normalised === 'just posted' || normalised === 'today') {
    return new Date().toISOString().slice(0, 10)
  }

  // "30+ days ago" — not precise enough to be useful
  if (/30\+/.test(normalised)) return null

  const m = normalised.match(/(\d+)\s+(day|week|month)s?\s+ago/)
  if (!m) return null

  const n = parseInt(m[1], 10)
  const unit = m[2]
  const d = new Date()

  switch (unit) {
    case 'day':   d.setDate(d.getDate() - n); break
    case 'week':  d.setDate(d.getDate() - n * 7); break
    case 'month': d.setMonth(d.getMonth() - n); break
  }

  return d.toISOString().slice(0, 10)
}

// ─── DOM parsers (exported for unit testing) ──────────────────────────────────

export interface ParsedCard {
  href: string
  title: string
  company: string
  location: string
  posted_at: string | null
}

/** Returns null when required card fields (title, jk, company) are missing. */
export async function parseCard(card: ElementHandle): Promise<ParsedCard | null> {
  const linkEl    = await card.$(SELECTORS.cardLink)
  const titleEl   = await card.$(SELECTORS.cardTitle)
  const companyEl = await card.$(SELECTORS.cardCompany)
  const locationEl = await card.$(SELECTORS.cardLocation)
  const postedEl  = await card.$(SELECTORS.cardPostedAt)

  const jk      = await linkEl?.getAttribute('data-jk') ?? null
  const title   = (await titleEl?.textContent())?.trim() ?? null
  const company = (await companyEl?.textContent())?.trim() ?? null
  const location = (await locationEl?.textContent())?.trim() ?? ''
  const postedText = (await postedEl?.textContent())?.trim() ?? ''
  const posted_at = parsePostedAt(postedText)

  if (!jk || !title || !company) return null

  return { href: cleanJobUrl(jk), title, company, location, posted_at }
}

export interface ParsedDetail {
  raw_text: string | null
}

export async function parseDetail(page: Page): Promise<ParsedDetail> {
  const descEl = await page.$(SELECTORS.detailDescription)
  const raw_text = descEl ? (await descEl.innerText()).trim() : null
  return { raw_text }
}

// ─── Delay helper ─────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class IndeedAdapter extends BaseAdapter {
  override readonly id = 'indeed'
  override readonly delayMs = 3000
  override readonly availableSignals = new Set(['recency'])

  override async search(
    term: string,
    filters: SearchFilters,
    onPosting?: () => void,
  ): Promise<Omit<JobPosting, 'id'>[]> {
    const browser = await chromium.launch({ headless: true })
    try {
      return await this._scrape(browser, term, filters, onPosting)
    } finally {
      await browser.close()
    }
  }

  private async _scrape(
    browser: Browser,
    term: string,
    filters: SearchFilters,
    onPosting?: () => void,
  ): Promise<Omit<JobPosting, 'id'>[]> {
    const searchPage = await browser.newPage()
    const detailPage = await browser.newPage()
    const results: Omit<JobPosting, 'id'>[] = []
    let consecutiveFails = 0
    const now = new Date().toISOString()
    const pageLimit = filters.maxResults != null
      ? Math.min(Math.ceil(filters.maxResults / PAGE_SIZE), MAX_PAGES)
      : MAX_PAGES

    for (let pageNum = 0; pageNum < pageLimit; pageNum++) {
      const url = buildSearchUrl(term, filters, pageNum * PAGE_SIZE)
      await searchPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

      // Graceful abort on auth wall
      if (await isAuthWall(searchPage)) break

      // Wait for results list; break if no results returned
      try {
        await searchPage.waitForSelector(SELECTORS.resultsList, { timeout: 10_000 })
      } catch {
        break
      }

      const cards = await searchPage.$$(SELECTORS.resultItem)
      if (cards.length === 0) break

      for (const card of cards) {
        if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) return results
        if (filters.maxResults != null && results.length >= filters.maxResults) return results

        const parsed = await parseCard(card)
        if (!parsed) {
          consecutiveFails++
          continue
        }

        const { href, title, company, location, posted_at } = parsed

        await delay(this.delayMs)

        let raw_text: string | null = null

        try {
          await detailPage.goto(href, { waitUntil: 'domcontentloaded', timeout: 30_000 })

          // If detail page hits an auth wall, skip detail but keep card data
          if (!(await isAuthWall(detailPage))) {
            const detail = await parseDetail(detailPage)
            raw_text = detail.raw_text
          }
        } catch {
          // Detail fetch failed — continue with card-level data only
        }

        const { yoe_min, yoe_max } = extractYoe(raw_text ?? '')
        const seniority = extractSeniority(title, raw_text ?? '')
        const tech_stack = extractTechStack(raw_text ?? title)

        results.push({
          source: SOURCE,
          url: href,
          resolved_domain: null,
          title,
          company,
          location,
          yoe_min,
          yoe_max,
          seniority,
          tech_stack,
          posted_at,
          applicant_count: null,
          raw_text,
          fetched_at: now,
          scraper_mod_version: SCRAPER_VERSION,
          status: 'new',
          affinity_score: null,
          affinity_skipped: false,
          affinity_scored_at: null,
          affinity_reasoning: null,
          first_response_at: null,
          last_seen_at: now,
        })

        consecutiveFails = 0
        onPosting?.()
      }
    }

    return results
  }
}
