import { test, expect, goTo, runAndCommitScrape } from './fixtures/app'

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
