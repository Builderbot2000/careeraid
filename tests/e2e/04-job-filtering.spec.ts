import { test, expect, goTo, runAndCommitScrape } from './fixtures/app'

test.describe('Job Filtering Module', () => {
  test.describe('Ban List', () => {
    test.beforeEach(async ({ page }) => {
      await runAndCommitScrape(page)
    })

    async function goToBanList(page: import('playwright').Page) {
      await goTo(page, 'Search Config')
      await page.getByRole('tab', { name: /Ban List/i }).or(page.getByRole('button', { name: /Ban List/i })).click()
    }

    test('live preview shows match count before confirming a company ban', async ({ page }) => {
      await goToBanList(page)
      // Type "Stripe" as a company ban — 1 mock posting matches
      const companyInput = page.getByPlaceholder(/company.*pattern|ban company/i)
        .or(page.getByLabel(/Company/i))
      await companyInput.fill('Stripe')
      // Preview count should appear
      await expect(page.getByText(/1 posting|1 match/i)).toBeVisible({ timeout: 5_000 })
    })

    test('confirming a company ban hard-deletes matching postings from the job board', async ({ page }) => {
      // Verify Stripe is on the board first
      await goTo(page, 'Job Board')
      await expect(page.getByText('Stripe')).toBeVisible()

      // Add ban
      await goToBanList(page)
      const companyInput = page.getByPlaceholder(/company.*pattern|ban company/i)
        .or(page.getByLabel(/Company/i))
      await companyInput.fill('Stripe')
      await page.getByRole('button', { name: /Add ban|Confirm|Add/i }).click()

      // Stripe should be gone from the job board
      await goTo(page, 'Job Board')
      await expect(page.getByText('Stripe')).not.toBeVisible()
    })

    test('confirming a domain ban hard-deletes matching postings', async ({ page }) => {
      // LinkedIn mock postings have null resolved_domain so we use a mock adapter
      // domain that would match. We verify the ban entry is created and accepted.
      await goToBanList(page)
      const domainInput = page.getByPlaceholder(/domain/i)
        .or(page.getByLabel(/Domain/i))
      await domainInput.fill('news.ycombinator.com')
      await page.getByRole('button', { name: /Add ban|Confirm|Add/i }).click()

      // Entry should appear in the ban list
      await expect(page.getByText('news.ycombinator.com')).toBeVisible()
      // Postings from that domain should be gone
      await goTo(page, 'Job Board')
      await expect(page.getByText(/No postings|no results|empty/i)).toBeVisible({ timeout: 5_000 })
    })

    test('removing a ban entry removes only the rule, not deleted postings', async ({ page }) => {
      // Ban Stripe
      await goToBanList(page)
      const companyInput = page.getByPlaceholder(/company.*pattern|ban company/i)
        .or(page.getByLabel(/Company/i))
      await companyInput.fill('Stripe')
      await page.getByRole('button', { name: /Add ban|Confirm|Add/i }).click()
      await expect(page.getByText('Stripe')).toBeVisible()

      // Remove the ban rule
      const banRow = page.locator('li, tr').filter({ hasText: 'Stripe' }).first()
      await banRow.getByRole('button', { name: /Remove|Delete|×/i }).click()

      // Rule is gone from the ban list
      await expect(page.locator('li, tr').filter({ hasText: 'Stripe' })).not.toBeVisible()

      // But Stripe posting is still NOT in the job board (hard-deleted, not restored)
      await goTo(page, 'Job Board')
      await expect(page.getByText('Stripe')).not.toBeVisible()
    })

    test('banned companies are excluded from a new scrape commit', async ({ page }) => {
      // First, clear data from beforeEach scrape by discarding (data is already committed)
      // Add a ban before running a fresh scrape
      await goToBanList(page)
      const companyInput = page.getByPlaceholder(/company.*pattern|ban company/i)
        .or(page.getByLabel(/Company/i))
      await companyInput.fill('^Vercel$')
      await page.getByRole('button', { name: /Add ban|Confirm|Add/i }).click()

      // The Vercel posting from beforeEach scrape is now hard-deleted.
      // Run another scrape — Vercel should be excluded in the summary.
      await goTo(page, 'Search Config')
      await page.getByRole('button', { name: /Run Scrape/i }).click()
      await page.waitForSelector('text=Net new to commit', { timeout: 15_000 })
      await expect(page.getByText(/Ban list excluded/i)).toBeVisible()
    })
  })

  test.describe('Keyword Filtering', () => {
    test.beforeEach(async ({ page }) => {
      await runAndCommitScrape(page)
    })

    async function goToFilters(page: import('playwright').Page) {
      await goTo(page, 'Search Config')
      await page.getByRole('tab', { name: /Filters/i }).or(page.getByRole('button', { name: /Filters/i })).click()
    }

    test('required keyword filters out postings that do not match', async ({ page }) => {
      // "Rust" appears in only some mock postings (Vercel, Fly.io, Deno)
      await goToFilters(page)
      const requiredInput = page.getByLabel(/Required keywords/i)
        .or(page.getByPlaceholder(/required keyword/i))
      await requiredInput.fill('Rust')
      await page.getByRole('button', { name: /Save|Apply/i }).click()

      await goTo(page, 'Job Board')
      // Stripe (Go, Ruby) should not appear; Fly.io (Rust) should appear
      await expect(page.getByText('Fly.io')).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText('Linear')).not.toBeVisible()
    })

    test('excluded keyword removes matching postings from the job board', async ({ page }) => {
      // "PostgreSQL" appears in several mock postings
      await goToFilters(page)
      const excludedInput = page.getByLabel(/Excluded keywords/i)
        .or(page.getByPlaceholder(/excluded keyword/i))
      await excludedInput.fill('PostgreSQL')
      await page.getByRole('button', { name: /Save|Apply/i }).click()

      await goTo(page, 'Job Board')
      // Stripe references PostgreSQL in its raw_text — should be excluded
      await expect(page.getByText('Stripe')).not.toBeVisible({ timeout: 10_000 })
    })

    test('re: prefix treats keyword as a regex pattern', async ({ page }) => {
      // Pattern that matches "Senior" or "Staff" seniority labels
      await goToFilters(page)
      const requiredInput = page.getByLabel(/Required keywords/i)
        .or(page.getByPlaceholder(/required keyword/i))
      await requiredInput.fill('re:Senior|Staff')
      await page.getByRole('button', { name: /Save|Apply/i }).click()

      await goTo(page, 'Job Board')
      // Mid-level postings (Linear, Supabase) should be filtered out
      await expect(page.getByText('Linear')).not.toBeVisible({ timeout: 10_000 })
    })

    test('modifying a keyword after commit takes retroactive effect without re-scrape', async ({ page }) => {
      // Verify all postings visible initially
      await goTo(page, 'Job Board')
      await expect(page.getByText('Stripe')).toBeVisible()

      // Now add an exclusion keyword
      await goToFilters(page)
      const excludedInput = page.getByLabel(/Excluded keywords/i)
        .or(page.getByPlaceholder(/excluded keyword/i))
      await excludedInput.fill('Stripe')
      await page.getByRole('button', { name: /Save|Apply/i }).click()

      // Return to job board — no re-scrape performed, but Stripe should be gone
      await goTo(page, 'Job Board')
      await expect(page.getByText('Stripe')).not.toBeVisible({ timeout: 10_000 })
    })

    test('excluded stack filter operates on tech stack independently from keyword filter', async ({ page }) => {
      await goToFilters(page)
      const excludedStackInput = page.getByLabel(/Excluded stack|Excluded tech/i)
        .or(page.getByPlaceholder(/e\.g\. PHP/i))
      await excludedStackInput.fill('TypeScript')
      await page.getByRole('button', { name: /Save|Apply/i }).click()

      await goTo(page, 'Job Board')
      // Linear (TypeScript, React, GraphQL) should be excluded
      await expect(page.getByText('Linear')).not.toBeVisible({ timeout: 10_000 })
      // Fly.io (Go, Rust) should still appear
      await expect(page.getByText('Fly.io')).toBeVisible()
    })
  })
})
