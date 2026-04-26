import { test, expect } from '@playwright/test'
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import {
  SELECTORS,
  parseCard,
  parseDetail,
  cleanJobUrl,
  extractYoe,
  extractSeniority,
  extractTechStack,
} from '../../core/jobs/adapters/linkedin'
import { JobPostingSchema } from '../../core/jobs/adapters/base'

const searchHtml = fs.readFileSync(
  path.join(__dirname, 'fixtures/linkedin-search.html'),
  'utf-8',
)
const detailHtml = fs.readFileSync(
  path.join(__dirname, 'fixtures/linkedin-detail.html'),
  'utf-8',
)

test.describe('LinkedInAdapter — DOM parsing integration', () => {
  test('parseCard returns non-null with all fields for a complete card', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.setContent(searchHtml)
      const cards = await page.$$(SELECTORS.resultItem)

      const parsed = await parseCard(cards[0])
      expect(parsed).not.toBeNull()
      expect(parsed!.title).toBe('Senior TypeScript Engineer')
      expect(parsed!.company).toBe('Acme Corp')
      expect(parsed!.location).toBe('San Francisco, CA')
      expect(parsed!.href).toBeTruthy()
      expect(parsed!.posted_at).toBe('2024-03-15')
    } finally {
      await browser.close()
    }
  })

  test('parseCard strips tracking params from card href', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.setContent(searchHtml)
      const cards = await page.$$(SELECTORS.resultItem)

      const parsed = await parseCard(cards[0])
      expect(parsed).not.toBeNull()
      // cleanJobUrl is applied downstream, but href should contain the raw value
      const clean = cleanJobUrl(parsed!.href)
      expect(clean).not.toContain('refId')
      expect(clean).not.toContain('trackingId')
      expect(clean).toContain('/jobs/view/1234567890/')
    } finally {
      await browser.close()
    }
  })

  test('parseCard returns posted_at: null when <time> element is absent', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.setContent(searchHtml)
      const cards = await page.$$(SELECTORS.resultItem)

      // Card at index 1 has no <time> element
      const parsed = await parseCard(cards[1])
      expect(parsed).not.toBeNull()
      expect(parsed!.posted_at).toBeNull()
    } finally {
      await browser.close()
    }
  })

  test('parseCard returns null for a card missing required fields', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.setContent(searchHtml)
      const cards = await page.$$(SELECTORS.resultItem)

      // Card at index 2 has no <h3> title element
      const parsed = await parseCard(cards[2])
      expect(parsed).toBeNull()
    } finally {
      await browser.close()
    }
  })

  test('parseDetail extracts raw_text and applicant_count from fixture', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.setContent(detailHtml)

      const detail = await parseDetail(page)
      expect(detail.raw_text).not.toBeNull()
      expect(detail.raw_text).toContain('TypeScript')
      expect(detail.applicant_count).toBe(200)
    } finally {
      await browser.close()
    }
  })

  test('assembled posting passes JobPostingSchema validation (schema-valid and commit-ready)', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const searchPage = await browser.newPage()
      const detailPage = await browser.newPage()

      await searchPage.setContent(searchHtml)
      await detailPage.setContent(detailHtml)

      const cards = await searchPage.$$(SELECTORS.resultItem)
      const parsed = await parseCard(cards[0])
      const detail = await parseDetail(detailPage)

      expect(parsed).not.toBeNull()

      const now = new Date().toISOString()
      const posting = {
        source: 'linkedin',
        url: cleanJobUrl(parsed!.href),
        resolved_domain: null,
        title: parsed!.title,
        company: parsed!.company,
        location: parsed!.location,
        posted_at: parsed!.posted_at,
        ...extractYoe(detail.raw_text ?? ''),
        seniority: extractSeniority(parsed!.title, detail.raw_text ?? ''),
        tech_stack: extractTechStack(detail.raw_text ?? parsed!.title),
        applicant_count: detail.applicant_count,
        raw_text: detail.raw_text,
        fetched_at: now,
        scraper_mod_version: 'linkedin-adapter@1',
        status: 'new' as const,
        affinity_score: null,
        affinity_skipped: false,
        affinity_scored_at: null,
        affinity_reasoning: null,
        first_response_at: null,
        last_seen_at: now,
      }

      const result = JobPostingSchema.omit({ id: true }).safeParse(posting)
      if (!result.success) {
        console.error('Schema validation errors:', JSON.stringify(result.error.format(), null, 2))
      }
      expect(result.success).toBe(true)

      // Spot-check derived fields from the fixture content
      expect(posting.tech_stack).toContain('TypeScript')
      expect(posting.tech_stack).toContain('React')
      expect(posting.tech_stack).toContain('Node.js')
      expect(posting.tech_stack).toContain('PostgreSQL')
      expect(posting.yoe_min).toBe(5)
      expect(posting.yoe_max).toBeNull()
      expect(posting.seniority).toBe('senior')
      expect(posting.applicant_count).toBe(200)
    } finally {
      await browser.close()
    }
  })
})
